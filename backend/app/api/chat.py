"""Chat API endpoints for user-AI interactions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

from app.dependencies import get_db
from app.services.gemini_service import chat_with_mcp_tools
from app.repositories.message_repo import MessageRepository

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    user_id: UUID
    group_id: UUID | None = None
    message: str


class ChatResponse(BaseModel):
    user_message: str
    ai_reply: str
    timestamp: str


@router.post("/", response_model=ChatResponse)
def chat(
    data: ChatRequest,
    session: Session = Depends(get_db)
):
    """
    User-AI accountability coach interaction powered by MCP tools.

    Flow:
    1. Send user message + IDs to Gemini with MCP tool declarations
    2. Gemini calls get_user_summary / get_user_goals / get_group_context as needed
    3. Tool results are dispatched directly to the Snowflake/Supabase service layer
    4. Gemini produces a final reply — store both messages and return to client
    """
    try:
        ai_reply = chat_with_mcp_tools(
            user_id=str(data.user_id),
            group_id=str(data.group_id) if data.group_id else None,
            user_message=data.message,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")

    # Persist both messages
    message_repo = MessageRepository(session)
    try:
        message_repo.create(
            user_id=data.user_id,
            group_id=data.group_id,
            content=data.message,
            is_ai=False,
            message_type="chat",
            context_used={"source": "mcp"},
        )
        ai_msg = message_repo.create(
            user_id=data.user_id,
            group_id=data.group_id,
            content=ai_reply,
            is_ai=True,
            message_type="chat",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return ChatResponse(
        user_message=data.message,
        ai_reply=ai_reply,
        timestamp=ai_msg.created_at.isoformat(),
    )


@router.get("/{user_id}/history")
def get_chat_history(
    user_id: UUID,
    limit: int = 20,
    session: Session = Depends(get_db)
):
    """Get chat history for a user."""
    message_repo = MessageRepository(session)
    messages = message_repo.get_by_user(user_id, limit=limit)

    return [
        {
            "id": str(m.id),
            "user_message": m.user_message,
            "ai_reply": m.ai_reply,
            "is_ai": m.is_ai,
            "timestamp": m.created_at.isoformat()
        }
        for m in reversed(messages)  # Oldest first
    ]
