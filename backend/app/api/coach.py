"""
AI coach API.

/coach/ask          — Gemini function-calling loop backed by MCP tools.
                      Gemini decides which MCP tool(s) to call to fetch
                      context from Snowflake, then produces a reply.

/coach/group-analysis — Fetch group context via MCP get_group_context,
                        then ask Gemini to analyse it with the given instruction.

Context is fetched exclusively via MCP tool functions (see coach_service.py).
No Supabase fallback.
"""

import google.generativeai as genai

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.coach_service import execute_mcp_tool
from app.config import settings

router = APIRouter(prefix="/coach", tags=["coach"])

# ---------------------------------------------------------------------------
# MCP tool declarations — must match tools in mcp_server.py exactly.
# Gemini uses these to decide what to fetch before answering.
# ---------------------------------------------------------------------------
_MCP_TOOLS = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name="get_user_summary",
            description=(
                "Fetch a full summary for a user: profile, all goals with "
                "completion counts, adherence percentages (7d/30d/90d), "
                "current and longest streak, risk level, and recent check-ins. "
                "Call this first when the user asks about their own progress."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "user_id": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="UUID of the user (from Supabase auth.users).",
                    )
                },
                required=["user_id"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_user_goals",
            description=(
                "Fetch a detailed per-goal breakdown including full check-in "
                "history, completion rate, and missed counts. "
                "Use when the user asks about a specific goal or wants trend analysis."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "user_id": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="UUID of the user.",
                    )
                },
                required=["user_id"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_group_context",
            description=(
                "Fetch a plain-text summary of an entire group: all members, "
                "their goals, adherence, streak, risk, and recent check-ins. "
                "Use when asked about the group or a comparison between members."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "group_id": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="UUID of the group.",
                    )
                },
                required=["group_id"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="get_group_members",
            description=(
                "Fetch structured JSON data for every member of a group: "
                "goals, adherence metrics, streak, risk, and check-ins. "
                "Use when you need to compute statistics or compare members directly."
            ),
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "group_id": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="UUID of the group.",
                    )
                },
                required=["group_id"],
            ),
        ),
    ]
)

_MAX_TOOL_ROUNDS = 5  # prevent infinite loops if the model keeps calling tools


def _build_model() -> genai.GenerativeModel:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai.GenerativeModel("gemini-3-flash-preview", tools=[_MCP_TOOLS])


# ---------------------------------------------------------------------------
# /coach/context  (debug / introspection)
# ---------------------------------------------------------------------------

@router.get("/context")
def coach_context(user_id: str):
    """Return get_user_summary MCP tool result directly (for debugging)."""
    result = execute_mcp_tool("get_user_summary", {"user_id": user_id})
    return {"context": result, "source": "mcp/snowflake"}


# ---------------------------------------------------------------------------
# /coach/ask  — Gemini function-calling loop
# ---------------------------------------------------------------------------

class CoachAskBody(BaseModel):
    user_id: str
    message: str


@router.post("/ask")
def coach_ask_endpoint(body: CoachAskBody):
    """
    Answer the user's question.

    Sends the question to Gemini together with the MCP tool declarations.
    Gemini decides which tools to call (e.g. get_user_summary) to fetch
    context from Snowflake, then produces a text reply.
    """
    if not (body.user_id or "").strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    model = _build_model()
    chat = model.start_chat()

    system_prompt = (
        "You are MindBuddy, a supportive AI wellness coach. "
        "You have access to the user's live goal and analytics data via tools. "
        "Always fetch the user's context with get_user_summary before answering. "
        f"The current user ID is: {body.user_id.strip()}\n\n"
        f"User message: {body.message}"
    )

    try:
        response = chat.send_message(system_prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    for _ in range(_MAX_TOOL_ROUNDS):
        # Collect all function calls in this response turn
        fn_calls = [
            part.function_call
            for part in response.candidates[0].content.parts
            if part.function_call.name  # non-empty name means it is a real call
        ]

        if not fn_calls:
            # No more tool calls — extract the text reply
            text = "".join(
                part.text
                for part in response.candidates[0].content.parts
                if hasattr(part, "text") and part.text
            )
            return {"reply": text or "No response generated."}

        # Execute every tool call and send all results back in one turn
        result_parts = []
        for fn_call in fn_calls:
            tool_result = execute_mcp_tool(fn_call.name, dict(fn_call.args))
            result_parts.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=fn_call.name,
                        response={"result": tool_result},
                    )
                )
            )

        try:
            response = chat.send_message(
                genai.protos.Content(parts=result_parts)
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=str(exc))

    # Fallback if we somehow exhaust rounds without a text reply
    text = "".join(
        part.text
        for part in response.candidates[0].content.parts
        if hasattr(part, "text") and part.text
    )
    return {"reply": text or "No response generated."}


# ---------------------------------------------------------------------------
# /coach/group-analysis  — MCP context fetch + Gemini
# ---------------------------------------------------------------------------

class GroupAnalysisBody(BaseModel):
    group_id: str
    instruction: str = ""


@router.post("/group-analysis")
def coach_group_analysis(body: GroupAnalysisBody):
    """
    Generate an AI analysis for a group.

    Fetches the group's context from Snowflake via the MCP get_group_context
    tool, then asks Gemini to produce an encouraging analysis following the
    given instruction (full group summary, comparative analysis, etc.).
    """
    if not (body.group_id or "").strip():
        raise HTTPException(status_code=400, detail="group_id is required")

    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    # Fetch context exclusively via MCP tool
    context = execute_mcp_tool("get_group_context", {"group_id": body.group_id.strip()})

    instruction = (body.instruction or "").strip() or (
        "Give a full group analysis. Summarise overall group health, identify "
        "members who are excelling and who may need support, spot trends, and "
        "suggest actions a coach or group leader could take."
    )

    prompt = (
        "You are MindBuddy, a supportive group accountability coach and wellness "
        "analyst. Based on the following context (fetched live from Snowflake via "
        "MCP), provide an encouraging analysis.\n\n"
        f"Context:\n{context}\n\n"
        f"Instruction: {instruction}\n\n"
        "Use markdown. Be specific — reference names, goals, and data points. "
        "Keep it positive and actionable."
    )

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3-flash-preview")
    try:
        response = model.generate_content(prompt)
        reply = response.text if response and response.text else "No response generated."
        return {"reply": reply}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))

