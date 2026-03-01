"""
Celery task imports.

For goal reviews, see: worker.review_tasks
For Postgres → Snowflake sync, see: worker.sync_tasks
"""

# Import all tasks from submodules to register with Celery
from worker.review_tasks import (
    weekly_goal_review,
    daily_goal_reminder,
    monthly_progress_report
)
from worker.sync_tasks import (
    sync_postgres_to_snowflake,
    compute_adherence_scores,
    compute_risk_metrics,
)

__all__ = [
    "weekly_goal_review",
    "daily_goal_reminder",
    "monthly_progress_report",
    "sync_postgres_to_snowflake",
    "compute_adherence_scores",
    "compute_risk_metrics",
]
