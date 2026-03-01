"""
Snowflake analytics API — exposes user and group data fetched from
Snowflake (analytics) and Supabase (relational), intended to provide
context for the Gemini chatbot.
"""

from fastapi import APIRouter, HTTPException

from app.services.snowflake_service import (
    get_user_summary,
    get_user_goals_detail,
    get_group_member_summaries,
    build_group_context_string,
)

router = APIRouter(prefix="/snowflake", tags=["snowflake"])


# ---------------------------------------------------------------------------
# User endpoints
# ---------------------------------------------------------------------------

@router.get("/user/{user_id}/summary")
def user_summary(user_id: str):
    """
    Full summary for a single user:
    - Profile (name, email)
    - Goals with completion counts
    - Adherence %, streak, risk level from Snowflake
    - Recent check-ins from Supabase

    Used by the chatbot to give context about the current user.
    """
    try:
        return get_user_summary(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/user/{user_id}/goals")
def user_goals(user_id: str):
    """
    Detailed per-goal breakdown for a user including full check-in history.
    Snowflake fact_checkins used when available; falls back to Supabase goal_completions.

    Includes completion rate, missed count, and per-checkin timestamps.
    """
    try:
        return get_user_goals_detail(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Group endpoints
# ---------------------------------------------------------------------------

@router.get("/group/{group_id}/members")
def group_members(group_id: str):
    """
    All members of a group with their individual summaries:
    - Goals + completion counts
    - Adherence %, streak, risk level from Snowflake
    - Recent check-ins

    Useful for rendering a group dashboard or feeding structured data
    to the chatbot.
    """
    try:
        return get_group_member_summaries(group_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/group/{group_id}/context")
def group_context(group_id: str):
    """
    Pre-formatted plain-text context string for a group, ready to inject
    into a Gemini prompt.

    Format example:
        Group: Running Club (3 members)

        --- Alice ---
        Goals:
          - Run 5k (daily): 18/21 completions
        Adherence: 85.0% (7d)  |  80.0% (30d)
        Streak: 6 day(s) current, 10 day(s) longest
        Risk: low (score 0.1, 1 missed last 7d)
        ...

    The chatbot (or MCP tool) can call this endpoint and embed the result
    directly into the Gemini prompt.
    """
    try:
        context_str, group_name = build_group_context_string(group_id)
        return {
            "group_id":   group_id,
            "group_name": group_name,
            "context":    context_str,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
