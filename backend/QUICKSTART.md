# Quick Start Guide

## 5-Minute Setup for Development

### 1. Prerequisites
```bash
# Check Python version (need 3.10+)
python --version

# Install PostgreSQL (if not already installed)
# macOS: brew install postgresql@14
# Ubuntu: sudo apt install postgresql-14
# Windows: Download from postgresql.org

# Install Redis (for Celery)
# macOS: brew install redis
# Ubuntu: sudo apt install redis-server
# Windows: Download from redis.io or use WSL
```

### 2. Clone & Install
```bash
git clone https://github.com/SomaOhm/Goal-Tracking-App.git
cd Goal-Tracking-App/backend

# Copy environment template
cp .env.example .env

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure `.env`
Edit `backend/.env` and update:
- `DATABASE_URL` - your local PostgreSQL
- `SNOWFLAKE_*` - your Snowflake credentials (or comment out for now)
- `REDIS_URL` - keep as `redis://localhost:6379/0`
- `GEMINI_API_KEY` - from https://aistudio.google.com

```bash
# Minimal .env for local development:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/goaltracking
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=your_key_here
```

### 4. Database Setup
```bash
# Create PostgreSQL database
createdb goaltracking

# Run migrations (if available)
alembic upgrade head

# Or seed with sample data
python scripts/seed_data.py
```

### 5. Start Services

**Terminal 1 - FastAPI Server:**
```bash
cd backend
uvicorn app.main:app --reload
# Server at http://localhost:8000
# Docs at http://localhost:8000/docs
```

**Terminal 2 - Redis:**
```bash
redis-server
# Or if using Docker: docker run -p 6379:6379 redis:latest
```

**Terminal 3 - Celery Worker:**
```bash
cd backend
celery -A worker.celery_app worker --loglevel=info
```

**Terminal 4 - Celery Beat (Scheduler):**
```bash
cd backend
celery -A worker.celery_app beat --loglevel=info
```

### 6. Test It Out

**Create a Goal:**
```bash
curl -X POST http://localhost:8000/goals/ \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Exercise 3x weekly",
    "category": "fitness",
    "frequency": "thrice_weekly",
    "description": "30-min runs"
  }'
```

**Chat with Coach:**
```bash
curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "message": "I ran yesterday and today!"
  }'
```

**View API Docs:**
Open http://localhost:8000/docs in browser

## Docker Setup (Optional)

```bash
# Build and run everything in containers
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

## Troubleshooting

### PostgreSQL connection failed
```bash
# Check PostgreSQL is running
psql -U postgres

# Create database if needed
createdb goaltracking

# Check environment
echo $DATABASE_URL
```

### Redis connection failed
```bash
# Check Redis is running
redis-cli PING
# Should return: PONG

# If not installed:
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo systemctl start redis-server
```

### Gemini API key error
- Get free key from https://aistudio.google.com
- Click "Get API key"
- Paste in `.env` as `GEMINI_API_KEY=...`

### Celery task not running
```bash
# Check Redis connection in Celery worker logs
# Make sure Beat scheduler is running
celery -A worker.celery_app beat

# Check task queue
celery -A worker.celery_app inspect active
```

## Next Steps

1. **Explore the API** at http://localhost:8000/docs
2. **Read** [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. **Check** [app/api/](./app/api/) for endpoint implementations
4. **Run tests** with `pytest` (when available)
5. **Deploy** to production (see Deployment docs)

## Common Commands

```bash
# Run specific Celery task
celery -A worker.celery_app call worker.sync_tasks.sync_all_data_to_snowflake

# View Celery events in real-time
celery -A worker.celery_app events

# Purge all tasks from queue
celery -A worker.celery_app purge

# Check database
psql goaltracking -c "SELECT count(*) FROM goals;"

# Reset database
dropdb goaltracking && createdb goaltracking && python scripts/seed_data.py
```

## Support

- 📚 API Docs: http://localhost:8000/docs
- 🏗️ Architecture: [ARCHITECTURE.md](./ARCHITECTURE.md)
- 🐛 Issues: GitHub issues
- 💬 Discussions: GitHub discussions
