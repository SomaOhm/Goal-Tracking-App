"""AI coach: goal context from Snowflake then Supabase, Gemini replies."""

from app.config import settings
from app.utils.snowflake_utils import get_goals_context_snowflake
from app.supabase_client import get_supabase_client


def get_goal_context(user_id: str) -> tuple[str, str]:
    """
    Get goal + check-in context for the user. Tries Snowflake first, then Supabase.
    Returns (context_string, source) where source is "snowflake" or "supabase".
    """
    ctx_sf = get_goals_context_snowflake(user_id)
    if ctx_sf:
        return (ctx_sf, "snowflake")

    if not settings.SUPABASE_URL:
        return ("No goals data available. Configure Snowflake or Supabase.", "none")

    try:
        supabase = get_supabase_client()

        goals_res = supabase.table("goals").select("id, title, description, frequency, start_date, end_date, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        goals = goals_res.data or []

        goal_ids = [g["id"] for g in goals]
        completions_by_goal = {}
        if goal_ids:
            comp_res = supabase.table("goal_completions").select("goal_id, date, reflection").in_("goal_id", goal_ids).order("date", desc=True).execute()
            for c in comp_res.data or []:
                gid = c.get("goal_id")
                if gid not in completions_by_goal:
                    completions_by_goal[gid] = []
                completions_by_goal[gid].append(c)

        check_res = supabase.table("check_ins").select("date, mood, reflection").eq("user_id", user_id).order("date", desc=True).limit(20).execute()
        check_ins = check_res.data or []

        lines = [f"User ID: {user_id}", ""]
        if goals:
            lines.append("Goals (from Supabase):")
            for g in goals:
                title = g.get("title", "")
                desc = g.get("description") or ""
                freq = g.get("frequency", "")
                start = g.get("start_date") or ""
                end = g.get("end_date") or ""
                lines.append(f"  - {title} (frequency: {freq})")
                if desc:
                    lines.append(f"    Description: {desc}")
                if start or end:
                    lines.append(f"    Time frame: {start} to {end or 'ongoing'}")
                comps = completions_by_goal.get(g["id"], [])
                if comps:
                    lines.append(f"    Completions: {len(comps)}")
                    for c in comps[:5]:
                        ref = c.get("reflection") or ""
                        lines.append(f"      [{c.get('date')}]" + (f" reflection: {ref}" if ref else ""))
            lines.append("")
        if check_ins:
            lines.append("Recent check-ins:")
            for ci in check_ins:
                lines.append(f"  - {ci.get('date')}: mood {ci.get('mood', 0)}/5" + (f", {ci.get('reflection') or ''}" if ci.get("reflection") else ""))
        if not goals and not check_ins:
            return ("This user has no goals or check-ins yet.", "supabase")
        return ("\n".join(lines), "supabase")
    except Exception as e:
        return (f"Could not load goals: {e}", "none")
