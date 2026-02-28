"""Celery tasks for goal reviews and AI-generated feedback."""

import asyncio
import json
from datetime import datetime, timedelta
from worker.celery_app import celery
from app.services.gemini_service import review_progress, generate_goal_plan
from app.database import AsyncSessionLocal
from app.repositories.checkin_repo import CheckinRepository
from app.repositories.goal_repo import GoalRepository
from app.repositories.message_repo import MessageRepository
from app.models import Goal, GroupFeedPost, GoalPlanSuggestion
from app.utils.context_builder import build_goal_context
from sqlalchemy import select, distinct


@celery.task(bind=True)
def weekly_goal_review(self):
    """
    Generate weekly goal reviews for all active users.
    
    Gets the past week's check-ins and generates AI coaching feedback.
    Publishes AI coach post to group feed.
    """
    print(f"[{datetime.utcnow().isoformat()}] Starting weekly goal review...")
    
    async def run_review():
        async with AsyncSessionLocal() as session:
            goal_repo = GoalRepository(session)
            checkin_repo = CheckinRepository(session)
            message_repo = MessageRepository(session)
            
            # Get all unique users
            result = await session.execute(select(distinct(Goal.user_id)))
            user_ids = result.scalars().all()
            
            reviewed_count = 0
            
            for user_id in user_ids:
                try:
                    # Build context for this user
                    context = await build_goal_context(session, user_id)
                    context_str = json.dumps(context, indent=2)
                    
                    # Call Gemini for coaching feedback
                    ai_message = await review_progress(context_str)
                    
                    # Store as group feed post and message
                    feed_post = GroupFeedPost(
                        group_id=None,
                        user_id=user_id,
                        content=ai_message,
                        post_type="ai_coach",
                        metadata={
                            "context_used": list(context.keys()),
                            "review_type": "weekly"
                        }
                    )
                    session.add(feed_post)
                    
                    # Also store as message for reference
                    message = await message_repo.create(
                        user_id=user_id,
                        group_id=None,
                        content=ai_message,
                        is_ai=True
                    )
                    
                    reviewed_count += 1
                    print(f"  Reviewed user {user_id}: {message}")
                    
                except Exception as e:
                    print(f"  Error reviewing user {user_id}: {e}")
            
            await session.commit()
            
            return {
                "status": "success",
                "users_reviewed": reviewed_count,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    result = asyncio.run(run_review())
    print(f"  Result: {result}")
    return result


@celery.task(bind=True)
def daily_goal_reminder(self):
    """
    Send daily reminders to users about incomplete goals.
    
    For each user with incomplete check-ins today, generates a reminder message.
    """
    print(f"[{datetime.utcnow().isoformat()}] Starting daily reminders...")
    
    async def run_reminder():
        async with AsyncSessionLocal() as session:
            goal_repo = GoalRepository(session)
            checkin_repo = CheckinRepository(session)
            message_repo = MessageRepository(session)
            
            # Get all active users
            result = await session.execute(select(distinct(Goal.user_id)))
            user_ids = result.scalars().all()
            
            reminded_count = 0
            
            for user_id in user_ids:
                try:
                    # Get today's check-ins
                    today = datetime.utcnow().date()
                    user_checkins = await checkin_repo.get_by_user(user_id)
                    
                    incomplete = [
                        c for c in user_checkins
                        if c.timestamp.date() == today and not c.completed
                    ]
                    
                    if incomplete:
                        # Get user's goals for personalization
                        goals = await goal_repo.get_by_user(user_id)
                        goal_titles = [g.title for g in goals]
                        
                        message_text = f"""Good morning! 🌅
                        
You have {len(incomplete)} incomplete goal(s) today: {', '.join(goal_titles[:3])}.
                        
These are great opportunities to build momentum. Let's get them done! 💪"""
                        
                        await message_repo.create(
                            user_id=user_id,
                            group_id=None,
                            content=message_text,
                            is_ai=True
                        )
                        reminded_count += 1
                
                except Exception as e:
                    print(f"  Error reminding user {user_id}: {e}")
            
            return {
                "status": "success",
                "users_reminded": reminded_count,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    result = asyncio.run(run_reminder())
    print(f"  Result: {result}")
    return result


@celery.task(bind=True)
def generate_plan_suggestions(self):
    """
    Generate AI-suggested plan modifications based on recent performance.
    
    Analyzes adherence patterns and proposes adjustments (new subgoals, habits, etc.)
    """
    print(f"[{datetime.utcnow().isoformat()}] Generating plan suggestions...")
    
    async def run_suggestions():
        async with AsyncSessionLocal() as session:
            # Get all goals
            result = await session.execute(select(Goal))
            goals = result.scalars().all()
            
            suggestion_count = 0
            
            for goal in goals:
                try:
                    # Get goal's recent checkins
                    checkin_repo = CheckinRepository(session)
                    goal_checkins = [c for c in await checkin_repo.get_by_goal(goal.id)]
                    
                    if not goal_checkins:
                        continue
                    
                    # Calculate completion rate
                    completed = sum(1 for c in goal_checkins if c.completed)
                    completion_rate = completed / len(goal_checkins) if goal_checkins else 0
                    
                    # Get goal context
                    context = await build_goal_context(session, goal.user_id)
                    
                    # Generate suggestions if completion is low or new user
                    if completion_rate < 0.7 or (datetime.utcnow() - goal.created_at).days < 7:
                        prompt = f"""
                        Analyze this goal and suggest improvements:
                        
                        Goal: {goal.title}
                        Category: {goal.category}
                        Frequency: {goal.frequency}
                        Completion Rate: {completion_rate * 100:.1f}%
                        
                        Context: {json.dumps(context)}
                        
                        Suggest:
                        1. One new sub-goal that would help
                        2. One new daily/weekly habit
                        3. One adjustment to the frequency/approach
                        
                        Format as JSON with keys: new_subgoal, new_habit, frequency_adjustment
                        """
                        
                        suggestions_text = await generate_goal_plan(
                            goal.title, goal.category, {"completion_rate": completion_rate}
                        )
                        
                        # Try to parse as JSON, otherwise store as text
                        try:
                            suggestions_json = json.loads(suggestions_text)
                        except:
                            suggestions_json = {"raw_suggestion": suggestions_text}
                        
                        suggestion = GoalPlanSuggestion(
                            goal_id=goal.id,
                            user_id=goal.user_id,
                            suggestion_type="adjustment",
                            ai_suggestion=suggestions_json,
                            created_at=datetime.utcnow()
                        )
                        session.add(suggestion)
                        suggestion_count += 1
                
                except Exception as e:
                    print(f"  Error suggesting for goal {goal.id}: {e}")
            
            await session.commit()
            
            return {
                "status": "success",
                "suggestions_created": suggestion_count,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    result = asyncio.run(run_suggestions())
    print(f"  Result: {result}")
    return result


@celery.task(bind=True)
def monthly_progress_report(self):
    """
    Generate comprehensive monthly progress reports for users.
    
    Aggregates month's data and provides detailed feedback.
    """
    print(f"[{datetime.utcnow().isoformat()}] Generating monthly reports...")
    
    async def run_report():
        async with AsyncSessionLocal() as session:
            message_repo = MessageRepository(session)
            
            # Get all users
            from app.models import User
            result = await session.execute(select(distinct(Goal.user_id)))
            user_ids = result.scalars().all()
            
            reported_count = 0
            month_ago = datetime.utcnow() - timedelta(days=30)
            
            for user_id in user_ids:
                try:
                    # Build context
                    context = await build_goal_context(session, user_id)
                    
                    # Filter to month's checkins
                    context["checkins"] = [
                        c for c in context.get("checkins", [])
                        if datetime.fromisoformat(c["timestamp"]) > month_ago
                    ]
                    
                    if not context["checkins"]:
                        continue
                    
                    # Generate comprehensive report
                    report = await review_progress(json.dumps(context))
                    
                    await message_repo.create(
                        user_id=user_id,
                        group_id=None,
                        content=f"📊 Monthly Progress Report:\n\n{report}",
                        is_ai=True
                    )
                    reported_count += 1
                
                except Exception as e:
                    print(f"  Error generating report for {user_id}: {e}")
            
            return {
                "status": "success",
                "reports_generated": reported_count,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    result = asyncio.run(run_report())
    print(f"  Result: {result}")
    return result
