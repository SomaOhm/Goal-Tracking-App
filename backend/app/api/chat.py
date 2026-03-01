"""Chat API endpoints for user-AI interactions."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from app.services.gemini_service import review_progress

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    user_id: str
    group_id: str | None = None
    message: str
    context: str | None = None


class ChatResponse(BaseModel):
    user_message: str
    ai_reply: str
    timestamp: str


@router.post("/", response_model=ChatResponse)
async def chat(data: ChatRequest):
    system_instruction = """You are MindBuddy, a supportive mental health and wellness AI coach.
Your role is to:
1. Provide encouragement based on the user's progress
2. Suggest adjustments to their plan if needed  
3. Give specific, actionable next steps
Keep your tone supportive and motivating. Always use markdown formatting."""

    context_section = f"\n\nUser's Goal Data:\n{data.context}" if data.context else ""

    prompt = f"""{system_instruction}{context_section}

User's message: {data.message}

Respond helpfully. Use markdown formatting. Be warm but actionable. Reference their specific goals and progress when relevant."""

    try:
        ai_reply = await review_progress(prompt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")

    return ChatResponse(
        user_message=data.message,
        ai_reply=ai_reply,
        timestamp=datetime.now().isoformat()
    )


@router.get("/{user_id}/history")
def get_chat_history(user_id: str, limit: int = 20):
    return []