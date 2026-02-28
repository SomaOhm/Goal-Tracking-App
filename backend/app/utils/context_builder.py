"""Context builder for constructing AI prompt context from user data."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Goal, Checkin, Message, JournalEntry, Subgoal, Habit
from datetime import datetime, timedelta


async def build_goal_context(session: AsyncSession, user_id) -> dict:
    """
    Build context for goal-related AI operations.
    
    Args:
        session: AsyncSession for database queries
        user_id: ID of the user
        
    Returns:
        Dictionary containing user's goals and recent check-ins
    """
    # Get user's active goals
    goals_result = await session.execute(
        select(Goal).where(Goal.user_id == user_id)
    )
    goals = goals_result.scalars().all()

    # Get recent checkins (last 14 days)
    week_ago = datetime.utcnow() - timedelta(days=14)
    checkins_result = await session.execute(
        select(Checkin).where(
            (Checkin.user_id == user_id) & (Checkin.timestamp >= week_ago)
        ).order_by(Checkin.timestamp.desc())
    )
    recent_checkins = checkins_result.scalars().all()
    
    # Calculate completion ratio
    if recent_checkins:
        completed = sum(1 for c in recent_checkins if c.completed)
        completion_ratio = completed / len(recent_checkins)
    else:
        completion_ratio = 0.0

    return {
        "goals": [
            {
                "id": str(g.id),
                "title": g.title,
                "category": g.category,
                "frequency": g.frequency,
                "created_at": g.created_at.isoformat(),
                "days_active": (datetime.utcnow() - g.created_at).days
            }
            for g in goals
        ],
        "recent_completion_ratio": completion_ratio,
        "checkins": [
            {
                "id": str(c.id),
                "goal_id": str(c.goal_id),
                "completed": c.completed,
                "timestamp": c.timestamp.isoformat(),
                "notes": c.notes
            }
            for c in recent_checkins
        ],
        "stats": {
            "total_goals": len(goals),
            "total_checkins_14d": len(recent_checkins),
            "completion_ratio": completion_ratio
        }
    }


async def build_mentor_context(session: AsyncSession, user_id) -> dict:
    """
    Build comprehensive context for mentor operations.
    
    Includes operational data + recent interactions + sentiment trends.
    
    Args:
        session: AsyncSession for database queries
        user_id: ID of the mentee user
        
    Returns:
        Dictionary containing mentee's operational data, messages, and journal
    """
    context = await build_goal_context(session, user_id)
    
    # Get recent messages (last 10)
    messages_result = await session.execute(
        select(Message)
        .where(Message.user_id == user_id)
        .order_by(Message.created_at.desc())
        .limit(10)
    )
    messages = messages_result.scalars().all()
    
    context["recent_messages"] = [
        {
            "id": str(m.id),
            "user_message": m.user_message,
            "ai_reply": m.ai_reply,
            "type": m.message_type,
            "created_at": m.created_at.isoformat()
        }
        for m in reversed(messages)
    ]
    
    # Get recent journal entries
    week_ago = datetime.utcnow() - timedelta(days=7)
    journal_result = await session.execute(
        select(JournalEntry)
        .where(
            (JournalEntry.user_id == user_id) & 
            (JournalEntry.created_at >= week_ago)
        )
        .order_by(JournalEntry.created_at.desc())
        .limit(5)
    )
    journal_entries = journal_result.scalars().all()
    
    context["journal_entries"] = [
        {
            "date": je.created_at.isoformat(),
            "text": je.text[:200],  # First 200 chars
            "sentiment_score": je.sentiment_score,
            "mood_tags": je.mood_tags
        }
        for je in journal_entries
    ]
    
    # Calculate mood trend
    if journal_entries:
        sentiment_scores = [je.sentiment_score for je in journal_entries if je.sentiment_score]
        if sentiment_scores:
            avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
            context["mood_trend"] = {
                "avg_sentiment": avg_sentiment,
                "trend": "improving" if avg_sentiment > 0.3 else "declining" if avg_sentiment < -0.3 else "neutral"
            }
    
    return context


async def get_goal_details_with_plan(session: AsyncSession, goal_id) -> dict:
    """
    Get detailed goal info including AI-generated plan, subgoals, and habits.
    
    Args:
        session: AsyncSession
        goal_id: ID of the goal
        
    Returns:
        Detailed goal structure
    """
    goal_result = await session.execute(
        select(Goal).where(Goal.id == goal_id)
    )
    goal = goal_result.scalar_one_or_none()
    
    if not goal:
        return None
    
    # Get subgoals
    subgoals_result = await session.execute(
        select(Subgoal).where(Subgoal.goal_id == goal_id)
    )
    subgoals = subgoals_result.scalars().all()
    
    # Get habits
    habits_result = await session.execute(
        select(Habit).where(Habit.goal_id == goal_id)
    )
    habits = habits_result.scalars().all()
    
    return {
        "goal": {
            "id": str(goal.id),
            "title": goal.title,
            "description": goal.description,
            "category": goal.category,
            "frequency": goal.frequency,
            "ai_plan": goal.ai_plan,
            "created_at": goal.created_at.isoformat()
        },
        "subgoals": [
            {
                "id": str(sg.id),
                "title": sg.title,
                "status": sg.status,
                "order": sg.order
            }
            for sg in subgoals
        ],
        "habits": [
            {
                "id": str(h.id),
                "title": h.title,
                "frequency": h.frequency,
                "schedule": h.schedule
            }
            for h in habits
        ]
    }


async def calculate_user_streak(session: AsyncSession, user_id) -> dict:
    """Calculate current streak for user."""
    checkins_result = await session.execute(
        select(Checkin)
        .where(Checkin.user_id == user_id)
        .order_by(Checkin.timestamp.desc())
    )
    checkins = checkins_result.scalars().all()
    
    if not checkins:
        return {"current_streak": 0, "longest_streak": 0}
    
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    
    for checkin in checkins:
        if checkin.completed:
            temp_streak += 1
            current_streak = temp_streak
        else:
            longest_streak = max(longest_streak, temp_streak)
            temp_streak = 0
    
    longest_streak = max(longest_streak, temp_streak)
    
    return {
        "current_streak": current_streak,
        "longest_streak": longest_streak
    }
