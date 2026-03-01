"""AI coach API: context (Snowflake then Supabase) and ask / group-analysis."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.coach_service import get_goal_context
from app.services.gemini_service import coach_ask
from app.config import settings

router = APIRouter(prefix="/coach", tags=["coach"])


@router.get("/context")
def coach_context(user_id: str):
    """Return goal + check-in context for the user (Snowflake then Supabase)."""
    context_str, source = get_goal_context(user_id)
    return {"context": context_str, "source": source}


class CoachAskBody(BaseModel):
    user_id: str
    message: str


@router.post("/ask")
def coach_ask_endpoint(body: CoachAskBody):
    """Answer the user's question using their goal context and Gemini (gemini-3-flash-preview)."""
    if not (body.user_id or "").strip():
        raise HTTPException(status_code=400, detail="user_id is required")
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    context_str, _ = get_goal_context(body.user_id.strip())
    prompt = f"""You are a supportive, encouraging AI coach. Use only the following context about this user's goals and check-ins. Be concise and actionable.

Context:
{context_str}

User question: {body.message}

Reply as the coach (no preamble like "As your coach..."):"""
    try:
        reply = coach_ask(prompt)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


class GroupAnalysisBody(BaseModel):
    context: str


@router.post("/group-analysis")
def coach_group_analysis(body: GroupAnalysisBody):
    """Generate encouraging analysis for a group (or subgroup) from pre-built context."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    prompt = f"""You are Flock, a supportive group accountability coach and wellness analyst. Based on the following context about one or more members' goals and check-ins, provide an encouraging analysis. If the context includes an "Instruction:" line, follow it (e.g. full group summary, comparative analysis, or individual analysis). Otherwise highlight progress, wins, and one or two gentle suggestions. Use markdown. Be specific — reference names, goals, and data points. Keep it positive and actionable.

Context:
{body.context}

Provide your analysis:"""
    try:
        reply = coach_ask(prompt)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
