"""User repository for data access operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User


class UserRepository:
    """Repository for user data access."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, name: str, mentor_id=None) -> User:
        """Create a new user."""
        user = User(name=name, mentor_id=mentor_id)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_by_id(self, user_id) -> User | None:
        """Get user by ID."""
        result = await self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_all(self) -> list[User]:
        """Get all users."""
        result = await self.session.execute(select(User))
        return result.scalars().all()

    async def update(self, user_id, **kwargs) -> User | None:
        """Update user fields."""
        user = await self.get_by_id(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            await self.session.commit()
            await self.session.refresh(user)
        return user

    async def delete(self, user_id) -> bool:
        """Delete a user."""
        user = await self.get_by_id(user_id)
        if user:
            await self.session.delete(user)
            await self.session.commit()
            return True
        return False
