"""
Coach service — all context is fetched exclusively via MCP tool functions.

MCP tools mirror those exposed in mcp_server.py:
  get_user_summary   → snowflake_service.get_user_summary
  get_user_goals     → snowflake_service.get_user_goals_detail
  get_group_members  → snowflake_service.get_group_member_summaries
  get_group_context  → snowflake_service.build_group_context_string

No Supabase fallback — Snowflake is the single source of truth for context.
"""

import json
from typing import Any

from app.services.snowflake_service import (
    get_user_summary,
    get_user_goals_detail,
    get_group_member_summaries,
    build_group_context_string,
)


def execute_mcp_tool(tool_name: str, args: dict) -> str:
    """
    Execute an MCP tool by name and return the result as a string.

    Mirrors the tools defined in mcp_server.py so the same logic is
    available both through the MCP stdio server and the FastAPI backend's
    Gemini function-calling loop.

    Args:
        tool_name: One of get_user_summary, get_user_goals,
                   get_group_members, get_group_context.
        args:      Keyword arguments for the tool (e.g. {"user_id": "..."}).

    Returns:
        JSON string (for structured tools) or plain text (get_group_context).
        On error, returns a descriptive error string rather than raising.
    """
    try:
        if tool_name == "get_user_summary":
            data = get_user_summary(args["user_id"])
            return json.dumps(data, indent=2, default=str)

        if tool_name == "get_user_goals":
            data = get_user_goals_detail(args["user_id"])
            return json.dumps(data, indent=2, default=str)

        if tool_name == "get_group_members":
            data = get_group_member_summaries(args["group_id"])
            return json.dumps(data, indent=2, default=str)

        if tool_name == "get_group_context":
            context_str, _ = build_group_context_string(args["group_id"])
            return context_str

        return f"Unknown tool: {tool_name}"

    except Exception as exc:
        return f"Tool error ({tool_name}): {exc}"
