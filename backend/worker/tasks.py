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
    sync_checkins_to_snowflake,
    sync_goals_to_snowflake,
    sync_users_to_snowflake
)

__all__ = [
    "weekly_goal_review",
    "daily_goal_reminder",
    "monthly_progress_report",
    "sync_checkins_to_snowflake",
    "sync_goals_to_snowflake",
    "sync_users_to_snowflake",
]