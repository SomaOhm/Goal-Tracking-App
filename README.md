# Goal-Tracking-App

## Project Overview

### Goal
Build a mobile application that helps users set and achieve goals by adding accountability via automated reporting to a designated mentor, therapist, or accountability partner.

### Target Audience
People who want to establish and maintain habits, track personal goals (mental health, fitness, productivity), and benefit from external accountability.

### Core Value Proposition
A seamless goal-tracking experience paired with a transparent, automated accountability loop to an external professional or partner. Includes an integrated reflective diary and an AI chat agent for internal guidance and support.

### Proposed Name
Goal-Tracking-App

## Features In Progress

### Member App
- Daily goal check-in (met/not met)
- Reflective diary for goal-specific notes
- AI chatbot with access to diary context to help the member stay on track

### Mentor App
- Analytics dashboard for all members
- AI chatbot to discuss plans and interventions based on collected data

## File structure

Top-level overview of the repository (key files and folders):

```
Goal-Tracking-App/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI (or app) entrypoints
│   │   ├── gemini.py         # LLM / AI integration helpers
│   │   ├── database.py       # DB connection and setup
│   │   └── models.py         # Pydantic / ORM models
│   ├── worker/
│   │   ├── celery_app.py     # Celery configuration
│   │   └── tasks.py          # Background tasks
│   └── requirements.txt      # Python dependencies
├── backend/.env              # environment variables for backend (not committed)
├── README.md
└── .git/

```

Notes:
- This shows the main backend layout; frontend or mobile client code may be in a separate folder when added.
- Update this section as new top-level folders (e.g. `mobile/`, `frontend/`, `infra/`) are introduced.
