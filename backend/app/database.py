from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings
import snowflake.connector
import os

# Supabase PostgreSQL connection (synchronous engine)
DATABASE_URL = settings.DATABASE_URL

# Short timeout so startup doesn't hang on slow/unreachable DB
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 15},
)

SessionLocal = sessionmaker(
    bind=engine,
    expire_on_commit=False
)

# Async engine for worker tasks that use asyncio.run()
# psycopg3 supports async via the postgresql+psycopg:// scheme
_ASYNC_DATABASE_URL = DATABASE_URL.replace(
    "postgresql://", "postgresql+psycopg://"
).replace(
    "postgres://", "postgresql+psycopg://"
)

async_engine = create_async_engine(
    _ASYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


def get_snowflake_connection():
    """Create a synchronous Snowflake connection."""
    kwargs = dict(
        user=settings.SNOWFLAKE_USER,
        password=settings.SNOWFLAKE_PASSWORD,
        account=settings.SNOWFLAKE_ACCOUNT,
        warehouse=settings.SNOWFLAKE_WAREHOUSE,
        database=settings.SNOWFLAKE_DATABASE,
        schema=settings.SNOWFLAKE_SCHEMA,
    )
    if settings.SNOWFLAKE_ROLE:
        kwargs["role"] = settings.SNOWFLAKE_ROLE
    return snowflake.connector.connect(**kwargs)