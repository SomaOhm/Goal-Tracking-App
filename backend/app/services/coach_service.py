"""AI coach: goal context from Snowflake then Supabase, Gemini replies."""

from app.config import settings
from app.utils.snowflake_utils import get_goals_context_snowflake
from app.supabase_client import get_supabase_client


def _get_group_context_supabase(user_id: str) -> str:
    """
    Fetch group memberships and other members from Supabase.
    Always uses Supabase (groups live there regardless of where goals are stored).
    Returns a formatted string block, or empty string on failure.

    Note: group_members.user_id is a FK to auth.users, not public.profiles,
    so PostgREST cannot embed profiles directly. We fetch member IDs first,
    then look up profiles in a second query.
    """
    if not settings.SUPABASE_URL:
        return ""
    try:
        supabase = get_supabase_client()

        # Step 1: get the groups this user belongs to (with group id + name)
        groups_res = supabase.table("group_members").select("group_id, groups(id, name)").eq("user_id", user_id).execute()
        user_group_rows = [
            row for row in (groups_res.data or [])
            if row.get("groups") and row["groups"].get("name")
        ]

        if not user_group_rows:
            return ""

        lines: list[str] = ["Groups this user belongs to:"]
        for row in user_group_rows:
            gid = row["groups"]["id"]
            gname = row["groups"]["name"]
            lines.append(f"  - {gname}")
            try:
                # Step 2a: get other member user_ids in this group
                members_res = supabase.table("group_members").select("user_id").eq("group_id", gid).neq("user_id", user_id).execute()
                member_ids = [m["user_id"] for m in (members_res.data or []) if m.get("user_id")]
                # Step 2b: resolve names from public.profiles
                member_names: list[str] = []
                if member_ids:
                    profiles_res = supabase.table("profiles").select("name").in_("id", member_ids).execute()
                    member_names = [p["name"] for p in (profiles_res.data or []) if p.get("name")]
                if member_names:
                    lines.append(f"    Other members: {', '.join(member_names)}")
                else:
                    lines.append("    Other members: none yet")
            except Exception:
                pass  # leave member line absent rather than crashing

        return "\n".join(lines)
    except Exception:
        return ""


def get_goal_context(user_id: str) -> tuple[str, str]:
    """
    Get goal + check-in context for the user. Tries Snowflake first, then Supabase.
    Group membership is always appended from Supabase regardless of goal source.
    Returns (context_string, source) where source is "snowflake" or "supabase".
    """
    group_block = _get_group_context_supabase(user_id)

    ctx_sf = get_goals_context_snowflake(user_id)
    if ctx_sf:
        # Snowflake has goal/checkin data — append group context from Supabase
        if group_block:
            ctx_sf = ctx_sf + "\n\n" + group_block
        return (ctx_sf, "snowflake")

    if not settings.SUPABASE_URL:
        return ("No goals data available. Configure Snowflake or Supabase.", "none")

    try:
        supabase = get_supabase_client()

        goals_res = supabase.table("goals").select("id, title, description, frequency, start_date, end_date, created_at").eq("user_id", user_id).order("created_at", desc=True).execute()
        goals = goals_res.data or []

        goal_ids = [g["id"] for g in goals]
        completions_by_goal: dict = {}
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
        if group_block:
            lines.append(group_block)
            lines.append("")
        else:
            lines.append("Groups: none")
            lines.append("")

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
        if not goals and not check_ins and not group_block:
            return ("This user has no goals, check-ins, or groups yet.", "supabase")
        return ("\n".join(lines), "supabase")
    except Exception as e:
        return (f"Could not load goals: {e}", "none")
