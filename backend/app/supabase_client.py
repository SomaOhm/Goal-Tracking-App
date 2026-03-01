"""
Singleton Supabase client for the sync path.

Usage:
    from app.supabase_client import get_supabase_client

    supabase = get_supabase_client()
    rows = supabase.table("users").select("*").execute().data
"""

from functools import lru_cache

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Return a cached Supabase client initialised from settings.
    lru_cache(maxsize=1) ensures only one instance is ever created per process.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
