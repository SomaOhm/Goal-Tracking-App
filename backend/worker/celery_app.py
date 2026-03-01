"""Celery application setup with Redis broker and beat schedule."""

import os
from celery import Celery
from celery.schedules import crontab

celery = Celery(
    "goal_tracking",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    include=["worker.sync_tasks", "worker.review_tasks"],
)

# Configure Celery
celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    result_expires=3600,  # Results expire after 1 hour
)

# Beat schedule for periodic tasks
celery.conf.beat_schedule = {
    # Incremental Postgres → Snowflake sync (every 2 minutes)
    'sync-postgres-to-snowflake': {
        'task': 'worker.sync_tasks.sync_postgres_to_snowflake',
        'schedule': 120.0,
    },
    
    # Analytics computation (every 6 hours)
    'compute-adherence-scores': {
        'task': 'worker.sync_tasks.compute_adherence_scores',
        'schedule': crontab(hour='*/6'),
    },
    
    # Risk detection (every 4 hours)
    'compute-risk-metrics': {
        'task': 'worker.sync_tasks.compute_risk_metrics',
        'schedule': crontab(hour='*/4'),
    },
    
    # Daily reminders (7 AM UTC)
    'daily-goal-reminder': {
        'task': 'worker.review_tasks.daily_goal_reminder',
        'schedule': crontab(hour=7, minute=0),
    },
    
    # Weekly comprehensive review (Monday 9 AM UTC)
    'weekly-goal-review': {
        'task': 'worker.review_tasks.weekly_goal_review',
        'schedule': crontab(day_of_week=0, hour=9, minute=0),
    },
    
    # Plan suggestions (Wednesday 10 AM UTC)
    'generate-plan-suggestions': {
        'task': 'worker.review_tasks.generate_plan_suggestions',
        'schedule': crontab(day_of_week=2, hour=10, minute=0),
    },
    
    # Monthly report (1st of month, 8 AM UTC)
    'monthly-progress-report': {
        'task': 'worker.review_tasks.monthly_progress_report',
        'schedule': crontab(day_of_month=1, hour=8, minute=0),
    },
}

# Task routes for different queues (optional)
celery.conf.task_routes = {
    'worker.sync_tasks.*': {'queue': 'sync'},
    'worker.review_tasks.*': {'queue': 'reviews'},
}

# Task time limits
celery.conf.task_time_limit = 30 * 60  # Hard limit: 30 minutes
celery.conf.task_soft_time_limit = 25 * 60  # Soft limit: 25 minutes