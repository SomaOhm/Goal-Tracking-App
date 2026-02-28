"""Goal service for managing goal creation and updates."""

from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Goal


def create_goal(
    session: Session,
    user_id,
    title: str,
    category: str,
    frequency: str
) -> Goal:
    """Create a new goal for a user."""
    goal = Goal(
        user_id=user_id,
        title=title,
        category=category,
        frequency=frequency
    )
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def get_user_goals(session: Session, user_id) -> list[Goal]:
    """Get all goals for a user."""
    result = session.execute(
        select(Goal).where(Goal.user_id == user_id)
    )
    return result.scalars().all()


def get_goal_by_id(session: Session, goal_id) -> Goal:
    """Get a specific goal by ID."""
    result = session.execute(
        select(Goal).where(Goal.id == goal_id)
    )
    return result.scalar_one_or_none()
