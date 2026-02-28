# Supabase Migration Guide: From Digital Ocean PostgreSQL

## Overview
This guide documents the migration of the Goal Tracking App from Digital Ocean-hosted PostgreSQL to Supabase.

## Key Changes Made

### 1. Dependencies Updated (`requirements.txt`)
- **Removed**: `asyncpg==0.29.0` (async PostgreSQL driver)
- **Added**: `psycopg[binary]==3.1.12` (synchronous PostgreSQL driver)
- **Changed**: `sqlalchemy[asyncio]==2.0.23` → `sqlalchemy==2.0.23` (synchronous SQLAlchemy)

### 2. Database Connection (`app/database.py`)
- **Changed**: Async engine to synchronous engine
  - Old: `create_async_engine()` with `AsyncSession`
  - New: `create_engine()` with `Session`
- **Added**: Connection pooling configuration:
  ```python
  pool_pre_ping=True,  # Verify connection before using
  pool_size=5,
  max_overflow=10
  ```

### 3. Database Models (`app/models.py`)
- **Changed**: PostgreSQL-specific UUID type to standard SQLAlchemy UUID
  - Old: `from sqlalchemy.dialects.postgresql import UUID`
  - New: `from sqlalchemy import Uuid`
- **All UUID columns**: Changed from `UUID(as_uuid=True)` to `Uuid(as_uuid=True)`

### 4. Configuration (`app/config.py`)
- Updated DATABASE_URL documentation with Supabase connection string format
- Format: `postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres`

### 5. Application Startup (`app/main.py`)
- **Changed**: Async startup to synchronous
  - Old: `async def startup()` with `async with engine.begin() as conn: await conn.run_sync()`
  - New: `def startup()` with `Base.metadata.create_all(bind=engine)`

## Files Still Needing Updates

### Repository Layer (`app/repositories/*.py`)
All repository files need to be converted from async to sync:
- `app/repositories/user_repo.py`
- `app/repositories/goal_repo.py`
- `app/repositories/checkin_repo.py`
- `app/repositories/message_repo.py`

**Pattern to follow:**
```python
# Old (Async)
async def get_by_id(self, user_id) -> User | None:
    result = await self.session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# New (Sync)
def get_by_id(self, user_id) -> User | None:
    result = self.session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

**Changes:**
- Remove `async` keyword from method definitions
- Remove `await` keywords from session calls
- `AsyncSession` import → `Session`

### API Layer (`app/api/*.py`)
All API route handlers need updates:
- `app/api/member.py`
- `app/api/goals.py`
- `app/api/chat.py`
- `app/api/dashboard.py`
- `app/api/mentor.py`
- `app/api/mentor_chat.py`

**Pattern:**
```python
# Old (Async)
async def create_goal(
    user_id: UUID,
    data: GoalCreate,
    session: AsyncSession = Depends(get_db)
):
    repo = GoalRepository(session)
    goal = await repo.create(...)
    return goal

# New (Sync)
def create_goal(
    user_id: UUID,
    data: GoalCreate,
    session: Session = Depends(get_db)
):
    repo = GoalRepository(session)
    goal = repo.create(...)
    return goal
```

**Changes:**
- Remove `async` keyword from route handlers
- Remove `await` keywords from repository/service calls
- Update imports: `from sqlalchemy.ext.asyncio import AsyncSession` → `from sqlalchemy.orm import Session`
- Update dependency injection: `session: AsyncSession` → `session: Session`

### Services (`app/services/*.py`)
All service methods need synchronous versions:
- `app/services/goal_service.py`
- `app/services/mentor_service.py`
- `app/services/gemini_service.py`
- `app/services/analytics_service.py`

### Worker Tasks (`app/worker/*.py`)
- `app/worker/sync_tasks.py`: Update Snowflake sync tasks
- `app/worker/tasks.py`: Update task definitions
- Celery tasks need adjustment for synchronous database access

### Utilities (`app/utils/*.py`)
- `app/utils/context_builder.py`: Update all database queries to sync
- `app/utils/snowflake_utils.py`: Keep Snowflake integration, update PostgreSQL queries

## Environment Variables Setup for Supabase

Create/update `.env` file with:

```bash
# Supabase Connection String
# Get these from: https://app.supabase.com/project/[your-project]/settings/database
DATABASE_URL=postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres

# Snowflake credentials (if keeping analytics)
SNOWFLAKE_USER=your_snowflake_user
SNOWFLAKE_PASSWORD=your_snowflake_password
SNOWFLAKE_ACCOUNT=your_snowflake_account
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_SCHEMA=PUBLIC

# Gemini API Key
GOOGLE_API_KEY=your_gemini_api_key
```

## Migration Checklist

- [x] Update dependencies (requirements.txt)
- [x] Update database configuration (config.py, database.py)
- [x] Update ORM models (models.py)
- [x] Update application startup (main.py)
- [x] Update Alembic migrations
- [ ] Update all repositories to sync
- [ ] Update all API routes to sync
- [ ] Update all services to sync
- [ ] Update all utilities to sync
- [ ] Update worker tasks
- [ ] Update dependencies.py
- [ ] Test database connections
- [ ] Run migrations: `alembic upgrade head`
- [ ] Update FastAPI app lifecycle for sync operations
- [ ] Test all endpoints
- [ ] Update CI/CD pipelines if applicable

## Running Migrations

```bash
# Set environment variable
export DATABASE_URL="postgresql://..."  # Your Supabase connection string

# Create migration
alembic revision --autogenerate -m "Initial Supabase migration"

# Apply migration
alembic upgrade head

# Check migration status
alembic current
```

## Important Notes

1. **Supabase is PostgreSQL**: Supabase doesn't change the database type, it only changes hosting. Most code patterns remain the same.

2. **Synchronous vs Async**: The migration changes from async to synchronous patterns. This simplifies the code but means:
   - FastAPI routes can be synchronous or asynchronous
   - Database operations no longer use `await`
   - No `AsyncSession` or `async with` blocks needed

3. **Connection Pooling**: Supabase adds connection pooling benefits built-in, so the local pool configuration is important for managing connections.

4. **Snowflake Sync**: Snowflake integration is maintained for analytics. PostgreSQL to Snowflake sync continues as before.

5. **UUID Handling**: All UUID fields now use standard SQLAlchemy UUID type, which works across all databases.

## Troubleshooting

### Connection Errors
- Verify DATABASE_URL format is correct
- Ensure Supabase database is running
- Check firewall/IP whitelist in Supabase dashboard

### UUID Errors
- Ensure all UUID column definitions updated to use `Uuid(as_uuid=True)`

### Transaction Errors
- Sync sessions require explicit `commit()` calls (already in repos)
- No `async with` blocks needed

## Support

For Supabase-specific issues, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
