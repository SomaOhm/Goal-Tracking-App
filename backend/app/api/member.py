"""Member API endpoints for managing members."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.dependencies import get_db
from app.schemas.member import MemberCreate, MemberUpdate, MemberResponse
from app.repositories.user_repo import UserRepository

router = APIRouter(prefix="/members", tags=["members"])


@router.post("/", response_model=MemberResponse)
async def create_member(
    data: MemberCreate,
    session: AsyncSession = Depends(get_db)
):
    """Create a new member."""
    repo = UserRepository(session)
    member = await repo.create(name=data.name, mentor_id=data.mentor_id)
    return member


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: UUID,
    session: AsyncSession = Depends(get_db)
):
    """Get member details by ID."""
    repo = UserRepository(session)
    member = await repo.get_by_id(member_id)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.get("/", response_model=list[MemberResponse])
async def list_members(
    session: AsyncSession = Depends(get_db)
):
    """List all members."""
    repo = UserRepository(session)
    members = await repo.get_all()
    return members


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: UUID,
    data: MemberUpdate,
    session: AsyncSession = Depends(get_db)
):
    """Update member details."""
    repo = UserRepository(session)
    update_data = data.model_dump(exclude_unset=True)
    member = await repo.update(member_id, **update_data)
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return member


@router.delete("/{member_id}")
async def delete_member(
    member_id: UUID,
    session: AsyncSession = Depends(get_db)
):
    """Delete a member."""
    repo = UserRepository(session)
    success = await repo.delete(member_id)
    if not success:
        raise HTTPException(status_code=404, detail="Member not found")
    return {"message": "Member deleted successfully"}
