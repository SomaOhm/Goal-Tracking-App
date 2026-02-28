"""Pydantic schemas for mentor-related requests and responses."""

from pydantic import BaseModel
from uuid import UUID


class MentorAssign(BaseModel):
    mentor_id: UUID


class MentorResponse(BaseModel):
    id: UUID
    name: str

    class Config:
        from_attributes = True
