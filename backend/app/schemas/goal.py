"""Pydantic schemas for goal-related requests and responses."""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class GoalCreate(BaseModel):
    title: str
    category: str
    frequency: str
    description: str
    constraints: dict = {}


class GoalUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    frequency: str | None = None


class GoalResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    category: str
    frequency: str
    created_at: datetime

    class Config:
        from_attributes = True
