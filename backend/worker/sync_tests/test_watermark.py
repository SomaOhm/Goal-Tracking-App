"""
Unit tests for watermark helpers in sync_utils.py.

These tests use only stdlib / pure-Python objects — no database required.
The Postgres calls are mocked via supabase-py's Client interface.
"""

import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, call

import pytest

from worker.sync_utils import (
    EPOCH,
    _serialize_value,
    get_watermark,
    max_watermark_from_rows,
    set_watermark,
)


# ---------------------------------------------------------------------------
# Helpers for building mock Supabase clients
# ---------------------------------------------------------------------------

def _make_supabase_read(data: list) -> MagicMock:
    """
    Return a mock Supabase client whose
    .table(...).select(...).eq(...).limit(...).execute()
    returns an object with .data == data.
    """
    execute_result = MagicMock()
    execute_result.data = data

    chain = MagicMock()
    chain.execute.return_value = execute_result
    # Every chained method returns the same chain object
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    chain.order.return_value = chain
    chain.gt.return_value = chain

    supabase = MagicMock()
    supabase.table.return_value = chain
    return supabase


def _make_supabase_write() -> MagicMock:
    """
    Return a mock Supabase client whose
    .table(...).upsert(...).execute() succeeds silently.
    """
    execute_result = MagicMock()
    execute_result.data = []

    chain = MagicMock()
    chain.execute.return_value = execute_result
    chain.upsert.return_value = chain

    supabase = MagicMock()
    supabase.table.return_value = chain
    return supabase


# ---------------------------------------------------------------------------
# _serialize_value
# ---------------------------------------------------------------------------

class TestSerializeValue:
    def test_none_passthrough(self):
        assert _serialize_value(None) is None

    def test_uuid_to_str(self):
        uid = uuid.UUID("12345678-1234-5678-1234-567812345678")
        result = _serialize_value(uid)
        assert result == "12345678-1234-5678-1234-567812345678"
        assert isinstance(result, str)

    def test_dict_to_json_string(self):
        import json
        d = {"key": "value", "num": 42}
        result = _serialize_value(d)
        assert isinstance(result, str)
        assert json.loads(result) == d

    def test_list_to_json_string(self):
        import json
        lst = ["happy", "motivated"]
        result = _serialize_value(lst)
        assert isinstance(result, str)
        assert json.loads(result) == lst

    def test_datetime_naive_to_iso(self):
        dt = datetime(2026, 1, 15, 10, 30, 0)
        result = _serialize_value(dt)
        assert result == "2026-01-15T10:30:00"

    def test_datetime_aware_stripped_to_utc_iso(self):
        dt = datetime(2026, 1, 15, 10, 30, 0, tzinfo=timezone.utc)
        result = _serialize_value(dt)
        # Should be naive ISO string in UTC
        assert result == "2026-01-15T10:30:00"

    def test_string_passthrough(self):
        assert _serialize_value("hello") == "hello"

    def test_int_passthrough(self):
        assert _serialize_value(42) == 42

    def test_bool_passthrough(self):
        assert _serialize_value(True) is True


# ---------------------------------------------------------------------------
# get_watermark
# ---------------------------------------------------------------------------

class TestGetWatermark:
    def test_returns_epoch_when_no_rows(self):
        supabase = _make_supabase_read([])
        result = get_watermark(supabase, "public.users")
        assert result == EPOCH

    def test_returns_epoch_when_watermark_is_null(self):
        supabase = _make_supabase_read([{"last_watermark": None}])
        result = get_watermark(supabase, "public.users")
        assert result == EPOCH

    def test_returns_stored_watermark_as_aware_datetime(self):
        # PostgREST returns a naive-looking ISO string without tz offset
        supabase = _make_supabase_read([{"last_watermark": "2026-02-01T12:00:00"}])
        result = get_watermark(supabase, "public.users")
        assert result.tzinfo is not None
        assert result == datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)

    def test_returns_stored_watermark_with_tz_suffix(self):
        # PostgREST may include +00:00
        supabase = _make_supabase_read([{"last_watermark": "2026-02-01T12:00:00+00:00"}])
        result = get_watermark(supabase, "public.users")
        assert result.tzinfo is not None
        assert result == datetime(2026, 2, 1, 12, 0, 0, tzinfo=timezone.utc)

    def test_queries_correct_table_and_filter(self):
        supabase = _make_supabase_read([])
        get_watermark(supabase, "dim_users")
        supabase.table.assert_called_once_with("sync_watermarks")
        supabase.table.return_value.select.assert_called_once_with("last_watermark")


# ---------------------------------------------------------------------------
# set_watermark
# ---------------------------------------------------------------------------

class TestSetWatermark:
    def test_calls_upsert_and_execute(self):
        supabase = _make_supabase_write()
        wm = datetime(2026, 2, 15, 8, 0, 0, tzinfo=timezone.utc)

        set_watermark(supabase, "dim_users", wm, rows_processed=42, status="ok")

        supabase.table.assert_called_once_with("sync_watermarks")
        supabase.table.return_value.upsert.assert_called_once()
        supabase.table.return_value.upsert.return_value.execute.assert_called_once()

    def test_upsert_payload_contains_correct_fields(self):
        supabase = _make_supabase_write()
        wm = datetime(2026, 2, 15, 8, 0, 0, tzinfo=timezone.utc)

        set_watermark(
            supabase, "dim_users", wm,
            rows_processed=10,
            status="ok",
        )

        payload = supabase.table.return_value.upsert.call_args[0][0]
        assert payload["source_table"] == "dim_users"
        assert payload["last_status"] == "ok"
        assert payload["rows_processed"] == 10
        assert payload["last_watermark"] == wm.isoformat()

    def test_passes_error_string(self):
        supabase = _make_supabase_write()
        wm = datetime(2026, 2, 15, 8, 0, 0, tzinfo=timezone.utc)

        set_watermark(
            supabase, "dim_users", wm,
            rows_processed=0,
            status="error",
            error="connection refused",
        )

        payload = supabase.table.return_value.upsert.call_args[0][0]
        assert payload["last_error"] == "connection refused"
        assert payload["last_status"] == "error"

    def test_upsert_conflict_target(self):
        supabase = _make_supabase_write()
        wm = datetime(2026, 2, 15, 8, 0, 0, tzinfo=timezone.utc)

        set_watermark(supabase, "dim_users", wm, rows_processed=0)

        kwargs = supabase.table.return_value.upsert.call_args[1]
        assert kwargs.get("on_conflict") == "source_table"


# ---------------------------------------------------------------------------
# max_watermark_from_rows
# ---------------------------------------------------------------------------

class TestMaxWatermarkFromRows:
    def test_returns_none_for_empty_rows(self):
        assert max_watermark_from_rows([], "updated_at") is None

    def test_returns_none_when_column_missing(self):
        rows = [{"id": "abc", "name": "Alice"}]
        assert max_watermark_from_rows(rows, "updated_at") is None

    def test_returns_max_of_iso_strings(self):
        rows = [
            {"id": "1", "updated_at": "2026-01-10T00:00:00"},
            {"id": "2", "updated_at": "2026-01-15T12:30:00"},
            {"id": "3", "updated_at": "2026-01-12T06:00:00"},
        ]
        result = max_watermark_from_rows(rows, "updated_at")
        assert result == datetime(2026, 1, 15, 12, 30, 0)

    def test_skips_none_values(self):
        rows = [
            {"id": "1", "updated_at": None},
            {"id": "2", "updated_at": "2026-03-01T00:00:00"},
        ]
        result = max_watermark_from_rows(rows, "updated_at")
        assert result == datetime(2026, 3, 1, 0, 0, 0)

    def test_handles_datetime_objects(self):
        dt1 = datetime(2026, 1, 1)
        dt2 = datetime(2026, 6, 1)
        rows = [
            {"updated_at": dt1},
            {"updated_at": dt2},
        ]
        result = max_watermark_from_rows(rows, "updated_at")
        assert result == dt2
