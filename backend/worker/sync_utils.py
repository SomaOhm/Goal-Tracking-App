"""
Helper utilities for the Postgres → Snowflake incremental sync.

Responsibilities:
- Watermark read/write against the sync_watermarks Postgres table (via supabase-py)
- Fetching changed rows from Postgres using a watermark timestamp (via supabase-py)
- Upserting rows into Snowflake via a temporary staging table + MERGE
- JSON/UUID serialization for Snowflake compatibility
"""

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import Client

logger = logging.getLogger(__name__)

# Epoch used when no watermark exists yet — syncs all rows on first run
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Watermark helpers (Postgres via supabase-py)
# ---------------------------------------------------------------------------

def get_watermark(supabase: Client, source_table: str) -> datetime:
    """
    Return the last successful watermark for *source_table*.
    Returns EPOCH if no watermark row exists yet (first run).
    """
    response = (
        supabase
        .table("sync_watermarks")
        .select("last_watermark")
        .eq("source_table", source_table)
        .limit(1)
        .execute()
    )

    data = response.data
    if not data or data[0].get("last_watermark") is None:
        return EPOCH

    raw = data[0]["last_watermark"]
    # PostgREST returns timestamps as ISO strings
    if isinstance(raw, str):
        ts = datetime.fromisoformat(raw)
    elif isinstance(raw, datetime):
        ts = raw
    else:
        return EPOCH

    # Ensure timezone-aware so comparisons are consistent
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts


def set_watermark(
    supabase: Client,
    source_table: str,
    new_watermark: datetime,
    rows_processed: int,
    status: str = "ok",
    error: Optional[str] = None,
) -> None:
    """
    Upsert the watermark row for *source_table* in sync_watermarks.
    Called atomically after a successful batch so the task can resume
    from the correct position on the next run.
    """
    supabase.table("sync_watermarks").upsert(
        {
            "source_table": source_table,
            "last_watermark": new_watermark.isoformat(),
            "last_run": datetime.now(tz=timezone.utc).isoformat(),
            "last_status": status,
            "last_error": error,
            "rows_processed": rows_processed,
        },
        on_conflict="source_table",
    ).execute()


# ---------------------------------------------------------------------------
# Postgres read helpers (via supabase-py)
# ---------------------------------------------------------------------------

def fetch_changed_rows(
    supabase: Client,
    source_table: str,
    watermark_column: str,
    since: datetime,
    batch_size: int,
) -> List[Dict[str, Any]]:
    """
    Return up to *batch_size* rows from *source_table* where
    *watermark_column* > *since*, ordered ascending so the watermark
    advances correctly even if the batch is partial.

    Returns a list of plain dicts (column → value) with all values
    serialized to Snowflake-safe types via _serialize_value().
    """
    since_iso = since.isoformat()

    response = (
        supabase
        .table(source_table)
        .select("*")
        .gt(watermark_column, since_iso)
        .order(watermark_column, desc=False)
        .limit(batch_size)
        .execute()
    )

    rows = []
    for raw_row in (response.data or []):
        row = {col: _serialize_value(val) for col, val in raw_row.items()}
        rows.append(row)

    return rows


def _serialize_value(val: Any) -> Any:
    """
    Convert Python values to types Snowflake's connector can handle:
    - UUID  → str
    - dict/list → JSON string (Snowflake VARIANT columns use PARSE_JSON)
    - datetime with tz → naive UTC ISO string
    - everything else passes through unchanged
    """
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (dict, list)):
        return json.dumps(val)
    if isinstance(val, datetime):
        if val.tzinfo is not None:
            val = val.astimezone(timezone.utc).replace(tzinfo=None)
        return val.isoformat()
    return val


# ---------------------------------------------------------------------------
# Snowflake write helpers
# ---------------------------------------------------------------------------

def ensure_snowflake_table(
    sf_cursor,
    target_table: str,
    columns: List[str],
    pk: str,
) -> None:
    """
    CREATE TABLE IF NOT EXISTS the target table in Snowflake.
    All columns are created as VARCHAR except the pk (also VARCHAR).
    This is intentionally permissive — Snowflake can cast as needed and
    the schema can be tightened later once column types are stable.
    """
    col_defs = ", ".join(
        f"{col} VARCHAR" for col in columns
    )
    sf_cursor.execute(
        f"CREATE TABLE IF NOT EXISTS {target_table} ({col_defs})"
    )


def upsert_to_snowflake(
    sf_cursor,
    target_table: str,
    rows: List[Dict[str, Any]],
    pk: str,
) -> None:
    """
    Upsert *rows* into *target_table* using a Snowflake temporary
    staging table + MERGE statement.

    Steps:
    1. CREATE OR REPLACE TEMPORARY TABLE staging_<target> (same columns)
    2. INSERT all rows into staging in one executemany call
    3. MERGE staging → target on pk equality
    4. The temp table is automatically dropped at session end
    """
    if not rows:
        return

    columns = list(rows[0].keys())
    staging_table = f"staging_{target_table.replace('.', '_')}"

    # 1. Create staging table
    col_defs = ", ".join(f"{col} VARCHAR" for col in columns)
    sf_cursor.execute(
        f"CREATE OR REPLACE TEMPORARY TABLE {staging_table} ({col_defs})"
    )

    # 2. Bulk insert into staging
    placeholders = ", ".join(["%s"] * len(columns))
    insert_sql = (
        f"INSERT INTO {staging_table} ({', '.join(columns)}) "
        f"VALUES ({placeholders})"
    )
    sf_cursor.executemany(
        insert_sql,
        [tuple(row[col] for col in columns) for row in rows],
    )

    # 3. MERGE staging → target
    #    Ensure target table exists first
    ensure_snowflake_table(sf_cursor, target_table, columns, pk)

    update_cols = [c for c in columns if c != pk]
    update_clause = ", ".join(f"t.{c} = s.{c}" for c in update_cols)
    insert_cols = ", ".join(columns)
    insert_vals = ", ".join(f"s.{c}" for c in columns)

    merge_sql = f"""
        MERGE INTO {target_table} t
        USING {staging_table} s
        ON t.{pk} = s.{pk}
        WHEN MATCHED THEN UPDATE SET {update_clause}
        WHEN NOT MATCHED THEN INSERT ({insert_cols}) VALUES ({insert_vals})
    """
    sf_cursor.execute(merge_sql)


# ---------------------------------------------------------------------------
# Watermark extraction from a batch
# ---------------------------------------------------------------------------

def max_watermark_from_rows(
    rows: List[Dict[str, Any]],
    watermark_column: str,
) -> Optional[datetime]:
    """
    Return the maximum watermark value found in *rows* as a datetime.
    The rows have already been serialized (watermark is an ISO string).
    Returns None if the column is missing or all values are None.
    """
    values = []
    for row in rows:
        raw = row.get(watermark_column)
        if raw is None:
            continue
        if isinstance(raw, str):
            try:
                values.append(datetime.fromisoformat(raw))
            except ValueError:
                pass
        elif isinstance(raw, datetime):
            values.append(raw)

    return max(values) if values else None
