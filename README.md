# Flock — Goal Tracking App

A full-stack goal-tracking platform with AI-powered coaching, mentor oversight, and data analytics.

## Overview

Flock helps users set and achieve goals through daily accountability check-ins, an AI coaching chat, and transparent progress reporting to a designated mentor or accountability partner. Mentors get a data-rich dashboard and their own AI copilot backed by both real-time and analytics data.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Frontend  (React 18 + Vite + Tailwind)          │
└──────────────────────────┬──────────────────────────────────┘
                           │ REST
┌──────────────────────────▼──────────────────────────────────┐
│                    FastAPI Backend (Python 3.10+)            │
│  /goals/   /chat/   /coach/   /mentor/   /mentor/chat/       │
│  /dashboard/   /checkin/   /member/   /snowflake/            │
└──────────┬──────────────────────────┬────────────────────────┘
           │                          │
    ┌──────▼──────┐          ┌────────▼──────────┐
    │  Supabase   │          │   Gemini API       │
    │ (PostgreSQL)│          │  (AI Generation)   │
    └──────┬──────┘          └───────────────────┘
           │
    ┌──────▼──────────────────────┐
    │   Celery + Redis (Workers)  │
    │   ├─ sync_tasks (5 min)     │
    │   ├─ review_tasks (daily)   │
    │   └─ reminder_tasks         │
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
           │ MCP stdio
    ┌──────▼──────────────────────┐
    │   MCP Server (mcp_server.py)│
    │   Tools: user/group context │
    │   for LLM integrations      │
    └─────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS v4, Radix UI, Recharts, React Router v7 |
| **Backend** | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy (async) |
| **Database (Transactional)** | Supabase (PostgreSQL), psycopg3 |
| **Database (Analytics)** | Snowflake (read-only) |
| **Task Queue** | Celery + Redis |
| **AI** | Google Gemini API |
| **MCP Server** | `mcp[cli]` — exposes Snowflake/Supabase data as MCP tools |
| **Auth** | Supabase Auth |

## Features

### Member
- **AI Goal Planning** — describe a goal in natural language; Gemini generates a structured plan with subgoals and habits
- **Daily Check-ins** — log progress per goal; streaks and adherence tracked automatically
- **AI Accountability Coach** — chat with a context-aware coach that knows your goals and history
- **Calendar View** — visualise check-in history across goals
- **Groups** — shared group feeds with AI-generated coaching posts and milestone celebrations
- **Profile** — account management and goal overview

### Mentor
- **Patient Dashboard** — real-time and Snowflake-powered analytics per mentee
- **AI Copilot** — mentor chat backed by 7/30/90-day adherence scores, risk flags, mood trends
- **Risk Detection** — automatic alerts for low adherence or prolonged inactivity
- **Audit Trail** — all mentor–AI interactions logged

### Platform
- **Automated Sync** — PostgreSQL → Snowflake every 5 minutes via Celery
- **MCP Server** — exposes user/group context as MCP tools for LLM integrations (Claude Desktop, etc.)
- **Background Reviews** — daily AI-generated progress summaries and weekly reports via Celery Beat

## Running the App

### Prerequisites

- Python 3.10+
- Node.js 18+
- Redis (`brew install redis` / `apt install redis-server`)
- Supabase project (or local PostgreSQL)
- Snowflake account (optional — analytics features degrade gracefully without it)
- Google Gemini API key

### 1. Clone & configure

```bash
git clone https://github.com/SomaOhm/Goal-Tracking-App.git
cd Goal-Tracking-App
```

**Backend env** — create `backend/.env`:
```bash
DATABASE_URL=postgresql://postgres:<password>@<supabase-host>:5432/postgres
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=<your-key>

# Optional — Snowflake analytics
SNOWFLAKE_ACCOUNT=<account>
SNOWFLAKE_USER=<user>
SNOWFLAKE_PASSWORD=<password>
SNOWFLAKE_DATABASE=GOAL_TRACKING
SNOWFLAKE_SCHEMA=ANALYTICS
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
```

**Frontend env** — create `frontend/.env`:
```bash
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_API_URL=http://localhost:8000
```

### 2. Database setup

Run `database/supabase-schema.sql` in the Supabase SQL Editor (or against your local PostgreSQL) to create all tables, RLS policies, and triggers.

```bash
# Optional: seed sample data
cd backend
python scripts/seed_data.py
```

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# API server
uvicorn app.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger UI)
```

### 4. Celery workers (optional — required for sync & AI reviews)

```bash
# Terminal 2 — start Redis
redis-server

# Terminal 3 — Celery worker
cd backend
celery -A worker.celery_app worker --loglevel=info

# Terminal 4 — Celery Beat scheduler
cd backend
celery -A worker.celery_app beat --loglevel=info
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 6. MCP Server (optional — for LLM tool integrations)

```bash
# Requires the FastAPI server to be running on :8000
npx @modelcontextprotocol/inspector python backend/mcp_server.py
# or
mcp dev backend/mcp_server.py
```

## Project Structure

```
Goal-Tracking-App/
├── frontend/                  # React + Vite app
│   └── src/app/
│       ├── pages/             # Home, Chat, Calendar, Groups, Profile
│       ├── components/        # BottomNav, FAB, WelcomeDialog, UI primitives
│       ├── context/           # AppContext (global state)
│       └── lib/               # Supabase + Gemini clients
├── backend/
│   ├── app/
│   │   ├── api/               # Route handlers (goals, chat, mentor, coach, snowflake…)
│   │   ├── repositories/      # Data access layer (goal, checkin, message, user)
│   │   ├── services/          # Business logic (goal, coach, mentor, analytics, gemini)
│   │   ├── schemas/           # Pydantic request/response models
│   │   └── utils/             # Context builder, sentiment, Snowflake utils
│   ├── worker/                # Celery tasks (sync, reviews, reminders)
│   ├── scripts/               # seed_data.py, manual_sync.py
│   ├── alembic/               # DB migrations
│   └── mcp_server.py          # MCP stdio server (user/group context tools)
├── database/
│   ├── supabase-schema.sql    # Full schema, RLS policies, triggers
│   └── seed-*.sql             # Sample coach and group data
└── guidelines/
    └── Guidelines.md          # Design and UX guidelines
```
