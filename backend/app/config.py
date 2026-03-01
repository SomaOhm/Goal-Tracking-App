from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Absolute path to the .env file — works regardless of working directory
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    # Supabase PostgreSQL Connection — must use postgresql+psycopg:// (psycopg3 driver)
    # Format: postgresql+psycopg://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres
    DATABASE_URL: str = "postgresql+psycopg://localhost/goaltracking"

    # Supabase REST client credentials (used by supabase-py for the sync path)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""

    # Snowflake connection credentials
    SNOWFLAKE_USER: str = ""
    SNOWFLAKE_PASSWORD: str = ""
    SNOWFLAKE_ACCOUNT: str = ""
    SNOWFLAKE_WAREHOUSE: str = ""
    SNOWFLAKE_DATABASE: str = ""
    SNOWFLAKE_SCHEMA: str = "PUBLIC"
    SNOWFLAKE_ROLE: str = ""

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields not defined in Settings


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
