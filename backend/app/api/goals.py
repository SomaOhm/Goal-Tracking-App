"""Goals API endpoints for managing goals."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.dependencies import get_db
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse
from app.repositories.goal_repo import GoalRepository
from app.repositories.checkin_repo import CheckinRepository
from app.services.gemini_service import generate_goal_plan

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/", response_model=GoalResponse)
def create_goal(
    user_id: UUID,
    data: GoalCreate,
    session: Session = Depends(get_db)
):
    """
    Create a new goal.
    
    Generates a structured plan using Gemini AI if constraints are provided.
    """
    # Generate AI plan if constraints provided
    if hasattr(data, 'constraints') and data.constraints:
        ai_plan = generate_goal_plan(
            data.description,
            data.category,
            data.constraints
        )
    
    # Create goal in database
    repo = GoalRepository(session)
    goal = repo.create(
        user_id=user_id,
        title=data.title,
        category=data.category,
        frequency=data.frequency
    )
    return goal


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(
    goal_id: UUID,
    session: Session = Depends(get_db)
):
    """Get goal details by ID."""
    repo = GoalRepository(session)
    goal = repo.get_by_id(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.get("/user/{user_id}", response_model=list[GoalResponse])
def get_user_goals(
    user_id: UUID,
    session: Session = Depends(get_db)
):
    """Get all goals for a user."""
    repo = GoalRepository(session)
    goals = repo.get_by_user(user_id)
    return goals


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: UUID,
    data: GoalUpdate,
    session: Session = Depends(get_db)
):
    """Update goal details."""
    repo = GoalRepository(session)
    update_data = data.model_dump(exclude_unset=True)
    goal = repo.update(goal_id, **update_data)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.delete("/{goal_id}")
def delete_goal(
    goal_id: UUID,
    session: Session = Depends(get_db)
):
    """Delete a goal."""
    repo = GoalRepository(session)
    success = repo.delete(goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")
    return {"message": "Goal deleted successfully"}


@router.post("/{goal_id}/checkin")
def create_checkin(
    goal_id: UUID,
    user_id: UUID,
    completed: bool,
    session: Session = Depends(get_db)
):
    """Log a check-in for a goal."""
    repo = CheckinRepository(session)
    checkin = repo.create(goal_id, user_id, completed)
    return checkin
