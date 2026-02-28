# Supabase Migration - Remaining Work

## Completed ✓
- [x] requirements.txt - Updated to use psycopg instead of asyncpg
- [x] app/config.py - Added Supabase connection documentation
- [x] app/database.py - Changed to synchronous SQLAlchemy engine
- [x] app/dependencies.py - Updated to use sync Session
- [x] app/models.py - Changed UUID type from PostgreSQL-specific to standard Uuid
- [x] app/main.py - Updated startup event to be synchronous
- [x] alembic/env.py - Updated with Supabase comments
- [x] app/repositories/user_repo.py - Converted to synchronous
- [x] app/repositories/goal_repo.py - Converted to synchronous
- [x] app/repositories/checkin_repo.py - Converted to synchronous
- [x] app/repositories/message_repo.py - Converted to synchronous
- [x] app/api/member.py - Converted routes to synchronous
- [x] app/api/goals.py - Converted routes to synchronous
- [x] app/api/mentor.py - Converted routes to synchronous
- [x] app/api/dashboard.py - Converted routes to synchronous
- [x] app/api/mentor_chat.py - Converted routes to synchronous
- [x] app/api/chat.py - Converted routes to synchronous
- [x] Created SUPABASE_MIGRATION_GUIDE.md - Comprehensive migration documentation
- [x] Created convert_async_to_sync.py - Helper script for conversion

## Remaining Work

### Services Layer (app/services/*.py)
These need to be converted to synchronous patterns:
- [ ] app/services/goal_service.py - Convert async methods to sync
- [ ] app/services/mentor_service.py - Convert async methods to sync
- [ ] app/services/gemini_service.py - Convert async AI calls (if possible)
- [ ] app/services/analytics_service.py - Check if methods need conversion

**Note**: Gemini API calls might need special handling if the google-generativeai library doesn't support sync mode.

### Utilities (app/utils/*.py)
- [ ] app/utils/context_builder.py - Convert async database queries to sync
- [ ] app/utils/snowflake_utils.py - Verify Snowflake integration still works

### Worker/Tasks (app/worker/*.py)
- [ ] app/worker/sync_tasks.py - Update async database operations
- [ ] app/worker/tasks.py - Update task definitions
- [ ] app/worker/celery_app.py - Verify Celery configuration compatibility
- [ ] app/worker/review_tasks.py - Update if using database

### Testing (app/tests/*.py)
- [ ] app/tests/test_member.py - Update tests for sync operations
- [ ] app/tests/test_mentor.py - Update tests for sync operations

## Next Steps

### 1. Check Service Files
Run this command to see which methods still need updating:
```bash
grep -r "async def\|await " backend/app/services/
```

### 2. Update Services
Use the provided conversion helper:
```bash
python convert_async_to_sync.py backend/app/services/goal_service.py
python convert_async_to_sync.py backend/app/services/mentor_service.py
```

### 3. Update Utilities
```bash
python convert_async_to_sync.py backend/app/utils/context_builder.py
```

### 4. Update Worker Tasks
The worker tasks might be more complex as they deal with both database and Snowflake.

### 5. Test Database Connection
Before running migrations, test the connection:
```bash
# Set your Supabase DATABASE_URL
export DATABASE_URL="postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres"

# Test connection
python -c "from app.database import engine; print(engine.connect())"
```

### 6. Run Migrations
```bash
alembic upgrade head
```

### 7. Test Application
```bash
uvicorn app.main:app --reload
```

## Common Issues to Watch For

1. **UUID Handling**: Ensure all UUID columns are using `Uuid(as_uuid=True)`
2. **Connection Pooling**: Verify pool settings work with Supabase
3. **Async Gemini API**: May need to handle specially - check google-generativeai docs
4. **Snowflake Integration**: Should continue working with minimal changes
5. **Worker Tasks**: May need special handling for task queues

## Documentation
- See SUPABASE_MIGRATION_GUIDE.md for detailed information
- See convert_async_to_sync.py for automated conversion helper

## Support Resources
- Supabase Docs: https://supabase.com/docs
- SQLAlchemy Sync Docs: https://docs.sqlalchemy.org/
- PostgreSQL Docs: https://www.postgresql.org/docs/
