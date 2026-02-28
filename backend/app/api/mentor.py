"""Mentor API endpoints for mentor operations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.dependencies import get_db
from app.schemas.mentor import MentorAssign, MentorResponse
from app.services.mentor_service import (
    assign_mentor,
    get_mentor_patients,
    get_mentee_goals
)

router = APIRouter(prefix="/mentors", tags=["mentors"])


@router.post("/{user_id}/assign", response_model=MentorResponse)
async def assign_mentor_to_user(
    user_id: UUID,
    data: MentorAssign,
    session: AsyncSession = Depends(get_db)
):
    """Assign a mentor to a user."""
    user = await assign_mentor(session, user_id, data.mentor_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{mentor_id}/patients")
async def get_mentor_patients_list(
    mentor_id: UUID,
    session: AsyncSession = Depends(get_db)
):
    """Get all patients assigned to a mentor."""
    patients = await get_mentor_patients(session, mentor_id)
    return patients


@router.get("/{user_id}/goals")
async def get_mentee_goals_list(
    user_id: UUID,
    session: AsyncSession = Depends(get_db)
):
    """Get all goals for a mentee."""
    goals = await get_mentee_goals(session, user_id)
    return goals
