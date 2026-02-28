"""Mentor service for managing mentor-related operations."""

from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import User


def get_mentee_goals(session: Session, user_id):
    """Get all goals for a mentee."""
    result = session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    return user.goals if user else []


def get_mentor_patients(session: Session, mentor_id):
    """Get all patients assigned to a mentor."""
    result = session.execute(
        select(User).where(User.mentor_id == mentor_id)
    )
    return result.scalars().all()


def assign_mentor(session: Session, user_id, mentor_id):
    """Assign a mentor to a user."""
    result = session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.mentor_id = mentor_id
        session.commit()
        return user
    return None
