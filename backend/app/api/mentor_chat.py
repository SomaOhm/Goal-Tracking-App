"""Mentor chat API endpoints for mentor-AI-patient interactions."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel
from datetime import datetime

from app.dependencies import get_db
from app.utils.context_builder import build_mentor_context
from app.services.gemini_service import mentor_copilot
from app.services.analytics_service import get_mentor_dashboard_data
from app.models import MentorInteraction

router = APIRouter(prefix="/mentor/chat", tags=["mentor"])


class MentorChatRequest(BaseModel):
    mentor_id: UUID
    patient_id: UUID
    message: str
    mode: str = "quick_check"  # quick_check, deep_dive, risk_intervention


class MentorChatResponse(BaseModel):
    ai_reply: str
    sources_used: list[str]
    suggested_actions: list[str] | None = None
    timestamp: str


@router.post("/", response_model=MentorChatResponse)
def mentor_chat(
    data: MentorChatRequest,
    session: Session = Depends(get_db)
):
    """
    Mentor-AI interaction for patient oversight.
    
    Flow:
    1. Load context from Postgres (operational: goals, check-ins, notes)
    2. Load context from Snowflake (analytics: adherence, trends, risk scores)
    3. Call Gemini with: mentor instruction + context + message
    4. Store interaction in database for audit trail
    5. Return AI reply + data sources + action suggestions
    
    Modes:
    - quick_check: Brief status update
    - deep_dive: Detailed analysis with historical context
    - risk_intervention: Focus on missed patterns and recovery steps
    """
    sources_used = []
    
    # Load operational context from Postgres
    try:
        operational_context = build_mentor_context(session, data.patient_id)
        sources_used.append("postgresql")
    except Exception as e:
        operational_context = {"error": str(e)}
    
    # Load analytics context from Snowflake
    try:
        analytics_context = get_mentor_dashboard_data(str(data.patient_id))
        sources_used.append("snowflake")
    except Exception as e:
        analytics_context = {"error": str(e)}
    
    # Build comprehensive context
    context = {
        "operational": operational_context,
        "analytics": analytics_context,
        "mode": data.mode
    }
    
    # System instruction varies by mode
    mode_instructions = {
        "quick_check": "Provide a brief status check with 1-2 observations and next steps.",
        "deep_dive": "Provide comprehensive analysis with trends, patterns, and recommendations.",
        "risk_intervention": "Focus on missed goals, risk patterns, and concrete recovery steps."
    }
    
    system_instruction = f"""You are a mentor assistant copilot.
    - Do not diagnose or provide medical advice
    - Always cite which data point you're referencing
    - Propose concrete next actions
    - Format output as: 
      1. Summary (1-2 sentences)
      2. Key observations (2-3 points)
      3. Suggested actions (3-5 steps)
    
    Mode: {data.mode}
    {mode_instructions.get(data.mode, '')}"""
    
    prompt = f"""{system_instruction}

    Context:
    {str(context)}
    
    Mentor's message/observation: {data.message}
    
    Provide coaching advice:"""
    
    try:
        ai_reply = mentor_copilot(str(context), data.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {str(e)}")
    
    # Parse suggested actions from AI reply (simple extraction)
    suggested_actions = None
    if "action" in ai_reply.lower() or "step" in ai_reply.lower():
        suggested_actions = extract_actions(ai_reply)
    
    # Store interaction for audit trail
    interaction = MentorInteraction(
        mentor_id=data.mentor_id,
        patient_id=data.patient_id,
        mode=data.mode,
        mentor_message=data.message,
        ai_reply=ai_reply,
        sources_used=sources_used,
        created_at=datetime.utcnow()
    )
    session.add(interaction)
    session.commit()
    
    return MentorChatResponse(
        ai_reply=ai_reply,
        sources_used=sources_used,
        suggested_actions=suggested_actions,
        timestamp=interaction.created_at.isoformat()
    )


@router.get("/{mentor_id}/patients")
def list_mentor_patients(
    mentor_id: UUID,
    session: Session = Depends(get_db)
):
    """Get all patients for a mentor with their status."""
    from app.repositories.user_repo import UserRepository
    from sqlalchemy import select
    from app.models import User
    
    result = session.execute(
        select(User).where(User.mentor_id == mentor_id)
    )
    patients = result.scalars().all()
    
    patient_list = []
    for patient in patients:
        try:
            analytics = get_mentor_dashboard_data(str(patient.id))
            patient_list.append({
                "id": str(patient.id),
                "name": patient.name,
                "analytics": analytics
            })
        except:
            patient_list.append({
                "id": str(patient.id),
                "name": patient.name,
                "analytics": None
            })
    
    return patient_list


@router.get("/{mentor_id}/interactions/{patient_id}")
def get_interaction_history(
    mentor_id: UUID,
    patient_id: UUID,
    limit: int = 10,
    session: Session = Depends(get_db)
):
    """Get mentor-AI interaction history for a patient."""
    from sqlalchemy import select, and_
    
    result = session.execute(
        select(MentorInteraction)
        .where(and_(
            MentorInteraction.mentor_id == mentor_id,
            MentorInteraction.patient_id == patient_id
        ))
        .order_by(MentorInteraction.created_at.desc())
        .limit(limit)
    )
    interactions = result.scalars().all()
    
    return [
        {
            "id": str(i.id),
            "mode": i.mode,
            "mentor_message": i.mentor_message,
            "ai_reply": i.ai_reply,
            "sources_used": i.sources_used,
            "created_at": i.created_at.isoformat()
        }
        for i in reversed(interactions)
    ]


def extract_actions(text: str) -> list[str]:
    """Extract action items from AI response."""
    import re
    actions = []
    # Look for numbered lists or bullet points
    lines = text.split("\n")
    for line in lines:
        if re.match(r"^\s*[\d\-\*]\.\s+", line):
            cleaned = re.sub(r"^\s*[\d\-\*]\.\s+", "", line).strip()
            if cleaned:
                actions.append(cleaned)
    return actions if actions else None
