"""Manual sync script for PostgreSQL → Snowflake synchronization."""

import asyncio
from app.database import AsyncSessionLocal, get_snowflake_connection
from app.repositories.checkin_repo import CheckinRepository
from app.repositories.goal_repo import GoalRepository
from app.repositories.user_repo import UserRepository
from sqlalchemy import select
from app.models import User, Goal
from datetime import datetime


async def sync_all_data():
    """
    Manually sync all data from PostgreSQL to Snowflake.
    
    Useful for initial setup or recovery operations.
    """
    print("Starting manual sync from PostgreSQL to Snowflake...")
    
    async with AsyncSessionLocal() as session:
        user_repo = UserRepository(session)
        goal_repo = GoalRepository(session)
        checkin_repo = CheckinRepository(session)
        
        # Get all data
        all_users = await user_repo.get_all()
        all_goals = [goal for user in all_users for goal in user.goals]
        all_checkins = []
        for user in all_users:
            checkins = await checkin_repo.get_by_user(user.id)
            all_checkins.extend(checkins)
        
        print(f"Found {len(all_users)} users, {len(all_goals)} goals, {len(all_checkins)} check-ins")
        
        # Connect to Snowflake
        conn = get_snowflake_connection()
        cursor = conn.cursor()
        
        try:
            # Sync users
            print("\nSyncing users...")
            for user in all_users:
                cursor.execute("""
                    INSERT INTO users_snapshot 
                    (user_id, name, mentor_id, created_at)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                    name=EXCLUDED.name,
                    mentor_id=EXCLUDED.mentor_id
                """, (
                    str(user.id),
                    user.name,
                    str(user.mentor_id) if user.mentor_id else None,
                    user.created_at.isoformat()
                ))
            print(f"✓ Synced {len(all_users)} users")
            
            # Sync goals
            print("Syncing goals...")
            for goal in all_goals:
                cursor.execute("""
                    INSERT INTO goals_snapshot 
                    (goal_id, user_id, title, category, frequency, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (goal_id) DO UPDATE SET
                    title=EXCLUDED.title,
                    category=EXCLUDED.category
                """, (
                    str(goal.id),
                    str(goal.user_id),
                    goal.title,
                    goal.category,
                    goal.frequency,
                    goal.created_at.isoformat()
                ))
            print(f"✓ Synced {len(all_goals)} goals")
            
            # Sync check-ins
            print("Syncing check-ins...")
            for checkin in all_checkins:
                cursor.execute("""
                    INSERT INTO staging_checkins 
                    (checkin_id, goal_id, user_id, completed, timestamp)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (checkin_id) DO UPDATE SET
                    completed=EXCLUDED.completed
                """, (
                    str(checkin.id),
                    str(checkin.goal_id),
                    str(checkin.user_id),
                    checkin.completed,
                    checkin.timestamp.isoformat()
                ))
            print(f"✓ Synced {len(all_checkins)} check-ins")
            
            conn.commit()
            print("\n✓ Manual sync completed successfully!")
            
        except Exception as e:
            conn.rollback()
            print(f"\n✗ Error during sync: {e}")
        finally:
            cursor.close()
            conn.close()


if __name__ == "__main__":
    asyncio.run(sync_all_data())
