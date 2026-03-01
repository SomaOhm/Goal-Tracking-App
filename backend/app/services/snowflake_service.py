"""
Snowflake service — fetches user and group analytics for Gemini context.

All data comes exclusively from Snowflake. Supabase -> Snowflake sync is
handled by the Celery worker (see worker/sync_tasks.py and sync_config.yaml).

Table mapping (Supabase source -> Snowflake target):
  profiles          -> dim_profiles
  goals             -> dim_goals
  goal_completions  -> fact_goal_completions
  check_ins         -> fact_check_ins
  groups            -> dim_groups
  group_members     -> fact_group_members

Computed analytics tables (populated by Celery):
  metrics_adherence, metrics_streak, metrics_risk
"""

from __future__ import annotations

from typing import Any

from app.database import get_snowflake_connection


# ---------------------------------------------------------------------------
# Low-level helper — open a connection, run a query, close everything
# ---------------------------------------------------------------------------

def _query(sql: str, params: tuple = ()) -> list[Any]:  # type: ignore[return]
    """Execute a read-only query against Snowflake and return all rows."""
    conn = get_snowflake_connection()
    cur = conn.cursor()
    try:
        cur.execute(sql, params)
        return cur.fetchall()  # type: ignore[return-value]
    finally:
        cur.close()
        conn.close()


def _query_one(sql: str, params: tuple = ()) -> tuple | None:
    """Execute a read-only query and return the first row (or None)."""
    rows = _query(sql, params)
    return rows[0] if rows else None


# ---------------------------------------------------------------------------
# Single-user helpers  (used by get_user_summary / get_user_goals_detail)
# ---------------------------------------------------------------------------

def _sf_profile(user_id: str) -> dict:
    row = _query_one(
        "SELECT id, name, email FROM dim_profiles WHERE id = %s",
        (user_id,),
    )
    if row:
        return {"id": str(row[0]), "name": row[1], "email": row[2]}
    return {}


def _sf_goals(user_id: str) -> list[dict]:
    rows = _query(
        """
        SELECT id, title, description, frequency, created_at
        FROM   dim_goals
        WHERE  user_id = %s
        ORDER  BY created_at DESC
        """,
        (user_id,),
    )
    return [
        {
            "id":          str(r[0]),
            "title":       r[1],
            "description": r[2] or "",
            "frequency":   r[3] or "",
            "created_at":  str(r[4]) if r[4] else None,
        }
        for r in rows
    ]


def _sf_completions(goal_ids: list[str]) -> dict[str, list]:
    """fact_goal_completions grouped by goal_id."""
    if not goal_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(goal_ids))
    rows = _query(
        f"""
        SELECT goal_id, date, reflection
        FROM   fact_goal_completions
        WHERE  goal_id IN ({placeholders})
        ORDER  BY date DESC
        """,
        tuple(goal_ids),
    )
    by_goal: dict[str, list] = {}
    for goal_id, date, reflection in rows:
        by_goal.setdefault(str(goal_id), []).append(
            {"date": str(date), "completed": True, "reflection": reflection}
        )
    return by_goal


def _sf_check_ins(user_id: str, limit: int = 20) -> list[dict]:
    """Recent mood check-ins from fact_check_ins."""
    rows = _query(
        """
        SELECT date, mood, reflection
        FROM   fact_check_ins
        WHERE  user_id = %s
        ORDER  BY date DESC
        LIMIT  %s
        """,
        (user_id, limit),
    )
    return [
        {"date": str(r[0]), "mood": r[1], "reflection": r[2]}
        for r in rows
    ]


def _sf_adherence(user_id: str) -> dict:
    try:
        row = _query_one(
            """
            SELECT adherence_7d, adherence_30d, adherence_90d,
                   checkins_completed_7d, checkins_total_7d
            FROM   metrics_adherence
            WHERE  user_id = %s
            ORDER  BY metric_date DESC
            LIMIT  1
            """,
            (user_id,),
        )
        if row:
            return {
                "adherence_7d":  round(float(row[0] or 0), 1),
                "adherence_30d": round(float(row[1] or 0), 1),
                "adherence_90d": round(float(row[2] or 0), 1),
                "completed_7d":  int(row[3] or 0),
                "total_7d":      int(row[4] or 0),
            }
    except Exception:
        pass
    return {
        "adherence_7d": None, "adherence_30d": None, "adherence_90d": None,
        "completed_7d": None, "total_7d": None,
    }


def _sf_streak(user_id: str) -> dict:
    try:
        row = _query_one(
            """
            SELECT current_streak, longest_streak, last_completion
            FROM   metrics_streak
            WHERE  user_id = %s
            """,
            (user_id,),
        )
        if row:
            return {
                "current_streak":  int(row[0] or 0),
                "longest_streak":  int(row[1] or 0),
                "last_completion": str(row[2]) if row[2] else None,
            }
    except Exception:
        pass
    return {"current_streak": None, "longest_streak": None, "last_completion": None}


def _sf_risk(user_id: str) -> dict:
    try:
        row = _query_one(
            """
            SELECT risk_level, risk_score, missed_count_3d,
                   missed_count_7d, last_checkin_days_ago
            FROM   metrics_risk
            WHERE  user_id = %s
            """,
            (user_id,),
        )
        if row:
            return {
                "risk_level":            row[0] or "unknown",
                "risk_score":            round(float(row[1] or 0), 3),
                "missed_count_3d":       int(row[2] or 0),
                "missed_count_7d":       int(row[3] or 0),
                "last_checkin_days_ago": row[4],
            }
    except Exception:
        pass
    return {
        "risk_level": None, "risk_score": None, "missed_count_3d": None,
        "missed_count_7d": None, "last_checkin_days_ago": None,
    }


# ---------------------------------------------------------------------------
# Batched group helpers — one query per data type for ALL members at once
# ---------------------------------------------------------------------------

def _sf_group_info(group_id: str) -> dict:
    row = _query_one(
        "SELECT id, name, created_at FROM dim_groups WHERE id = %s",
        (group_id,),
    )
    if row:
        return {"id": str(row[0]), "name": row[1], "created_at": str(row[2]) if row[2] else None}
    return {}


def _sf_group_member_ids(group_id: str) -> list[str]:
    rows = _query(
        "SELECT user_id FROM fact_group_members WHERE group_id = %s",
        (group_id,),
    )
    return [str(r[0]) for r in rows]


def _sf_profiles_batch(user_ids: list[str]) -> dict[str, dict]:
    """Returns {user_id: {name, email}} for all given user_ids in one query."""
    if not user_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(user_ids))
    rows = _query(
        f"SELECT id, name, email FROM dim_profiles WHERE id IN ({placeholders})",
        tuple(user_ids),
    )
    return {str(r[0]): {"name": r[1], "email": r[2]} for r in rows}


def _sf_goals_batch(user_ids: list[str]) -> dict[str, list]:
    """Returns {user_id: [goal_dict, ...]} for all given user_ids in one query."""
    if not user_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(user_ids))
    rows = _query(
        f"""
        SELECT user_id, id, title, description, frequency, created_at
        FROM   dim_goals
        WHERE  user_id IN ({placeholders})
        ORDER  BY created_at DESC
        """,
        tuple(user_ids),
    )
    by_user: dict[str, list] = {}
    for user_id, gid, title, desc, freq, created_at in rows:
        by_user.setdefault(str(user_id), []).append({
            "id":          str(gid),
            "title":       title,
            "description": desc or "",
            "frequency":   freq or "",
            "created_at":  str(created_at) if created_at else None,
        })
    return by_user


def _sf_completions_batch(goal_ids: list[str]) -> dict[str, list]:
    """Returns {goal_id: [completion_dict, ...]} for all given goal_ids in one query."""
    if not goal_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(goal_ids))
    rows = _query(
        f"""
        SELECT goal_id, date, reflection
        FROM   fact_goal_completions
        WHERE  goal_id IN ({placeholders})
        ORDER  BY date DESC
        """,
        tuple(goal_ids),
    )
    by_goal: dict[str, list] = {}
    for goal_id, date, reflection in rows:
        by_goal.setdefault(str(goal_id), []).append(
            {"date": str(date), "completed": True, "reflection": reflection}
        )
    return by_goal


def _sf_check_ins_batch(user_ids: list[str], limit_per_user: int = 20) -> dict[str, list]:
    """Returns {user_id: [check_in_dict, ...]} for all given user_ids in one query."""
    if not user_ids:
        return {}
    placeholders = ", ".join(["%s"] * len(user_ids))
    rows = _query(
        f"""
        SELECT user_id, date, mood, reflection
        FROM   fact_check_ins
        WHERE  user_id IN ({placeholders})
        ORDER  BY date DESC
        """,
        tuple(user_ids),
    )
    by_user: dict[str, list] = {}
    for user_id, date, mood, reflection in rows:
        uid = str(user_id)
        bucket = by_user.setdefault(uid, [])
        if len(bucket) < limit_per_user:
            bucket.append({"date": str(date), "mood": mood, "reflection": reflection})
    return by_user


def _sf_adherence_batch(user_ids: list[str]) -> dict[str, dict]:
    """Returns {user_id: adherence_dict} for all given user_ids in one query."""
    if not user_ids:
        return {}
    try:
        placeholders = ", ".join(["%s"] * len(user_ids))
        rows = _query(
            f"""
            SELECT user_id, adherence_7d, adherence_30d, adherence_90d,
                   checkins_completed_7d, checkins_total_7d
            FROM (
                SELECT user_id, adherence_7d, adherence_30d, adherence_90d,
                       checkins_completed_7d, checkins_total_7d,
                       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY metric_date DESC) AS rn
                FROM   metrics_adherence
                WHERE  user_id IN ({placeholders})
            ) t
            WHERE rn = 1
            """,
            tuple(user_ids),
        )
        result: dict[str, dict] = {}
        for user_id, a7, a30, a90, comp7, total7 in rows:
            result[str(user_id)] = {
                "adherence_7d":  round(float(a7 or 0), 1),
                "adherence_30d": round(float(a30 or 0), 1),
                "adherence_90d": round(float(a90 or 0), 1),
                "completed_7d":  int(comp7 or 0),
                "total_7d":      int(total7 or 0),
            }
        return result
    except Exception:
        return {}


def _sf_streak_batch(user_ids: list[str]) -> dict[str, dict]:
    """Returns {user_id: streak_dict} for all given user_ids in one query."""
    if not user_ids:
        return {}
    try:
        placeholders = ", ".join(["%s"] * len(user_ids))
        rows = _query(
            f"""
            SELECT user_id, current_streak, longest_streak, last_completion
            FROM   metrics_streak
            WHERE  user_id IN ({placeholders})
            """,
            tuple(user_ids),
        )
        return {
            str(r[0]): {
                "current_streak":  int(r[1] or 0),
                "longest_streak":  int(r[2] or 0),
                "last_completion": str(r[3]) if r[3] else None,
            }
            for r in rows
        }
    except Exception:
        return {}


def _sf_risk_batch(user_ids: list[str]) -> dict[str, dict]:
    """Returns {user_id: risk_dict} for all given user_ids in one query."""
    if not user_ids:
        return {}
    try:
        placeholders = ", ".join(["%s"] * len(user_ids))
        rows = _query(
            f"""
            SELECT user_id, risk_level, risk_score, missed_count_3d,
                   missed_count_7d, last_checkin_days_ago
            FROM   metrics_risk
            WHERE  user_id IN ({placeholders})
            """,
            tuple(user_ids),
        )
        return {
            str(r[0]): {
                "risk_level":            r[1] or "unknown",
                "risk_score":            round(float(r[2] or 0), 3),
                "missed_count_3d":       int(r[3] or 0),
                "missed_count_7d":       int(r[4] or 0),
                "last_checkin_days_ago": r[5],
            }
            for r in rows
        }
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Default/empty metric dicts (used when a user has no row in a metrics table)
# ---------------------------------------------------------------------------

_EMPTY_ADHERENCE = {
    "adherence_7d": None, "adherence_30d": None, "adherence_90d": None,
    "completed_7d": None, "total_7d": None,
}
_EMPTY_STREAK = {"current_streak": None, "longest_streak": None, "last_completion": None}
_EMPTY_RISK   = {
    "risk_level": None, "risk_score": None, "missed_count_3d": None,
    "missed_count_7d": None, "last_checkin_days_ago": None,
}


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def get_user_summary(user_id: str) -> dict:
    """
    Full summary for a single user:
      - profile (name, email)
      - goals list with per-goal completion counts
      - adherence %, streak, risk from Snowflake metrics tables
      - recent check-ins

    All data sourced exclusively from Snowflake.
    """
    profile  = _sf_profile(user_id)
    goals    = _sf_goals(user_id)
    goal_ids = [g["id"] for g in goals]

    completions_by_goal = _sf_completions(goal_ids)

    goals_out = []
    for g in goals:
        comps = completions_by_goal.get(g["id"], [])
        goals_out.append({
            "id":                 g["id"],
            "title":              g["title"],
            "description":        g["description"],
            "frequency":          g["frequency"],
            "total_completions":  len(comps),
            "completed_count":    len(comps),  # every fact_goal_completions row = a completion
            "recent_completions": comps[:10],
        })

    return {
        "user_id":   user_id,
        "name":      profile.get("name", "Unknown"),
        "email":     profile.get("email"),
        "goals":     goals_out,
        "check_ins": _sf_check_ins(user_id),
        "adherence": _sf_adherence(user_id),
        "streak":    _sf_streak(user_id),
        "risk":      _sf_risk(user_id),
    }


def get_user_goals_detail(user_id: str) -> list[dict]:
    """
    Detailed per-goal breakdown with full completion history.
    All data sourced exclusively from Snowflake.
    """
    goals    = _sf_goals(user_id)
    goal_ids = [g["id"] for g in goals]

    completions_by_goal = _sf_completions(goal_ids)

    result = []
    for g in goals:
        comps     = completions_by_goal.get(g["id"], [])
        total     = len(comps)
        completed = total  # every row in fact_goal_completions is a completion event

        result.append({
            "id":               g["id"],
            "title":            g["title"],
            "description":      g["description"],
            "frequency":        g["frequency"],
            "total_checkins":   total,
            "completed_count":  completed,
            "missed_count":     0,  # not tracked at row level; use metrics_risk for missed counts
            "completion_rate":  100.0 if total else 0.0,
            "checkin_history":  comps,
        })

    return result


def get_group_member_summaries(group_id: str) -> dict:
    """
    Group info + a summary for every member.

    Uses batched Snowflake queries (one per data type) to avoid the
    per-member N+1 problem that caused 30s timeouts on large groups.
    """
    group_info = _sf_group_info(group_id)
    member_ids = _sf_group_member_ids(group_id)

    if not member_ids:
        return {
            "group_id":     group_id,
            "group_name":   group_info.get("name", "Unknown Group"),
            "member_count": 0,
            "members":      [],
        }

    # --- one query per data type, all members at once ---
    profiles_by_user    = _sf_profiles_batch(member_ids)
    goals_by_user       = _sf_goals_batch(member_ids)

    all_goal_ids = [
        g["id"]
        for goals in goals_by_user.values()
        for g in goals
    ]
    completions_by_goal  = _sf_completions_batch(all_goal_ids)
    check_ins_by_user    = _sf_check_ins_batch(member_ids)
    adherence_by_user    = _sf_adherence_batch(member_ids)
    streak_by_user       = _sf_streak_batch(member_ids)
    risk_by_user         = _sf_risk_batch(member_ids)

    members = []
    for uid in member_ids:
        profile  = profiles_by_user.get(uid, {})
        goals    = goals_by_user.get(uid, [])

        goals_out = []
        for g in goals:
            comps = completions_by_goal.get(g["id"], [])
            goals_out.append({
                "id":                 g["id"],
                "title":              g["title"],
                "description":        g["description"],
                "frequency":          g["frequency"],
                "total_completions":  len(comps),
                "completed_count":    len(comps),
                "recent_completions": comps[:10],
            })

        members.append({
            "user_id":   uid,
            "name":      profile.get("name", "Unknown"),
            "email":     profile.get("email"),
            "goals":     goals_out,
            "check_ins": check_ins_by_user.get(uid, []),
            "adherence": adherence_by_user.get(uid, _EMPTY_ADHERENCE),
            "streak":    streak_by_user.get(uid, _EMPTY_STREAK),
            "risk":      risk_by_user.get(uid, _EMPTY_RISK),
        })

    return {
        "group_id":     group_id,
        "group_name":   group_info.get("name", "Unknown Group"),
        "member_count": len(members),
        "members":      members,
    }


def build_group_context_string(group_id: str) -> tuple[str, str]:
    """
    Plain-text context string for a group, ready to inject into a Gemini prompt.
    Returns (context_string, group_name).
    """
    data       = get_group_member_summaries(group_id)
    group_name = data["group_name"]

    lines = [
        f"Group: {group_name} ({data['member_count']} member{'s' if data['member_count'] != 1 else ''})",
        "",
    ]

    for m in data["members"]:
        lines.append(f"--- {m['name']} ---")

        if m["goals"]:
            lines.append("Goals:")
            for g in m["goals"]:
                freq  = f" ({g['frequency']})" if g.get("frequency") else ""
                comps = g["completed_count"]
                total = g["total_completions"]
                lines.append(f"  - {g['title']}{freq}: {comps}/{total} completions")
        else:
            lines.append("  No goals recorded.")

        adh = m["adherence"]
        if adh.get("adherence_7d") is not None:
            lines.append(
                f"Adherence: {adh['adherence_7d']}% (7d)  |  {adh['adherence_30d']}% (30d)"
            )

        streak = m["streak"]
        if streak.get("current_streak") is not None:
            lines.append(
                f"Streak: {streak['current_streak']} day(s) current, "
                f"{streak['longest_streak']} day(s) longest"
            )

        risk = m["risk"]
        if risk.get("risk_level"):
            lines.append(
                f"Risk: {risk['risk_level']} (score {risk['risk_score']}, "
                f"{risk['missed_count_7d']} missed last 7d)"
            )

        cis = m.get("check_ins", [])
        if cis:
            lines.append("Recent check-ins:")
            for ci in cis[:5]:
                mood = ci.get("mood", "")
                ref  = ci.get("reflection", "") or ""
                line = f"  [{ci.get('date')}] mood {mood}/5"
                if ref:
                    line += f" — {ref}"
                lines.append(line)

        lines.append("")

    return "\n".join(lines), group_name
