"""
MindBuddy MCP Server

Exposes Snowflake + Supabase data as MCP tools so that Gemini (or any
MCP-compatible LLM) can fetch user and group context on demand.

Tools:
  - get_user_summary      : profile, goals, completions, adherence, streak, risk
  - get_user_goals        : per-goal breakdown with full check-in history
  - get_group_members     : all members of a group with their summaries
  - get_group_context     : pre-formatted plain-text context string for a group

Run with:
    python mcp_server.py

The server speaks the MCP stdio transport protocol — pipe it into any
MCP-compatible client (e.g. Claude Desktop, or the future Gemini integration).

The API_BASE_URL env var controls which FastAPI instance to call.
Defaults to http://localhost:8000.
"""

import json
import os
import sys
import logging

import httpx
from mcp.server.fastmcp import FastMCP

# ---------------------------------------------------------------------------
# Logging — must go to stderr only (stdout is reserved for MCP JSON-RPC)
# ---------------------------------------------------------------------------
logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                    format="[mcp_server] %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000").rstrip("/")
REQUEST_TIMEOUT = 30.0  # seconds

# ---------------------------------------------------------------------------
# MCP server instance
# ---------------------------------------------------------------------------
mcp = FastMCP("mindbuddy")


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------
def _get(path: str) -> dict:
    """
    Make a GET request to the FastAPI backend and return parsed JSON.
    Raises a RuntimeError with a clear message on any failure so the
    tool can return a useful string to the LLM instead of crashing.
    """
    url = f"{API_BASE_URL}{path}"
    log.info("GET %s", url)
    try:
        resp = httpx.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise RuntimeError(
            f"API returned {e.response.status_code} for {url}: {e.response.text}"
        )
    except httpx.RequestError as e:
        raise RuntimeError(
            f"Could not reach API at {url}. Is the backend running? Error: {e}"
        )


# ---------------------------------------------------------------------------
# MCP Tools
# ---------------------------------------------------------------------------

@mcp.tool()
def get_user_summary(user_id: str) -> str:
    """
    Fetch a full summary for a single user.

    Returns their profile (name, email), all goals with completion counts,
    adherence percentages (7d / 30d / 90d), current and longest streak,
    risk level and score, and their most recent check-ins.

    Use this when the user asks about their own progress, stats, or history,
    or when you need context about a specific member before giving advice.

    Args:
        user_id: The UUID of the user (from Supabase auth.users).
    """
    try:
        data = _get(f"/snowflake/user/{user_id}/summary")
        return json.dumps(data, indent=2, default=str)
    except RuntimeError as e:
        return str(e)


@mcp.tool()
def get_user_goals(user_id: str) -> str:
    """
    Fetch a detailed per-goal breakdown for a user.

    For each goal returns: title, frequency, total check-ins, completed count,
    missed count, completion rate (%), and the full check-in history with
    timestamps and completion status.

    Use this when the user asks for detailed goal-level analysis, trends over
    time, or which specific goals they are struggling with.

    Args:
        user_id: The UUID of the user (from Supabase auth.users).
    """
    try:
        data = _get(f"/snowflake/user/{user_id}/goals")
        return json.dumps(data, indent=2, default=str)
    except RuntimeError as e:
        return str(e)


@mcp.tool()
def get_group_members(group_id: str) -> str:
    """
    Fetch structured data for every member of a group.

    Returns the group name, member count, and for each member: their profile,
    goals with completion counts, adherence metrics, streak, risk level, and
    recent check-ins.

    Use this when you need raw structured data about the group to perform
    comparisons or compute statistics yourself.

    Args:
        group_id: The UUID of the group (from Supabase groups table).
    """
    try:
        data = _get(f"/snowflake/group/{group_id}/members")
        return json.dumps(data, indent=2, default=str)
    except RuntimeError as e:
        return str(e)


@mcp.tool()
def get_group_context(group_id: str) -> str:
    """
    Fetch a pre-formatted plain-text summary of an entire group.

    Returns a human-readable block describing every member's goals,
    completion counts, adherence %, streak, risk level, and recent
    check-ins — ready to read and reason about directly.

    Use this when the user asks how the group is doing, wants a comparison
    between members, or asks for group-level encouragement or advice.

    Example output:
        Group: Running Club (3 members)

        --- Alice ---
        Goals:
          - Run 5k (daily): 18/21 completions
        Adherence: 85.0% (7d)  |  80.0% (30d)
        Streak: 6 day(s) current, 10 day(s) longest
        Risk: low (score 0.1, 1 missed last 7d)
        ...

    Args:
        group_id: The UUID of the group (from Supabase groups table).
    """
    try:
        data = _get(f"/snowflake/group/{group_id}/context")
        return data.get("context", json.dumps(data, default=str))
    except RuntimeError as e:
        return str(e)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    log.info("MindBuddy MCP server starting (API_BASE_URL=%s)", API_BASE_URL)
    mcp.run(transport="stdio")
