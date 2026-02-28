"""Goal repository for data access operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Goal


class GoalRepository:
    """Repository for goal data access."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, user_id, title: str, category: str, frequency: str) -> Goal:
        """Create a new goal."""
        goal = Goal(
            user_id=user_id,
            title=title,
            category=category,
            frequency=frequency
        )
        self.session.add(goal)
        await self.session.commit()
        await self.session.refresh(goal)
        return goal

    async def get_by_id(self, goal_id) -> Goal | None:
        """Get goal by ID."""
        result = await self.session.execute(
            select(Goal).where(Goal.id == goal_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id) -> list[Goal]:
        """Get all goals for a user."""
        result = await self.session.execute(
            select(Goal).where(Goal.user_id == user_id)
        )
        return result.scalars().all()

    async def update(self, goal_id, **kwargs) -> Goal | None:
        """Update goal fields."""
        goal = await self.get_by_id(goal_id)
        if goal:
            for key, value in kwargs.items():
                if hasattr(goal, key):
                    setattr(goal, key, value)
            await self.session.commit()
            await self.session.refresh(goal)
        return goal

    async def delete(self, goal_id) -> bool:
        """Delete a goal."""
        goal = await self.get_by_id(goal_id)
        if goal:
            await self.session.delete(goal)
            await self.session.commit()
            return True
        return False
