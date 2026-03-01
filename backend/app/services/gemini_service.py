"""Gemini AI service for goal planning, progress reviews, and mentor assistance."""

import json

from app.config import settings

if settings.GEMINI_API_KEY:
    import google.generativeai as genai
    from google.generativeai import protos
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3-flash-preview")
else:
    genai = None
    protos = None
    model = None


def coach_ask(prompt: str) -> str:
    """Sync call to Gemini for coach/group analysis. Returns reply text or raises."""
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text if response and response.text else "No response generated."


async def generate_goal_plan(user_description, group_theme, constraints):
    """
    Generate a structured goal plan using Gemini AI.
    
    Args:
        user_description: User's goal description
        group_theme: Theme or context for the goal group
        constraints: Any constraints or limitations
        
    Returns:
        Structured goal plan with subgoals and habits
    """
    prompt = f"""
    You are a structured goal planning assistant.

    Group theme: {group_theme}
    User goal: {user_description}
    Constraints: {constraints}

    Return JSON:
    {{
      "goal": "...",
      "subgoals": [],
      "habits": []
    }}
    """

    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text


async def review_progress(context_summary):
    """
    Review user progress and provide coaching feedback.
    
    Args:
        context_summary: Summary of user's progress data
        
    Returns:
        Coaching feedback with encouragement, adjustments, and action steps
    """
    prompt = f"""
    You are a group accountability coach.
    Review the following progress data and provide:
    1. Encouragement
    2. Adjustments
    3. Specific action steps

    Context:
    {context_summary}
    """
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text


async def mentor_copilot(context, mentor_message):
    """
    Provide mentor assistance copilot responses.
    
    Args:
        context: Operational data and analytics for the patient
        mentor_message: Message from the mentor
        
    Returns:
        Mentor copilot response with data citations and next steps
    """
    prompt = f"""
    You are a mentor assistant copilot.
    Do not diagnose.
    Cite which data point you used.
    Propose next steps.

    Context:
    {context}

    Mentor message:
    {mentor_message}
    """
    if not model:
        raise ValueError("GEMINI_API_KEY not configured")
    response = model.generate_content(prompt)
    return response.text


# ---------------------------------------------------------------------------
# MCP-integrated chat
# ---------------------------------------------------------------------------

_MCP_TOOLS = None  # lazily initialised below


def _get_mcp_tools():
    """Build the Gemini tool declaration for the four MCP / Snowflake tools."""
    global _MCP_TOOLS
    if _MCP_TOOLS is not None:
        return _MCP_TOOLS
    if protos is None:
        raise ValueError("google.generativeai not available (GEMINI_API_KEY not set?)")

    _MCP_TOOLS = protos.Tool(function_declarations=[
        protos.FunctionDeclaration(
            name="get_user_summary",
            description=(
                "Fetch a full summary for a single user: profile (name, email), all goals "
                "with completion counts, adherence percentages (7d/30d/90d), current and "
                "longest streak, risk level and score, and the most recent check-ins. "
                "Call this first whenever you need context about the user."
            ),
            parameters=protos.Schema(
                type=protos.Type.OBJECT,
                properties={
                    "user_id": protos.Schema(
                        type=protos.Type.STRING,
                        description="UUID of the user (from Supabase auth.users).",
                    )
                },
                required=["user_id"],
            ),
        ),
        protos.FunctionDeclaration(
            name="get_user_goals",
            description=(
                "Fetch a detailed per-goal breakdown for a user: title, frequency, total "
                "check-ins, completed count, missed count, completion rate (%), and the "
                "full check-in history with timestamps. Use this when the user asks about "
                "specific goals or trends over time."
            ),
            parameters=protos.Schema(
                type=protos.Type.OBJECT,
                properties={
                    "user_id": protos.Schema(
                        type=protos.Type.STRING,
                        description="UUID of the user (from Supabase auth.users).",
                    )
                },
                required=["user_id"],
            ),
        ),
        protos.FunctionDeclaration(
            name="get_group_members",
            description=(
                "Fetch structured data for every member of a group: group name, member "
                "count, and for each member their profile, goals, adherence metrics, "
                "streak, risk level, and recent check-ins. Use when you need raw data to "
                "compare members or compute statistics."
            ),
            parameters=protos.Schema(
                type=protos.Type.OBJECT,
                properties={
                    "group_id": protos.Schema(
                        type=protos.Type.STRING,
                        description="UUID of the group (from Supabase groups table).",
                    )
                },
                required=["group_id"],
            ),
        ),
        protos.FunctionDeclaration(
            name="get_group_context",
            description=(
                "Fetch a pre-formatted plain-text summary of an entire group: every "
                "member's goals, completion counts, adherence, streak, risk level, and "
                "recent check-ins. Use when the user asks how the group is doing or wants "
                "a comparison between members."
            ),
            parameters=protos.Schema(
                type=protos.Type.OBJECT,
                properties={
                    "group_id": protos.Schema(
                        type=protos.Type.STRING,
                        description="UUID of the group (from Supabase groups table).",
                    )
                },
                required=["group_id"],
            ),
        ),
    ])
    return _MCP_TOOLS


def _dispatch_tool(name: str, args: dict) -> str:
    """Execute an MCP tool call by calling the snowflake service directly."""
    import json
    from app.services.snowflake_service import (
        get_user_summary as sf_user_summary,
        get_user_goals_detail,
        get_group_member_summaries,
        build_group_context_string,
    )

    try:
        if name == "get_user_summary":
            return json.dumps(sf_user_summary(args["user_id"]), default=str)
        if name == "get_user_goals":
            return json.dumps(get_user_goals_detail(args["user_id"]), default=str)
        if name == "get_group_members":
            return json.dumps(get_group_member_summaries(args["group_id"]), default=str)
        if name == "get_group_context":
            context_str, _ = build_group_context_string(args["group_id"])
            return context_str
        return f"Unknown tool: {name}"
    except Exception as e:
        return f"Tool error ({name}): {e}"


def chat_with_mcp_tools(user_id: str, group_id: str | None, user_message: str) -> str:
    """
    Send a user message to Gemini and let it fetch context dynamically via
    the MCP tools (get_user_summary, get_user_goals, get_group_members,
    get_group_context).  The model decides which tool(s) to call; we execute
    them against the Snowflake/Supabase service layer and return the results
    until Gemini produces a final text reply.

    Args:
        user_id:      UUID string of the current user.
        group_id:     UUID string of the current group, or None.
        user_message: Plain-text message from the user.

    Returns:
        Gemini's final text reply.
    """
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    system_instruction = (
        "You are MindBuddy, a supportive group accountability coach. "
        "Always use the available tools to fetch real-time data about the user's "
        "goals, progress, and group before responding — never answer from memory. "
        "Be specific: reference the user's actual goal names and data points. "
        "Keep your reply concise (under 200 words), warm, and actionable."
    )

    chat_model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview",
        tools=[_get_mcp_tools()],
        system_instruction=system_instruction,
    )

    id_context = f"User ID: {user_id}"
    if group_id:
        id_context += f"\nGroup ID: {group_id}"

    chat_session = chat_model.start_chat()
    response = chat_session.send_message(f"{id_context}\n\nUser message: {user_message}")

    # Agentic loop — keep handling tool calls until Gemini returns plain text.
    for _ in range(10):
        # Collect any function calls in this response turn
        function_calls = [
            part.function_call
            for part in response.candidates[0].content.parts
            if part.function_call.name  # non-empty name means it is a real call
        ]
        if not function_calls:
            break

        # Execute all tool calls and send results back in a single turn
        result_parts = [
            protos.Part(
                function_response=protos.FunctionResponse(
                    name=fc.name,
                    response={"result": _dispatch_tool(fc.name, dict(fc.args))},
                )
            )
            for fc in function_calls
        ]
        response = chat_session.send_message(
            protos.Content(parts=result_parts)
        )

    # Extract the final text reply
    for part in response.candidates[0].content.parts:
        if getattr(part, "text", None):
            return part.text

    return "No response generated."
