"""Mentor service for managing mentor-related operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User


async def get_mentee_goals(session: AsyncSession, user_id):
    """Get all goals for a mentee."""
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    return user.goals if user else []


async def get_mentor_patients(session: AsyncSession, mentor_id):
    """Get all patients assigned to a mentor."""
    result = await session.execute(
        select(User).where(User.mentor_id == mentor_id)
    )
    return result.scalars().all()


async def assign_mentor(session: AsyncSession, user_id, mentor_id):
    """Assign a mentor to a user."""
    result = await session.execute(
        select(User).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if user:
        user.mentor_id = mentor_id
        await session.commit()
        return user
    return None
