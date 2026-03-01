# Goal Tracking App - Backend API

A sophisticated goal-tracking platform with **AI-powered coaching**, **mentor oversight**, and **data analytics** using Gemini, PostgreSQL, and Snowflake.

## 🎯 Key Features

### For Members
- **AI Goal Planning** - Describe goals naturally, Gemini generates structured plans with subgoals and habits
- **Daily Accountability Coach** - Chat with AI coach about progress; get personalized encouragement and action steps
- **Check-ins & Streaks** - Log daily progress, track completion streaks and adherence
- **Group Feeds** - See AI-generated coaching posts and milestone celebrations
- **Plan Suggestions** - AI recommends adjustments based on your performance patterns

### For Mentors
- **Patient Dashboard** - Comprehensive view of each mentee's progress from PostgreSQL + analytics from Snowflake
- **AI-Assisted Insights** - Ask questions, get data-backed coaching suggestions with sources cited
- **Risk Detection** - Automatic alerting for users with low adherence or prolonged inactivity
- **Audit Trail** - All mentor-AI interactions logged for accountability

### For Data
- **Real-time PostgreSQL** - Fast writes and immediate user feedback
- **Snowflake Analytics** - Pre-computed adherence scores, risk metrics, and trends
- **Automated Sync** - Every 5 minutes, PostgreSQL syncs to Snowflake for analytics
- **Scalable Design** - Handles thousands of users and daily check-ins efficiently

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React/Mobile)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌────────────────┬────────────────┬──────────────────┐     │
│  │ /goals/        │ /chat/         │ /mentor/chat/    │     │
│  │ /checkin/      │ /dashboard/    │ /analytics/      │     │
│  └────────────────┴────────────────┴──────────────────┘     │
└──────────┬──────────────────────────────┬────────────────────┘
           │                              │
    ┌──────▼──────┐            ┌──────────▼─────────┐
    │ PostgreSQL  │            │  Gemini API        │
    │ (Transact.) │  ◄────────►│  (AI Generation)   │
    └──────┬──────┘            └────────────────────┘
           │
    ┌──────▼──────────────────────┐
    │  Celery + Redis (Tasks)      │
    │  ├─ sync_tasks              │
    │  ├─ review_tasks            │
    │  └─ (5-min, daily, weekly)  │
    └──────┬──────────────────────┘
           │
    ┌──────▼─────────────────────┐
    │    Snowflake Analytics      │
    │  ├─ dim_users, dim_goals    │
    │  ├─ fact_checkins           │
    │  ├─ metrics_adherence       │
    │  ├─ metrics_risk            │
    │  └─ mentor_dashboard (VIEW) │
    └─────────────────────────────┘
```

## 📦 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **API Server** | FastAPI + Uvicorn | HTTP endpoints, request handling |
| **DB (Transactional)** | PostgreSQL + SQLAlchemy async | User data, goals, check-ins, messages |
| **DB (Analytics)** | Snowflake | Analytics, aggregations, mentor dashboard |
| **Task Queue** | Celery + Redis | Background jobs: sync, reviews, reminders |
| **AI** | Google Gemini API | Goal planning, coaching, mentor insights |
| **Validation** | Pydantic | Request/response schemas |
| **Async** | asyncpg | Non-blocking database access |

## 🚀 Quick Start

### 1. Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
pip install -r requirements.txt
```

### 2. Run Services
```bash
# Terminal 1: API Server
uvicorn app.main:app --reload

# Terminal 2: Redis (if not already running via Homebrew)
redis-server

# Terminal 3: Celery Worker (run from backend/)
PYTHONPATH=. celery -A worker.celery_app worker --loglevel=info -Q sync,reviews,celery

# Terminal 4: Celery Beat / Scheduler (run from backend/)
PYTHONPATH=. celery -A worker.celery_app beat --loglevel=info
```

> **Note:** `PYTHONPATH=.` and `-Q sync,reviews,celery` are required. Without them the worker won't find the task modules or consume from the correct queues.

### 3. Trigger a manual sync
```bash
# From backend/
PYTHONPATH=. python -c "
from worker.sync_tasks import sync_postgres_to_snowflake
import json
print(json.dumps(sync_postgres_to_snowflake(), indent=2, default=str))
"
```

### 3. Test
```bash
# API docs: http://localhost:8000/docs
# Health: curl http://localhost:8000/health
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed instructions.

## 📚 API Documentation

### Core Endpoints

#### **Goals**
```
POST   /goals/              Create goal (with Gemini planning)
GET    /goals/{goal_id}     Get goal details + plan
GET    /goals/user/{user_id} Get all user goals
PUT    /goals/{goal_id}     Update goal
DELETE /goals/{goal_id}     Delete goal
POST   /goals/{goal_id}/checkin  Log completion
```

#### **Chat (Accountability Coach)**
```
POST   /chat/               Send message, get AI coaching
GET    /chat/{user_id}/history  Get conversation history
```

#### **Mentor**
```
POST   /mentor/chat/        Mentor asks about patient, get AI insights
GET    /mentor/chat/{mentor_id}/patients  List all mentees
GET    /mentor/chat/{mentor_id}/interactions/{patient_id}  View history
```

#### **Dashboard**
```
GET    /dashboard/user/{user_id}/goals        User's goal summary
GET    /dashboard/mentor/{mentor_id}/patient/{user_id}  Mentor view (Postgres + Snowflake)
GET    /dashboard/analytics/{user_id}         Raw analytics from Snowflake
```

#### **Members**
```
POST   /members/            Create member
GET    /members/{id}        Get member
GET    /members/            List all
PUT    /members/{id}        Update member
DELETE /members/{id}        Delete member
```

Full docs with request/response examples at **http://localhost:8000/docs**

## 🔄 Data Flow Examples

### Example 1: User Creates Goal
```
1. User: "I want to run 3x per week"
2. POST /goals/ with description
3. Gemini generates: {
     "goal": "Build running habit",
     "subgoals": [
       "Week 1-2: Run 2x per week",
       "Week 3-4: Run 3x per week"
     ],
     "habits": [
       {"title": "Mon 30min run", "frequency": "weekly"},
       {"title": "Wed 30min run", "frequency": "weekly"},
       {"title": "Fri 30min run", "frequency": "weekly"}
     ]
   }
4. Stored in PostgreSQL: goals, subgoals, habits tables
5. Response: Full plan with AI insights
```

### Example 2: User Chats with Coach
```
1. User: POST /chat/ → "Ran Mon & Wed, missed Friday"
2. Backend: Load context from PostgreSQL
   - Last 7 days checkins: [✓ Mon, ✗ Tue, ✓ Wed, ✗ Thu, ✗ Fri, ...]
   - Streak: 2 consecutive days
   - Completion: 33%
3. Call Gemini with context + message
4. Gemini: "Nice work! 2/3 days is progress. For Friday, try..."
5. Store both messages in PostgreSQL
6. Response: AI coaching message
```

### Example 3: Mentor Checks Patient
```
1. Mentor: POST /mentor/chat/ → "How's Sarah doing?"
2. Backend loads from PostgreSQL:
   - Goals: "Exercise 3x/week", "Read daily"
   - Last 7 checkins: 4/14 completed (29% adherence)
   - Recent messages: "Feeling tired this week"
3. Backend loads from Snowflake:
   - Adherence 7d: 29%, 30d: 45%
   - Risk score: 0.65 (MEDIUM risk)
   - Streak: 0 days
4. Call Gemini: "Sarah's adherence is down 16% month-on-month.
   Recent message suggests fatigue. Consider reducing frequency
   or checking in on energy levels."
5. Store interaction in mentor_interactions table
6. Response: AI insight + suggested actions
```

### Example 4: Nightly Sync & Reviews
```
Celery Beat triggers at 1 AM (UTC):

1. sync_all_data_to_snowflake():
   - Copy new/updated PostgreSQL rows to Snowflake
   - Users, Goals, Checkins, Journals → dim/fact tables
   - Takes ~2 minutes for 1000s of records

2. compute_adherence_scores():
   - Snowflake computes 7d, 30d, 90d adherence for all users
   - Update metrics_adherence table

3. compute_risk_metrics():
   - Detect users with missed patterns
   - Flag high-risk patients for mentor attention

4. daily_goal_reminder():
   - Message each user with incomplete goals today
   - "You have 2 incomplete goals. Let's finish strong!"

5. weekly_goal_review() (Mondays 9 AM):
   - Load context for each user
   - Call Gemini to generate group coaching post
   - "This week, you all improved 12% on average..."
   - Post to group_feed_posts table

All logged and auditable.
```

## 📊 Database Schema

### PostgreSQL (Operational)

**Dimensions:**
```sql
users(id, name, mentor_id, created_at, updated_at)
goals(id, user_id, title, category, frequency, ai_plan, start_date, end_date, ...)
subgoals(id, goal_id, title, status, order, ...)
habits(id, goal_id, title, frequency, schedule, ...)
```

**Facts:**
```sql
checkins(id, goal_id, user_id, completed, notes, timestamp, synced_to_snowflake, ...)
messages(id, user_id, group_id, user_message, ai_reply, message_type, context_used, ...)
journal_entries(id, user_id, text, sentiment_score, mood_tags, ...)
group_feed_posts(id, group_id, user_id, content, post_type, metadata, ...)
goal_plan_suggestions(id, goal_id, user_id, suggestion_type, ai_suggestion, accepted, ...)
mentor_interactions(id, mentor_id, patient_id, mode, mentor_message, ai_reply, 
                   sources_used, plan_patch, task_list, ...)
```

### Snowflake (Analytics)

**Dimension Tables:**
```sql
dim_users(user_id, mentor_id, name, created_at)
dim_goals(goal_id, user_id, title, category, frequency, created_at)
```

**Fact Tables:**
```sql
fact_checkins(checkin_id, goal_id, user_id, completed, timestamp, created_at)
fact_journal_entries(entry_id, user_id, text, sentiment_score, mood_tags, created_at)
```

**Metrics Tables:**
```sql
metrics_adherence(user_id, metric_date, adherence_7d, adherence_30d, adherence_90d, ...)
metrics_streak(user_id, current_streak, longest_streak, last_completion, ...)
metrics_risk(user_id, risk_level, risk_score, missed_count_3d, missed_count_7d, ...)
```

**Views:**
```sql
mentor_dashboard (pre-joined dim + metrics, sorted by risk)
```

## ⚙️ Configuration & Scheduling

Celery beat runs these tasks:

| Task | Schedule | Purpose |
|------|----------|---------|
| `sync_all_data_to_snowflake` | Every 2 min | PostgreSQL → Snowflake |
| `compute_adherence_scores` | Every 6 hours | Update adherence % |
| `compute_risk_metrics` | Every 4 hours | Detect at-risk users |
| `daily_goal_reminder` | 7 AM UTC | Daily motivation |
| `weekly_goal_review` | Mon 9 AM | AI coaching post |
| `generate_plan_suggestions` | Wed 10 AM | Suggest adjustments |
| `monthly_progress_report` | 1st, 8 AM | Monthly summary |

Configure in [worker/celery_app.py](./worker/celery_app.py)

## 🔐 Security

- **Authentication**: JWT tokens (implement in frontend)
- **Database**: PostgreSQL row-level security, encrypted fields
- **Snowflake**: Read-only role for backend, VPC endpoint
- **Audit**: All mentor interactions logged
- **Validation**: Pydantic schemas, input sanitization
- **Secrets**: Environment variables (.env), never commit

## 📈 Performance Optimization

### Database
- Connection pooling on PostgreSQL (async)
- Indexes on user_id, goal_id, timestamp
- Archive old checkins quarterly

### Caching
- Redis cache for user context (5 min TTL)
- Snowflake mat views for dashboard (15 min refresh)

### API
- Pagination on list endpoints
- Async queries with selectinload for relationships
- Response compression (gzip)

### Gemini
- Batch requests in background tasks
- Cache system instructions
- Rate limiting: 100 req/min

## 🧪 Testing

```bash
# Run tests
pytest tests/

# With coverage
pytest --cov=app tests/

# Specific test
pytest tests/test_member.py::TestMemberEndpoints::test_create_member
```

Current test files:
- `tests/test_member.py` - Member CRUD operations
- `tests/test_mentor.py` - Mentor endpoints

## 📖 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Full system design
- **[QUICKSTART.md](./QUICKSTART.md)** - Getting started
- **API Docs** - http://localhost:8000/docs (auto-generated Swagger)

## 🔧 Troubleshooting

### PostgreSQL connection failed
```bash
psql -U postgres -h localhost  # Test connection
createdb goaltracking          # Create DB
```

### Snowflake connection failed
- Check account format in `.env` (e.g., `xy12345.us-east-1`)
- Verify credentials are correct
- Test: `python -c "from app.database import get_snowflake_connection; get_snowflake_connection()"`

### Gemini API errors
- Free tier: 60 req/min limit
- Check API key in `.env`: https://aistudio.google.com
- Verify billing enabled in Google Cloud

### Celery tasks not running
```bash
# Check Redis connection
redis-cli PING  # Should return PONG

# View active tasks
celery -A worker.celery_app inspect active

# Check worker logs
celery -A worker.celery_app worker --loglevel=debug
```

## 📝 Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes, add tests
3. Run: `pytest` and `black app/ worker/`
4. Commit with clear messages
5. Push and create PR

## 📄 License

MIT License - See [LICENSE](../LICENSE)

## 👥 Support

- **Discord**: [Link to Discord]
- **Email**: support@goaltracking.app
- **Docs**: This README + ARCHITECTURE.md + API docs

---

**Last Updated**: February 28, 2026
**Version**: 1.0.0  
**Status**: Production Ready
