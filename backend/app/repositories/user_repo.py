"""User repository for data access operations."""

from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import User


class UserRepository:
    """Repository for user data access."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, name: str, mentor_id=None) -> User:
        """Create a new user."""
        user = User(name=name, mentor_id=mentor_id)
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def get_by_id(self, user_id) -> User | None:
        """Get user by ID."""
        result = self.session.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    def get_all(self) -> list[User]:
        """Get all users."""
        result = self.session.execute(select(User))
        return result.scalars().all()

    def update(self, user_id, **kwargs) -> User | None:
        """Update user fields."""
        user = self.get_by_id(user_id)
        if user:
            for key, value in kwargs.items():
                if hasattr(user, key):
                    setattr(user, key, value)
            self.session.commit()
            self.session.refresh(user)
        return user

    def delete(self, user_id) -> bool:
        """Delete a user."""
        user = self.get_by_id(user_id)
        if user:
            self.session.delete(user)
            self.session.commit()
            return True
        return False
