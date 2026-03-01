# Snowflake Sync Implementation Plan

Purpose
- Implement a Celery-based periodic sync from Postgres → Snowflake that runs every 2 minutes and makes data available in Snowflake for analytics.

Constraints / Known facts
- Source DB: Postgres (confirmed). Table names, count and schemas: unknown.
- Existing infra: FastAPI backend and a Celery worker are present under `backend/worker/`.
- Goal: safe, idempotent, incremental sync suitable for unknown schemas and small-to-moderate volumes. Scale later if needed.

High-level design
- A Celery periodic task (beat) `sync_postgres_to_snowflake` runs every 120 seconds.
- Use a config-driven approach: operator provides per-table config (source, target, pk, watermark column, batch size, optional transform).
- For each configured table, fetch changed rows from Postgres using a watermark (timestamp) and upsert into Snowflake via staging + MERGE.
- Persist watermark state in Postgres in a `sync_watermarks` table so the task can resume reliably.

Why config-driven?
- Schemas are unknown — explicit table list avoids accidental syncing of unsupported tables and gives control to operators.
- Allows per-table tuning (batch size, transforms) and safe rollout.

Components to add
- `backend/worker/sync.py` — main Celery task and orchestration.
- `backend/worker/sync_utils.py` — helpers for Postgres reads, Snowflake writes, watermark management, and transformations.
- `backend/worker/sync_config.yaml` — per-table configuration file.
- Add a beat schedule entry in `backend/worker/celery_app.py`.
- Tests: `backend/worker/sync_tests/` (unit tests for transforms/watermark; lightweight integration test).

Example config (sync_config.yaml)
```yaml
sync_interval_seconds: 120
default_batch_size: 1000
tables:
  - source: public.users
    target: analytics.users
    pk: id
    watermark_column: updated_at
    batch_size: 500
    transform: null
  - source: public.checkins
    target: analytics.checkins
    pk: id
    watermark_column: last_modified
    batch_size: 1000
    transform: null
```

Metadata / watermark table (Postgres)
- Table name: `sync_watermarks`
- Columns: `source_table TEXT PRIMARY KEY, last_watermark TIMESTAMP, last_run TIMESTAMP, last_status TEXT, last_error TEXT, rows_processed INT`
- Store watermark state close to source so it is consistent and simple to inspect.

Task flow (detailed)
1. Read `sync_config.yaml` and iterate configured tables.
2. For each table, read `last_watermark` from `sync_watermarks` (null means epoch).
3. Query Postgres:
   - SELECT * FROM source_table WHERE watermark_col > last_watermark ORDER BY watermark_col ASC LIMIT batch_size
4. If no rows: update `last_run` (and `last_status='idle'`), continue.
5. Otherwise: transform rows if a transform is configured.
6. Load batch into Snowflake staging and run a single MERGE to upsert into the target table.
   - Option A (small volume): use Snowflake connector to insert into a temporary staging table and MERGE.
   - Option B (scaling): write CSV/Parquet, upload to S3 stage, use `COPY INTO` then MERGE.
7. On success: compute new watermark = max(watermark_col) in the batch and update `sync_watermarks` atomically.
8. Log metrics and continue to next configured table.

MERGE example (Snowflake)
```sql
MERGE INTO analytics.target_table T
USING staging.temp_table S
ON T.id = S.id
WHEN MATCHED THEN UPDATE SET col1 = S.col1, col2 = S.col2
WHEN NOT MATCHED THEN INSERT (id, col1, col2) VALUES (S.id, S.col1, S.col2);
```

Scheduling
- Add to `backend/worker/celery_app.py`:
```python
celery.conf.beat_schedule = {
    "sync-postgres-to-sf-every-2-minutes": {
        "task": "worker.sync.sync_postgres_to_snowflake",
        "schedule": 120.0,
    },
}
```
- Task hints: `bind=True`, `max_retries=5`, exponential backoff.

Error handling & retries
- Use Celery retry for transient errors (DB/network). Configure sensible retry/backoff.
- For persistent schema or mapping errors, capture the failing payload in a `sync_errors` table for manual inspection and set `last_status='error'` with `last_error` details.
- Ensure idempotency via MERGE + watermark.

Observability
- Emit or log: `sync_success_count`, `sync_failure_count`, `last_sync_duration_seconds`, `rows_processed` per table.
- Log to stdout and optionally to a `sync_logs` Postgres table or to existing logging stack.

Security & credentials
- Add required env vars to `backend/.env` (dev placeholders):
  - `POSTGRES_DSN` or `PG_HOST/PG_USER/PG_PASS/PG_DB/PG_PORT`
  - `SNOWFLAKE_USER`, `SNOWFLAKE_PASSWORD`, `SNOWFLAKE_ACCOUNT`, `SNOWFLAKE_WAREHOUSE`, `SNOWFLAKE_DATABASE`, `SNOWFLAKE_SCHEMA`
  - Optional: `S3_ACCESS_KEY`, `S3_SECRET`, `S3_BUCKET` if using S3 staging

Schema discovery / unknown schema handling
- Recommended: config-driven table list. Safer and explicit.
- Optional future enhancement: implement a discovery mode that reads `information_schema.columns` and maps types to Snowflake equivalents; put discovery behind a dry-run flag.

Testing & rollout
- Stage 1 (PoC): implement for one small table with direct MERGE and run manually.
- Stage 2 (QA): add additional tables to config and enable Celery beat schedule.
- Stage 3 (Prod): for high-volume tables, switch to S3 staging + `COPY INTO` and consider chunking/parallelization.
- Tests: unit tests for transforms and watermark logic; lightweight integration test that populates test Postgres rows and verifies Snowflake target and watermark update.

Files to add (suggested paths)
- `backend/worker/sync.py` — main task implementation.
- `backend/worker/sync_utils.py` — helpers for Postgres, Snowflake, watermark and transforms.
- `backend/worker/sync_config.yaml` — the table mapping config.
- `backend/worker/sync_tests/` — unit + integration tests.
- (this plan) `plan/snowflake_sync_plan.md` — this file.

Estimated effort
- Minimal PoC (1 table, direct MERGE): 4–8 hours (dev + local testing).
- Config-driven multi-table + tests + basic observability: 1–2 days.
- Production-ready (S3 staging, monitoring, alerting): 2–4 days.

Next actions
1. I can create the initial plan file here (done). If you want I will next:
   - Option A (recommended): create `backend/worker/sync.py` + `sync_utils.py` + example `sync_config.yaml` as a PoC for one table.
   - Option B: only create config and metadata table SQL snippets for your DB admin to run.

Pick which implementation step you want me to perform next (I can start writing the PoC code and tests).
