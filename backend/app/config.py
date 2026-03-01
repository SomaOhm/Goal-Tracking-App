from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Supabase PostgreSQL Connection
    # Format: postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres
    DATABASE_URL: str = "postgresql://localhost/goaltracking"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields not defined in Settings


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
