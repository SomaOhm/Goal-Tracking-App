"""Pydantic schemas for member-related requests and responses."""

from pydantic import BaseModel
from datetime import datetime
from uuid import UUID


class MemberCreate(BaseModel):
    name: str
    mentor_id: UUID | None = None


class MemberUpdate(BaseModel):
    name: str | None = None
    mentor_id: UUID | None = None


class MemberResponse(BaseModel):
    id: UUID
    name: str
    mentor_id: UUID | None
    created_at: datetime

    class Config:
        from_attributes = True
