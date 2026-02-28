# Goal Tracking App - Architecture & Setup Guide

## System Overview

The Goal Tracking App uses a **multi-layer architecture** combining:
- **FastAPI** backend with async database operations
- **PostgreSQL** for operational data (immediate writes)
- **Snowflake** for analytics and mentor insights (read-only)
- **Gemini AI** for goal planning and accountability coaching
- **Celery** for background tasks and scheduled reviews

### High-Level Flow

```
User Action
    ↓
FastAPI Endpoint
    ↓
PostgreSQL (Transactional)
    ↓
Celery Task (Async)
    ↓
Gemini API (AI Generation)
    ↓
Back to PostgreSQL + Snowflake (Sync)
```

## Architecture Components

### 1. **Member/Group Side: Goal Planning & Coaching**

#### Flow: User Creates Goal
```
POST /goals/
├─ User describes goal in natural language
├─ Gemini generates structured plan
│  └─ Returns: goal, subgoals, habits
├─ Store in PostgreSQL:
│  ├─ goals table (title, category, ai_plan)
│  ├─ subgoals table (linked to goal)
│  └─ habits table (frequency, schedule)
└─ Response: Detailed goal with AI plan
```

#### Flow: Daily Check-ins & Coaching
```
POST /chat/
├─ User sends message about progress
├─ Load context from PostgreSQL:
│  ├─ User's goals (last 30 days)
│  ├─ Recent check-ins (completion ratio)
│  ├─ Previous messages (conversation history)
│  └─ Streaks and milestones
├─ Call Gemini with:
│  ├─ System instruction (Group accountability coach)
│  ├─ Serialized context
│  └─ Latest user message
├─ Store AI reply in PostgreSQL (messages table)
└─ Response: Coaching message + action steps
```

### 2. **Mentor Side: AI-Assisted Patient Oversight**

#### Flow: Mentor Checks Patient Status
```
POST /mentor/chat/
├─ Mentor sends observation/question about patient
├─ Load context from multiple sources:
│  ├─ PostgreSQL (Operational):
│  │  ├─ Current plan/goals
│  │  ├─ Last 7 check-ins
│  │  ├─ Recent journal entries
│  │  └─ Last mentor notes
│  │
│  └─ Snowflake (Analytics):
│     ├─ 7/30/90-day adherence scores
│     ├─ Risk flags (low/medium/high)
│     ├─ Miss streaks and patterns
│     └─ Mood trends from journal
├─ Call Gemini with:
│  ├─ System instruction (Mentor copilot, no diagnosis)
│  ├─ Contextualized data from both sources
│  └─ Mentor's message
├─ Gemini returns:
│  ├─ Coaching message
│  ├─ Suggested action plan (JSON)
│  └─ Identified risk patterns
├─ Store audit trail in PostgreSQL:
│  └─ mentor_interactions table
└─ Response: Reply + sources used + suggestions
```

### 3. **Data Pipeline: PostgreSQL → Snowflake**

#### Sync Process (Every 5 minutes)
```
Sync Task (Celery + APScheduler)
    ↓
PostgreSQL
├─ users (new/updated)
├─ goals (new/updated)
├─ checkins (only unsynced)
└─ journal_entries (new/updated)
    ↓
Transform (JSON → Relational)
    ↓
Snowflake
├─ dim_users (SCD-2)
├─ dim_goals (SCD-2)
├─ fact_checkins (incremental)
└─ fact_journal_entries (incremental)
    ↓
Compute Metrics
├─ metrics_adherence (7d, 30d, 90d)
├─ metrics_streak (current, longest)
└─ metrics_risk (risk_level, risk_score)
    ↓
Update Views
└─ mentor_dashboard (pre-computed for fast queries)
```

#### Tables

**PostgreSQL (Operational)**
```
users
├─ id (UUID PK)
├─ name, mentor_id
├─ created_at, updated_at

goals
├─ id (UUID PK)
├─ user_id (FK users)
├─ title, category, frequency
├─ ai_plan (JSON from Gemini)
├─ start_date, end_date

subgoals
├─ id (UUID PK)
├─ goal_id (FK goals)
├─ title, status, order

habits
├─ id (UUID PK)
├─ goal_id (FK goals)
├─ title, frequency, schedule (JSON)

checkins
├─ id (UUID PK)
├─ goal_id (FK goals), user_id (FK users)
├─ completed (boolean)
├─ synced_to_snowflake (flag)
├─ created_at, updated_at

messages
├─ id (UUID PK)
├─ user_id (FK users)
├─ user_message, ai_reply
├─ message_type (chat, coach_post, suggestion)
├─ context_used (JSON audit)

journal_entries
├─ id (UUID PK)
├─ user_id (FK users)
├─ text, sentiment_score
├─ mood_tags (JSON)

mentor_interactions
├─ id (UUID PK)
├─ mentor_id, patient_id (FK users)
├─ mentor_message, ai_reply
├─ sources_used (JSON)
├─ plan_patch (JSON suggestions)
```

**Snowflake (Analytics)**
```
dim_users
├─ user_id (STRING PK)
├─ mentor_id, name
├─ created_at

dim_goals
├─ goal_id (STRING PK)
├─ user_id (FK dim_users)
├─ title, category, frequency

fact_checkins
├─ checkin_id (STRING PK)
├─ goal_id (FK dim_goals)
├─ user_id (FK dim_users)
├─ completed (BOOLEAN)
├─ timestamp

fact_journal_entries
├─ entry_id (STRING PK)
├─ user_id (FK dim_users)
├─ text, sentiment_score
├─ mood_tags (VARIANT/JSON)

metrics_adherence
├─ user_id, metric_date (COMPOUND PK)
├─ adherence_7d, 30d, 90d (%)
├─ checkins_completed_7d, total_7d

metrics_streak
├─ user_id (PK)
├─ current_streak, longest_streak
├─ last_completion

metrics_risk
├─ user_id (PK)
├─ risk_level (low/medium/high)
├─ risk_score (0-1)
├─ missed_count_3d, 7d
├─ last_checkin_days_ago

mentor_dashboard (VIEW)
- Pre-joins all dimensions + metrics
- Sorted by risk_score DESC, adherence ASC
```

## Setup Instructions

### Prerequisites
- Python 3.10+
- PostgreSQL 14+
- Snowflake account
- Redis for Celery
- Google Cloud credentials (Gemini API key)

### 1. Environment Setup

Create `.env` file in `backend/`:
```bash
# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost/goaltracking

# Snowflake
SNOWFLAKE_USER=your_email@company.com
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_ACCOUNT=your_account_id
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
SNOWFLAKE_DATABASE=ANALYTICS_DB
SNOWFLAKE_SCHEMA=PUBLIC

# Redis (for Celery)
REDIS_URL=redis://localhost:6379/0

# Gemini
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 3. Database Setup

**PostgreSQL:**
```bash
# Create database
createdb goaltracking

# Alembic migrations (upcoming)
alembic upgrade head

# Or run seed data
python scripts/seed_data.py
```

**Snowflake:**
```bash
# Initialize schema (one-time)
python -c "from app.utils.snowflake_utils import initialize_snowflake_schema; initialize_snowflake_schema()"
```

### 4. Start Services

**FastAPI Server:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Celery Worker:**
```bash
cd backend
celery -A worker.celery_app worker --loglevel=info
```

**Celery Beat (Task Scheduler):**
```bash
cd backend
celery -A worker.celery_app beat --loglevel=info
```

### 5. Configure Scheduled Tasks

In `worker/celery_app.py`, add beat schedule:
```python
from celery.schedules import crontab

app.conf.beat_schedule = {
    'sync-to-snowflake': {
        'task': 'worker.sync_tasks.sync_all_data_to_snowflake',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
    'weekly-goal-review': {
        'task': 'worker.review_tasks.weekly_goal_review',
        'schedule': crontab(day_of_week=0, hour=9, minute=0),  # Monday 9 AM
    },
    'daily-reminder': {
        'task': 'worker.review_tasks.daily_goal_reminder',
        'schedule': crontab(hour=7, minute=0),  # 7 AM daily
    },
    'compute-adherence': {
        'task': 'worker.sync_tasks.compute_adherence_scores',
        'schedule': crontab(hour='*/6'),  # Every 6 hours
    },
    'compute-risk': {
        'task': 'worker.sync_tasks.compute_risk_metrics',
        'schedule': crontab(hour='*/4'),  # Every 4 hours
    },
}
```

## API Reference

### Member/User Endpoints

**Create Goal**
```
POST /goals/
Content-Type: application/json

{
  "user_id": "uuid",
  "title": "Get fit",
  "description": "Run 3x per week",
  "category": "fitness",
  "frequency": "thrice_weekly",
  "constraints": {
    "time_per_week": 120,
    "deadline": "2026-06-30"
  }
}
```

**Chat/Accountability Coach**
```
POST /chat/
Content-Type: application/json

{
  "user_id": "uuid",
  "group_id": "uuid (optional)",
  "message": "Had two great runs this week but skipped Wednesday"
}
```

Response:
```json
{
  "user_message": "...",
  "ai_reply": "Great effort! You're at 66% completion. Here's...",
  "timestamp": "2026-02-28T10:30:00Z"
}
```

**Check-in**
```
POST /goals/{goal_id}/checkin?user_id=uuid&completed=true
```

### Mentor Endpoints

**Mentor Chat**
```
POST /mentor/chat/
Content-Type: application/json

{
  "mentor_id": "uuid",
  "patient_id": "uuid",
  "message": "I noticed 2 missed goals this week",
  "mode": "quick_check"  # or "deep_dive", "risk_intervention"
}
```

Response:
```json
{
  "ai_reply": "Data shows: missed 3/5 goals, mood trending down...",
  "sources_used": ["postgresql", "snowflake"],
  "suggested_actions": [
    "Reduce frequency from daily to 5x/week",
    "Add 15-min buffer time before each checkpoint"
  ],
  "timestamp": "2026-02-28T10:30:00Z"
}
```

**List Patients**
```
GET /mentor/chat/{mentor_id}/patients
```

Response:
```json
[
  {
    "id": "uuid",
    "name": "Alice Chen",
    "analytics": {
      "adherence_7d": 71.4,
      "risk_level": "medium",
      "risk_score": 0.55,
      "missed_count_7d": 2,
      "days_since_checkin": 1
    }
  }
]
```

### Dashboard/Analytics

**User Dashboard**
```
GET /dashboard/user/{user_id}/goals
```

Returns user's goals + completion stats + streak.

**Mentor Dashboard**
```
GET /dashboard/mentor/{mentor_id}/patient/{user_id}
```

Returns comprehensive view with Postgres + Snowflake data.

## Celery Tasks

### Sync Tasks
- `sync_all_data_to_snowflake()` - Master sync every 5 min
- `compute_adherence_scores()` - Aggregate adherence metrics every 6 hours
- `compute_risk_metrics()` - Risk detection every 4 hours

### Review/Generation Tasks
- `weekly_goal_review()` - Generate AI coach posts (weekly)
- `daily_goal_reminder()` - Send reminders (daily)
- `generate_plan_suggestions()` - Propose goal adjustments
- `monthly_progress_report()` - Comprehensive reports (monthly)

## Performance Considerations

### Database
- Use connection pooling on PostgreSQL (async)
- Indexes on `user_id`, `goal_id`, `timestamp`
- Archive old check-ins to cold storage quarterly

### Snowflake
- Use X-Small warehouse for analytics queries
- Auto-suspend after 60 seconds
- Partition `fact_checkins` by `USER_ID`
- Pre-compute `mentor_dashboard` view hourly

### Caching
- Cache user context in Redis (TTL: 5 min)
- Cache mentor dashboard results (TTL: 15 min)
- Invalidate on new check-in

### Gemini Calls
- Batch requests in background tasks
- Cache system instructions
- Implement rate limiting (100 req/min)
- Handle API errors gracefully with fallback messages

## Security

### PostgreSQL
- Use environment variables for credentials
- Implement row-level security (user_id-based)
- Encrypt sensitive fields (journal entries)

### Snowflake
- Create read-only role for backend API
- Use separate warehouse for analytics
- Rotate credentials every 90 days
- VPC endpoint for private connectivity

### API
- Implement JWT authentication
- Rate limit: 10 req/sec per user
- Validate input (Pydantic schemas)
- Log all mentor interactions for audit

## Future Enhancements

1. **Mobile App** - React Native frontend
2. **Email Notifications** - SendGrid integration
3. **Habit Streaks Visualization** - D3.js charts
4. **Peer Accountability Groups** - Group messaging + leaderboards
5. **ML Risk Prediction** - Snowflake ML for early intervention
6. **Voice Check-ins** - Whisper API for audio transcription
7. **Wearable Integration** - Fitbit/Apple Health data sync
8. **Multi-language Support** - Gemini translation

## Troubleshooting

### "Snowflake connection refused"
- Check `SNOWFLAKE_ACCOUNT` format (should be `xy45678.us-east-1`)
- Verify credentials in `.env`
- Test: `python -c "from app.database import get_snowflake_connection; get_snowflake_connection()"`

### "Gemini API rate limit"
- Check `GEMINI_API_KEY` is set
- Verify billing enabled in Google Cloud
- Check quota: 60 req/min (Gemini 1.5 Free)

### "Celery task not running"
- Start Celery worker: `celery -A worker.celery_app worker`
- Check Redis connection: `redis-cli PING`
- View logs: `celery -A worker.celery_app events`

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines.
