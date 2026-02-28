# Supabase Migration - Quick Start Checklist

## ✅ Pre-Deployment Checklist

### 1. Environment Setup
- [ ] Get Supabase connection string from Dashboard
  - Go to: https://app.supabase.com/project/[your-project]/settings/database
  - Format: `postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres`
- [ ] Create `.env` file in backend/ directory with:
  ```
  DATABASE_URL=postgresql://postgres.[project-id]:[password]@db.[project-id].supabase.co:5432/postgres
  SNOWFLAKE_USER=xxx
  SNOWFLAKE_PASSWORD=xxx
  SNOWFLAKE_ACCOUNT=xxx
  SNOWFLAKE_WAREHOUSE=xxx
  SNOWFLAKE_DATABASE=xxx
  SNOWFLAKE_SCHEMA=PUBLIC
  GOOGLE_API_KEY=xxx
  ```

### 2. Dependencies Installation
- [ ] Install updated requirements:
  ```bash
  cd backend
  pip install -r requirements.txt
  ```
- [ ] Verify psycopg installation:
  ```bash
  python -c "import psycopg; print(psycopg.__version__)"
  ```

### 3. Database Connection Testing
- [ ] Test connection:
  ```bash
  python -c "
  from app.database import engine
  conn = engine.connect()
  print('✓ Connection successful')
  conn.close()
  "
  ```
- [ ] Check schema:
  ```bash
  python -c "
  from app.database import engine
  from app.models import Base
  inspector = inspect(engine)
  print('Tables in database:', inspector.get_table_names())
  "
  ```

### 4. Alembic Migrations
- [ ] View current migration status:
  ```bash
  alembic current
  ```
- [ ] Create new migration (if needed):
  ```bash
  alembic revision --autogenerate -m "Supabase migration"
  ```
- [ ] Review migration file in `alembic/versions/`
- [ ] Apply migration:
  ```bash
  alembic upgrade head
  ```
- [ ] Verify migration applied:
  ```bash
  alembic current
  ```

### 5. Application Startup Test
- [ ] Start application:
  ```bash
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- [ ] Check health endpoint:
  ```bash
  curl http://localhost:8000/health
  ```
- [ ] Should return: `{"status": "healthy", ...}`

### 6. API Endpoint Testing
- [ ] Test with FastAPI Swagger UI:
  ```
  http://localhost:8000/docs
  ```
- [ ] Test critical endpoints:
  - POST /members/ - Create member
  - GET /members/{id} - Get member
  - POST /goals/ - Create goal
  - GET /goals/{id} - Get goal

### 7. Data Operations Testing
- [ ] Create test user:
  ```python
  from app.repositories.user_repo import UserRepository
  from app.database import SessionLocal
  
  session = SessionLocal()
  repo = UserRepository(session)
  user = repo.create(name="Test User")
  print(f"Created user: {user.id}")
  session.close()
  ```
- [ ] Verify data persists by querying again:
  ```python
  session = SessionLocal()
  repo = UserRepository(session)
  user = repo.get_by_id(user_id)
  print(f"Retrieved user: {user.name}")
  session.close()
  ```

### 8. Remaining Minor Updates
- [ ] Review `app/services/gemini_service.py` for any needed changes
- [ ] Review `app/services/analytics_service.py` for any async patterns
- [ ] Update `app/worker/sync_tasks.py` if needed for Snowflake sync
- [ ] Update test files in `app/tests/` for sync patterns

### 9. Production Deployment
- [ ] Update deployment configuration (Docker, CloudRun, etc.)
- [ ] Set environment variables in production:
  ```bash
  export DATABASE_URL="postgresql://..."
  ```
- [ ] Ensure database backups are configured in Supabase
- [ ] Set up monitoring/alerts in Supabase console
- [ ] Update CI/CD pipelines to use new dependencies

### 10. Verification & Rollback
- [ ] Verify all endpoints working in production
- [ ] Check logs for any connection issues
- [ ] Monitor database performance
- [ ] Have rollback plan ready (keep old Digital Ocean DB available for brief period)

## 🚀 Quick Commands Reference

```bash
# Install dependencies
pip install -r requirements.txt

# Test connection
python -c "from app.database import engine; print(engine.connect())"

# Run migrations
alembic upgrade head

# Start app
uvicorn app.main:app --reload

# Run tests
pytest tests/

# See database tables
python -c "from app.database import engine, inspect; print(inspect(engine).get_table_names())"
```

## 📊 Migration Statistics

- **Files Modified**: 25+
- **Async→Sync Conversions**: 20+ functions
- **Dependencies Updated**: 2 (asyncpg→psycopg, sqlalchemy)
- **Database Type**: No change (still PostgreSQL, just hosted by Supabase)
- **Expected Downtime**: Minimal (during migration only)

## ⚠️ Common Gotchas

1. **Connection Pool Exhaustion**: If you see "QueuePool limit exceeded", increase pool_size in database.py
2. **Transaction Issues**: Ensure all session.commit() calls are present (they're required now for sync)
3. **UUID Format**: Make sure all models use `Uuid(as_uuid=True)` not `UUID()`
4. **Import Errors**: Clear Python cache if getting old async imports

## 📞 Need Help?

If you encounter issues:

1. Check [SUPABASE_MIGRATION_GUIDE.md](SUPABASE_MIGRATION_GUIDE.md) for detailed info
2. Check [REMAINING_WORK.md](REMAINING_WORK.md) for pending tasks
3. Review [MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md) for full context
4. Check Supabase logs: Dashboard → Logs
5. Check application logs: `tail -f app.log`

## ✨ Success Indicators

- [ ] Database connection successful
- [ ] Migrations applied without errors
- [ ] Application starts without errors
- [ ] Health endpoint returns 200
- [ ] Can create and retrieve users
- [ ] Can create and retrieve goals
- [ ] No async/await errors in logs
- [ ] Data persists between requests

Once all items are checked, your Supabase migration is complete! 🎉
