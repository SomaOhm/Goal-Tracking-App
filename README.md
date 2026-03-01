# Goal-Tracking-App

## Project Overview

### Goal
Build a mobile application that helps users set and achieve goals by adding accountability via automated reporting to a designated mentor, therapist, or accountability partner.

### Target Audience
People who want to establish and maintain habits, track personal goals (mental health, fitness, productivity), and benefit from external accountability.

### Core Value Proposition
A seamless goal-tracking experience paired with a transparent, automated accountability loop to an external professional or partner. Includes an integrated reflective diary and an AI chat agent for internal guidance and support.

## Features

### Member App
- Daily goal check-in (met/not met)
- Reflective diary for goal-specific notes
- AI chatbot with access to diary context to help the member stay on track

### Mentor App
- Analytics dashboard for all members
- AI chatbot to discuss plans and interventions based on collected data

## Running the App

### Frontend (React/Vite)

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `frontend/.env` to connect to Supabase. Without them, the app runs in localStorage demo mode.

### Backend (Python/FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set environment variables in `backend/.env` (see `backend/.env.example`).

### Database (Supabase)

Run `database/supabase-schema.sql` in the Supabase SQL Editor to create all tables, RLS policies, and triggers.

## File Structure

```
Goal-Tracking-App/
├── frontend/             # React/Vite frontend
│   ├── src/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── backend/              # Python/FastAPI backend (mentor/member APIs, AI chat)
│   ├── app/
│   ├── worker/
│   └── requirements.txt
├── database/             # Supabase schema and migrations
│   └── supabase-schema.sql
└── guidelines/           # Design guidelines
```
