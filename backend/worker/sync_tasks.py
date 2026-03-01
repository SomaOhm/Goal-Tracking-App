"""
Celery tasks for syncing data from PostgreSQL to Snowflake.

sync_postgres_to_snowflake
  - Config-driven: reads worker/sync_config.yaml for table list
  - Incremental: uses a watermark (updated_at / created_at) so only changed
    rows are fetched each run
  - Resumable: watermark state is persisted in the sync_watermarks Postgres
    table; a failed run resumes from the last successful watermark
  - Idempotent: Snowflake writes use MERGE so re-running a batch is safe

compute_adherence_scores / compute_risk_metrics
  - Unchanged analytics tasks that operate entirely inside Snowflake
"""

import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml
from celery import Task
from worker.celery_app import celery
from app.database import get_snowflake_connection
from app.supabase_client import get_supabase_client
from worker.sync_utils import (
    fetch_changed_rows,
    get_watermark,
    max_watermark_from_rows,
    set_watermark,
    upsert_to_snowflake,
)

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent / "sync_config.yaml"


def _load_config() -> dict:
    with open(_CONFIG_PATH, "r") as fh:
        return yaml.safe_load(fh)


# ---------------------------------------------------------------------------
# Main sync task
# ---------------------------------------------------------------------------

@celery.task(
    bind=True,
    name="worker.sync_tasks.sync_postgres_to_snowflake",
    max_retries=5,
    default_retry_delay=30,  # base delay; Celery doubles on each retry
)
def sync_postgres_to_snowflake(self: Task):
    """
    Incremental Postgres → Snowflake sync driven by sync_config.yaml.

    For each enabled table:
      1. Read last_watermark from sync_watermarks (default: epoch)
      2. Fetch rows WHERE watermark_col > last_watermark (up to batch_size)
      3. MERGE rows into the Snowflake target table
      4. Advance the watermark to max(watermark_col) in the batch
      5. If no rows, record an idle run and move on

    On transient errors the task retries with exponential backoff.
    Per-table errors are recorded in sync_watermarks.last_error and do not
    abort the remaining tables.
    """
    config = _load_config()
    tables = [t for t in config.get("tables", []) if t.get("enabled", True)]
    default_batch = config.get("default_batch_size", 1000)

    run_start = datetime.now(tz=timezone.utc)
    logger.info("[sync] Starting run at %s for %d tables", run_start.isoformat(), len(tables))

    supabase = get_supabase_client()
    sf_conn = None

    try:
        sf_conn = get_snowflake_connection()
        sf_cursor = sf_conn.cursor()

        summary = []

        for tbl in tables:
            source = tbl["source"]
            target = tbl["target"]
            pk = tbl["pk"]
            watermark_col = tbl["watermark_column"]
            batch_size = tbl.get("batch_size", default_batch)

            t0 = time.monotonic()
            logger.info("[sync] Table %s → %s (watermark: %s)", source, target, watermark_col)

            try:
                last_wm = get_watermark(supabase, source)
                logger.debug("[sync]   Last watermark: %s", last_wm)

                rows = fetch_changed_rows(
                    supabase,
                    source_table=source,
                    watermark_column=watermark_col,
                    since=last_wm,
                    batch_size=batch_size,
                )

                if not rows:
                    logger.info("[sync]   No new rows — idle")
                    set_watermark(
                        supabase, source,
                        new_watermark=last_wm,
                        rows_processed=0,
                        status="idle",
                    )
                    summary.append({"table": source, "rows": 0, "status": "idle"})
                    continue

                # Write to Snowflake
                upsert_to_snowflake(sf_cursor, target, rows, pk)
                sf_conn.commit()

                # Advance watermark
                new_wm = max_watermark_from_rows(rows, watermark_col)
                if new_wm is None:
                    new_wm = last_wm  # defensive fallback

                set_watermark(
                    supabase, source,
                    new_watermark=new_wm,
                    rows_processed=len(rows),
                    status="ok",
                )

                elapsed = time.monotonic() - t0
                logger.info(
                    "[sync]   Synced %d rows in %.2fs (new watermark: %s)",
                    len(rows), elapsed, new_wm,
                )
                summary.append({"table": source, "rows": len(rows), "status": "ok"})

            except Exception as tbl_err:  # noqa: BLE001
                elapsed = time.monotonic() - t0
                logger.exception("[sync]   Error syncing %s after %.2fs: %s", source, elapsed, tbl_err)
                try:
                    set_watermark(
                        supabase, source,
                        new_watermark=get_watermark(supabase, source),
                        rows_processed=0,
                        status="error",
                        error=str(tbl_err)[:2000],
                    )
                except Exception:  # noqa: BLE001
                    pass  # don't let watermark write failure mask original error
                summary.append({"table": source, "rows": 0, "status": "error", "error": str(tbl_err)})

        total_rows = sum(r["rows"] for r in summary)
        logger.info(
            "[sync] Run complete. %d tables processed, %d total rows synced.",
            len(summary), total_rows,
        )
        return {"status": "ok", "run_at": run_start.isoformat(), "tables": summary}

    except Exception as exc:  # noqa: BLE001
        logger.exception("[sync] Fatal error during sync run: %s", exc)
        try:
            self.retry(exc=exc, countdown=2 ** self.request.retries * 30)
        except self.MaxRetriesExceededError:
            logger.error("[sync] Max retries exceeded — giving up on this run.")
        return {"status": "fatal_error", "error": str(exc)}

    finally:
        if sf_conn:
            try:
                sf_conn.close()
            except Exception:  # noqa: BLE001
                pass


# ---------------------------------------------------------------------------
# Adherence scoring (Snowflake-only, unchanged from original)
# ---------------------------------------------------------------------------

@celery.task(
    bind=True,
    name="worker.sync_tasks.compute_adherence_scores",
)
def compute_adherence_scores(self: Task):
    """
    Compute 7/30/90-day adherence metrics for all users.
    Operates entirely inside Snowflake — no Postgres reads needed.
    """
    logger.info("[adherence] Computing adherence scores...")

    conn = get_snowflake_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT DISTINCT user_id FROM fact_checkins")
        user_ids = cursor.fetchall()

        for (user_id,) in user_ids:
            for days, col in [(7, "adherence_7d"), (30, "adherence_30d"), (90, "adherence_90d")]:
                cursor.execute(f"""
                    MERGE INTO metrics_adherence ma
                    USING (
                        SELECT
                            '{user_id}' as user_id,
                            CURRENT_DATE() as metric_date,
                            ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) /
                                  NULLIF(COUNT(*), 0), 2) as adherence
                        FROM fact_checkins
                        WHERE user_id = '{user_id}'
                        AND timestamp >= DATEADD(day, -{days}, CURRENT_TIMESTAMP())
                    ) sa
                    ON ma.user_id = sa.user_id AND ma.metric_date = sa.metric_date
                    WHEN MATCHED THEN UPDATE SET {col} = sa.adherence
                    WHEN NOT MATCHED THEN INSERT
                        (user_id, metric_date, {col})
                        VALUES (sa.user_id, sa.metric_date, sa.adherence)
                """)

        conn.commit()
        logger.info("[adherence] Done. %d users processed.", len(user_ids))
        return {"status": "success", "users_processed": len(user_ids)}

    finally:
        cursor.close()
        conn.close()


# ---------------------------------------------------------------------------
# Risk metrics (Snowflake-only, unchanged from original)
# ---------------------------------------------------------------------------

@celery.task(
    bind=True,
    name="worker.sync_tasks.compute_risk_metrics",
)
def compute_risk_metrics(self: Task):
    """
    Detect risk patterns and update metrics_risk table.
    Identifies users with low adherence or prolonged inactivity.
    Operates entirely inside Snowflake.
    """
    logger.info("[risk] Computing risk metrics...")

    conn = get_snowflake_connection()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT DISTINCT user_id FROM fact_checkins")
        user_ids = cursor.fetchall()

        for (user_id,) in user_ids:
            cursor.execute("""
                SELECT
                    COUNT(CASE WHEN completed = FALSE AND
                               timestamp >= DATEADD(day, -7, CURRENT_TIMESTAMP())
                          THEN 1 END) as missed_7d,
                    COUNT(CASE WHEN completed = FALSE AND
                               timestamp >= DATEADD(day, -3, CURRENT_TIMESTAMP())
                          THEN 1 END) as missed_3d,
                    DATEDIFF(day, MAX(timestamp), CURRENT_TIMESTAMP()) as days_since_checkin
                FROM fact_checkins
                WHERE user_id = %s
            """, (user_id,))

            result = cursor.fetchone()
            missed_7d, missed_3d, days_since = result

            risk_level = "low"
            risk_score = 0.0

            if missed_7d >= 4:
                risk_level = "high"
                risk_score = 0.8 + (min(missed_7d - 4, 3) * 0.05)
            elif missed_7d >= 2:
                risk_level = "medium"
                risk_score = 0.5 + (missed_7d * 0.1)

            if days_since and days_since > 3:
                risk_level = "high"
                risk_score = max(risk_score, 0.7)

            cursor.execute("""
                MERGE INTO metrics_risk mr
                USING (SELECT %s as user_id) sr
                ON mr.user_id = sr.user_id
                WHEN MATCHED THEN UPDATE SET
                    risk_level = %s,
                    risk_score = %s,
                    missed_count_7d = %s,
                    missed_count_3d = %s,
                    last_checkin_days_ago = %s,
                    last_evaluated = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN INSERT
                    (user_id, risk_level, risk_score, missed_count_7d,
                     missed_count_3d, last_checkin_days_ago)
                    VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                user_id, risk_level, min(risk_score, 1.0), missed_7d, missed_3d, days_since or 999,
                user_id, risk_level, min(risk_score, 1.0), missed_7d, missed_3d, days_since or 999,
            ))

        conn.commit()
        logger.info("[risk] Done. %d users processed.", len(user_ids))
        return {"status": "success", "users_processed": len(user_ids)}

    finally:
        cursor.close()
        conn.close()
