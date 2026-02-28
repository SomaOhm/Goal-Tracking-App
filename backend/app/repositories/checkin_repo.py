"""Checkin repository for data access operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Checkin


class CheckinRepository:
    """Repository for checkin data access."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, goal_id, user_id, completed: bool) -> Checkin:
        """Create a new check-in."""
        checkin = Checkin(
            goal_id=goal_id,
            user_id=user_id,
            completed=completed
        )
        self.session.add(checkin)
        await self.session.commit()
        await self.session.refresh(checkin)
        return checkin

    async def get_by_id(self, checkin_id) -> Checkin | None:
        """Get check-in by ID."""
        result = await self.session.execute(
            select(Checkin).where(Checkin.id == checkin_id)
        )
        return result.scalar_one_or_none()

    async def get_by_goal(self, goal_id) -> list[Checkin]:
        """Get all check-ins for a goal."""
        result = await self.session.execute(
            select(Checkin).where(Checkin.goal_id == goal_id)
        )
        return result.scalars().all()

    async def get_by_user(self, user_id) -> list[Checkin]:
        """Get all check-ins for a user."""
        result = await self.session.execute(
            select(Checkin).where(Checkin.user_id == user_id)
        )
        return result.scalars().all()

    async def get_unsynced(self) -> list[Checkin]:
        """Get all check-ins not yet synced to Snowflake."""
        result = await self.session.execute(
            select(Checkin).where(Checkin.synced_to_snowflake == False)
        )
        return result.scalars().all()

    async def mark_synced(self, checkin_id) -> bool:
        """Mark a check-in as synced to Snowflake."""
        checkin = await self.get_by_id(checkin_id)
        if checkin:
            checkin.synced_to_snowflake = True
            await self.session.commit()
            return True
        return False

    async def delete(self, checkin_id) -> bool:
        """Delete a check-in."""
        checkin = await self.get_by_id(checkin_id)
        if checkin:
            await self.session.delete(checkin)
            await self.session.commit()
            return True
        return False
