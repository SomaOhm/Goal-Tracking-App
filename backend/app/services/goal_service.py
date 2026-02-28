"""Goal service for managing goal creation and updates."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Goal


async def create_goal(
    session: AsyncSession,
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
    await session.commit()
    await session.refresh(goal)
    return goal


async def get_user_goals(session: AsyncSession, user_id) -> list[Goal]:
    """Get all goals for a user."""
    result = await session.execute(
        select(Goal).where(Goal.user_id == user_id)
    )
    return result.scalars().all()


async def get_goal_by_id(session: AsyncSession, goal_id) -> Goal:
    """Get a specific goal by ID."""
    result = await session.execute(
        select(Goal).where(Goal.id == goal_id)
    )
    return result.scalar_one_or_none()
