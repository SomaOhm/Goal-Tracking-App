"""Member API endpoints for managing members."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.dependencies import get_db
from app.schemas.member import MemberCreate, MemberUpdate, MemberResponse
from app.repositories.user_repo import UserRepository

router = APIRouter(prefix="/members", tags=["members"])


@router.post("/", response_model=MemberResponse)
def create_member(
    data: MemberCreate,
    session: Session = Depends(get_db)
):
    """Create a new member."""
    repo = UserRepository(session)
    member = repo.create(name=data.name, mentor_id=data.mentor_id)
    return member


@router.get("/{member_id}", response_model=MemberResponse)
def get_member(
    member_id: UUID,
    session: Session = Depends(get_db)
):
    """Get member details by ID."""
    repo = UserRepository(session)
    member = repo.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.get("/", response_model=list[MemberResponse])
def list_members(
    session: Session = Depends(get_db)
):
    """List all members."""
    repo = UserRepository(session)
    members = repo.get_all()
    return members


@router.put("/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: UUID,
    data: MemberUpdate,
    session: Session = Depends(get_db)
):
    """Update member details."""
    repo = UserRepository(session)
    update_data = data.model_dump(exclude_unset=True)
    member = repo.update(member_id, **update_data)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.delete("/{member_id}")
def delete_member(
    member_id: UUID,
    session: Session = Depends(get_db)
):
    """Delete a member."""
    repo = UserRepository(session)
    success = repo.delete(member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member deleted successfully"}
