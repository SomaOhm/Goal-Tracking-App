"""Chat API endpoints for user-AI interactions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.dependencies import get_db
from app.utils.context_builder import build_goal_context
from app.services.gemini_service import review_progress
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
async def chat(
    data: ChatRequest,
    session: AsyncSession = Depends(get_db)
):
    """
    User-AI accountability coach interaction.
    
    Flow:
    1. Load context from Postgres (goals, check-ins, recent messages)
    2. Call Gemini with: system instruction + context + user message
    3. Store both messages in database
    4. Return AI reply to client
    """
    try:
        # Build context from database
        context = await build_goal_context(session, data.user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not load user context: {str(e)}")
    
    # Build context string for Gemini
    context_str = f"""
User's Active Goals:
{[g['title'] for g in context.get('goals', [])]}

Recent Completion Ratio: {context.get('stats', {}).get('completion_ratio', 0) * 100:.1f}%

Latest Check-ins:
{context.get('checkins', [])[-3:]}
"""
    
    # Call Gemini with system instruction + context
    system_instruction = """You are a group accountability coach. 
Your role is to:
1. Provide encouragement based on the user's progress
2. Suggest adjustments to their plan if needed
3. Give specific, actionable next steps
Keep your tone supportive and motivating. Keep response under 200 words."""
    
    prompt = f"""{system_instruction}

{context_str}

User's message: {data.message}

Respond with:
1. Acknowledgment of their message
2. 1-2 specific encouragements or observations
3. 1-2 action steps for next"""
    
    try:
        ai_reply = await review_progress(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
    
    # Store messages in database
    message_repo = MessageRepository(session)
    
    try:
        # Store in one combined record with both messages
        ai_msg = await message_repo.create(
            user_id=data.user_id,
            group_id=data.group_id,
            content=data.message,
            is_ai=False,
            message_type="chat",
            context_used={"goals": len(context.get('goals', [])), "checkins": len(context.get('checkins', []))}
        )
        
        # Store AI reply
        ai_reply_msg = await message_repo.create(
            user_id=data.user_id,
            group_id=data.group_id,
            content=ai_reply,
            is_ai=True,
            message_type="chat"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return ChatResponse(
        user_message=data.message,
        ai_reply=ai_reply,
        timestamp=ai_reply_msg.created_at.isoformat()
    )


@router.get("/{user_id}/history")
async def get_chat_history(
    user_id: UUID,
    limit: int = 20,
    session: AsyncSession = Depends(get_db)
):
    """Get chat history for a user."""
    message_repo = MessageRepository(session)
    messages = await message_repo.get_by_user(user_id, limit=limit)
    
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
