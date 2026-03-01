-- Run this once in: Supabase Dashboard → SQL Editor
-- Creates the watermark tracking table used by the Postgres → Snowflake sync.

CREATE TABLE IF NOT EXISTS public.sync_watermarks (
    source_table    TEXT        PRIMARY KEY,
    last_watermark  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00Z',
    last_run        TIMESTAMPTZ,
    last_status     TEXT        NOT NULL DEFAULT 'pending',
    last_error      TEXT,
    rows_processed  INTEGER     NOT NULL DEFAULT 0
);

-- Optional: let the anon key read/write this table (needed by supabase-py)
-- If your project uses RLS you must add policies; otherwise grant is enough.
ALTER TABLE public.sync_watermarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role full access" ON public.sync_watermarks
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Grant anon role (used by SUPABASE_ANON_KEY) full access.
-- For production, prefer using the service_role key for the sync worker.
GRANT ALL ON public.sync_watermarks TO anon;
GRANT ALL ON public.sync_watermarks TO authenticated;
