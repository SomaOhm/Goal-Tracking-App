"""Dashboard API endpoints for analytics and insights."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.dependencies import get_db
from app.services.analytics_service import (
    get_mentor_dashboard_data,
    get_user_analytics
)
from app.utils.context_builder import build_goal_context, build_mentor_context
from app.repositories.checkin_repo import CheckinRepository

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/user/{user_id}/goals")
def get_user_dashboard(
    user_id: UUID,
    session: Session = Depends(get_db)
):
    """Get user's goal dashboard with context."""
    context = build_goal_context(session, user_id)
    return context


@router.get("/mentor/{mentor_id}/patient/{user_id}")
def get_mentor_dashboard(
    mentor_id: UUID,
    user_id: UUID,
    session: Session = Depends(get_db)
):
    """Get mentor's view of a patient's dashboard."""
    context = build_mentor_context(session, user_id)
    
    # Add Snowflake analytics
    try:
        analytics = get_mentor_dashboard_data(str(user_id))
        context["snowflake_analytics"] = analytics
    except Exception as e:
        context["snowflake_analytics"] = {"error": str(e)}
    
    return context


@router.get("/analytics/{user_id}")
def get_user_analytics_dashboard(
    user_id: UUID,
    session: Session = Depends(get_db)
):
    """Get user-specific analytics from Snowflake."""
    try:
        analytics = get_user_analytics(str(user_id))
        return {"user_id": user_id, "analytics": analytics}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sync-status")
def get_sync_status(
    session: Session = Depends(get_db)
):
    """Get status of unsynced check-ins."""
    repo = CheckinRepository(session)
    unsynced = repo.get_unsynced()
    return {
        "total_unsynced": len(unsynced),
        "checkins": unsynced
    }
