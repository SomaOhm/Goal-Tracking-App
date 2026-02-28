"""Goal repository for data access operations."""

from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Goal


class GoalRepository:
    """Repository for goal data access."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, user_id, title: str, category: str, frequency: str) -> Goal:
        """Create a new goal."""
        goal = Goal(
            user_id=user_id,
            title=title,
            category=category,
            frequency=frequency
        )
        self.session.add(goal)
        self.session.commit()
        self.session.refresh(goal)
        return goal

    def get_by_id(self, goal_id) -> Goal | None:
        """Get goal by ID."""
        result = self.session.execute(
            select(Goal).where(Goal.id == goal_id)
        )
        return result.scalar_one_or_none()

    def get_by_user(self, user_id) -> list[Goal]:
        """Get all goals for a user."""
        result = self.session.execute(
            select(Goal).where(Goal.user_id == user_id)
        )
        return result.scalars().all()

    def update(self, goal_id, **kwargs) -> Goal | None:
        """Update goal fields."""
        goal = self.get_by_id(goal_id)
        if goal:
            for key, value in kwargs.items():
                if hasattr(goal, key):
                    setattr(goal, key, value)
            self.session.commit()
            self.session.refresh(goal)
        return goal

    def delete(self, goal_id) -> bool:
        """Delete a goal."""
        goal = self.get_by_id(goal_id)
        if goal:
            self.session.delete(goal)
            self.session.commit()
            return True
        return False
