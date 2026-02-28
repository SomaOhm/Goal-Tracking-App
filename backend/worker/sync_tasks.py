"""Celery tasks for syncing data from PostgreSQL to Snowflake."""

import asyncio
import json
from datetime import datetime
from worker.celery_app import celery
from app.database import AsyncSessionLocal, get_snowflake_connection
from app.models import User, Goal, Checkin, JournalEntry
from sqlalchemy import select
from app.utils.snowflake_utils import compute_adherence_metrics, detect_risk_patterns


@celery.task(bind=True)
def sync_all_data_to_snowflake(self):
    """
    Master sync task: orchestrates syncing users, goals, and check-ins.
    
    Runs every 5 minutes in production.
    """
    print(f"[{datetime.utcnow().isoformat()}] Starting full sync to Snowflake...")
    
    async def run_sync():
        async with AsyncSessionLocal() as session:
            # Get all data needing sync
            users_result = await session.execute(select(User))
            users = users_result.scalars().all()
            
            goals_result = await session.execute(select(Goal))
            goals = goals_result.scalars().all()
            
            checkins_result = await session.execute(
                select(Checkin).where(Checkin.synced_to_snowflake == False)
            )
            unsynced_checkins = checkins_result.scalars().all()
            
            journal_result = await session.execute(select(JournalEntry))
            journals = journal_result.scalars().all()
            
            conn = get_snowflake_connection()
            cursor = conn.cursor()
            
            try:
                # Sync dimension tables
                sync_count = {
                    "users": 0,
                    "goals": 0,
                    "checkins": 0,
                    "journals": 0
                }
                
                # 1. Sync Users
                print(f"  Syncing {len(users)} users...")
                for user in users:
                    cursor.execute("""
                        MERGE INTO dim_users tu
                        USING (SELECT %s as user_id, %s as mentor_id, %s as name, %s as created_at) su
                        ON tu.user_id = su.user_id
                        WHEN MATCHED THEN UPDATE SET
                            mentor_id = su.mentor_id,
                            name = su.name
                        WHEN NOT MATCHED THEN INSERT
                            (user_id, mentor_id, name, created_at)
                            VALUES (su.user_id, su.mentor_id, su.name, su.created_at)
                    """, (
                        str(user.id),
                        str(user.mentor_id) if user.mentor_id else None,
                        user.name,
                        user.created_at.isoformat()
                    ))
                    sync_count["users"] += 1
                
                # 2. Sync Goals
                print(f"  Syncing {len(goals)} goals...")
                for goal in goals:
                    cursor.execute("""
                        MERGE INTO dim_goals tg
                        USING (SELECT %s as goal_id, %s as user_id, %s as title, %s as category, 
                                      %s as frequency, %s as created_at) sg
                        ON tg.goal_id = sg.goal_id
                        WHEN MATCHED THEN UPDATE SET
                            title = sg.title,
                            category = sg.category,
                            frequency = sg.frequency
                        WHEN NOT MATCHED THEN INSERT
                            (goal_id, user_id, title, category, frequency, created_at)
                            VALUES (sg.goal_id, sg.user_id, sg.title, sg.category, 
                                   sg.frequency, sg.created_at)
                    """, (
                        str(goal.id),
                        str(goal.user_id),
                        goal.title,
                        goal.category,
                        goal.frequency,
                        goal.created_at.isoformat()
                    ))
                    sync_count["goals"] += 1
                
                # 3. Sync Check-ins
                print(f"  Syncing {len(unsynced_checkins)} check-ins...")
                for checkin in unsynced_checkins:
                    cursor.execute("""
                        INSERT INTO fact_checkins 
                        (checkin_id, goal_id, user_id, completed, timestamp)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (
                        str(checkin.id),
                        str(checkin.goal_id),
                        str(checkin.user_id),
                        checkin.completed,
                        checkin.timestamp.isoformat()
                    ))
                    
                    # Mark as synced in Postgres
                    checkin.synced_to_snowflake = True
                    sync_count["checkins"] += 1
                
                # 4. Sync Journal Entries
                print(f"  Syncing {len(journals)} journal entries...")
                for journal in journals:
                    cursor.execute("""
                        MERGE INTO fact_journal_entries ej
                        USING (SELECT %s as entry_id, %s as user_id, %s as text, 
                                      %s as sentiment_score, %s as mood_tags, %s as created_at) sj
                        ON ej.entry_id = sj.entry_id
                        WHEN MATCHED THEN UPDATE SET
                            sentiment_score = sj.sentiment_score,
                            mood_tags = PARSE_JSON(sj.mood_tags)
                        WHEN NOT MATCHED THEN INSERT
                            (entry_id, user_id, text, sentiment_score, mood_tags, created_at)
                            VALUES (sj.entry_id, sj.user_id, sj.text, sj.sentiment_score,
                                   PARSE_JSON(sj.mood_tags), sj.created_at)
                    """, (
                        str(journal.id),
                        str(journal.user_id),
                        journal.text,
                        journal.sentiment_score,
                        json.dumps(journal.mood_tags or []),
                        journal.created_at.isoformat()
                    ))
                    sync_count["journals"] += 1
                
                conn.commit()
                
                # Commit unsynced checkins update in Postgres
                await session.commit()
                
                return {
                    "status": "success",
                    "timestamp": datetime.utcnow().isoformat(),
                    "synced": sync_count
                }
                
            except Exception as e:
                conn.rollback()
                print(f"  Error: {e}")
                return {"status": "error", "message": str(e)}
            finally:
                cursor.close()
                conn.close()
    
    result = asyncio.run(run_sync())
    print(f"  Result: {result}")
    return result


@celery.task(bind=True)
def compute_adherence_scores(self):
    """
    Compute adherence metrics for all users.
    
    Runs in Snowflake for performance. Stores in metrics_adherence table.
    """
    print(f"[{datetime.utcnow().isoformat()}] Computing adherence scores...")
    
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        # Get all unique users from fact_checkins
        cursor.execute("""
            SELECT DISTINCT user_id FROM fact_checkins
        """)
        
        user_ids = cursor.fetchall()
        
        for (user_id,) in user_ids:
            # Compute 7-day, 30-day, 90-day adherence
            for days, col in [(7, "adherence_7d"), (30, "adherence_30d"), (90, "adherence_90d")]:
                cursor.execute(f"""
                    MERGE INTO metrics_adherence ma
                    USING (
                        SELECT
                            '{user_id}' as user_id,
                            CURRENT_DATE() as metric_date,
                            ROUND(100.0 * SUM(CASE WHEN completed THEN 1 ELSE 0 END) /
                                  NULLIF(COUNT(*), 0), 2) as adherence
                        FROM fact_checkins
                        WHERE user_id = '{user_id}'
                        AND timestamp >= DATEADD(day, -{days}, CURRENT_TIMESTAMP())
                    ) sa
                    ON ma.user_id = sa.user_id AND ma.metric_date = sa.metric_date
                    WHEN MATCHED THEN UPDATE SET {col} = sa.adherence
                    WHEN NOT MATCHED THEN INSERT
                        (user_id, metric_date, {col})
                        VALUES (sa.user_id, sa.metric_date, sa.adherence)
                """)
        
        conn.commit()
        return {"status": "success", "users_processed": len(user_ids)}
    finally:
        cursor.close()
        conn.close()


@celery.task(bind=True)
def compute_risk_metrics(self):
    """
    Detect risk patterns and update metrics_risk table.
    
    Identifies users with low adherence or prolonged inactivity.
    """
    print(f"[{datetime.utcnow().isoformat()}] Computing risk metrics...")
    
    conn = get_snowflake_connection()
    cursor = conn.cursor()
    
    try:
        # Get all users with recent activity
        cursor.execute("""
            SELECT DISTINCT user_id FROM fact_checkins
        """)
        
        user_ids = cursor.fetchall()
        
        for (user_id,) in user_ids:
            # Get risk metrics from Snowflake
            cursor.execute("""
                SELECT
                    COUNT(CASE WHEN completed = FALSE AND 
                               timestamp >= DATEADD(day, -7, CURRENT_TIMESTAMP()) 
                          THEN 1 END) as missed_7d,
                    COUNT(CASE WHEN completed = FALSE AND 
                               timestamp >= DATEADD(day, -3, CURRENT_TIMESTAMP()) 
                          THEN 1 END) as missed_3d,
                    DATEDIFF(day, MAX(timestamp), CURRENT_TIMESTAMP()) as days_since_checkin
                FROM fact_checkins
                WHERE user_id = %s
            """, (user_id,))
            
            result = cursor.fetchone()
            missed_7d, missed_3d, days_since = result
            
            # Determine risk level
            risk_level = "low"
            risk_score = 0.0
            
            if missed_7d >= 4:
                risk_level = "high"
                risk_score = 0.8 + (min(missed_7d - 4, 3) * 0.05)
            elif missed_7d >= 2:
                risk_level = "medium"
                risk_score = 0.5 + (missed_7d * 0.1)
            
            if days_since and days_since > 3:
                risk_level = "high"
                risk_score = max(risk_score, 0.7)
            
            # Update metrics_risk
            cursor.execute("""
                MERGE INTO metrics_risk mr
                USING (SELECT %s as user_id) sr
                ON mr.user_id = sr.user_id
                WHEN MATCHED THEN UPDATE SET
                    risk_level = %s,
                    risk_score = %s,
                    missed_count_7d = %s,
                    missed_count_3d = %s,
                    last_checkin_days_ago = %s,
                    last_evaluated = CURRENT_TIMESTAMP()
                WHEN NOT MATCHED THEN INSERT
                    (user_id, risk_level, risk_score, missed_count_7d, 
                     missed_count_3d, last_checkin_days_ago)
                    VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                user_id, risk_level, min(risk_score, 1.0), missed_7d, missed_3d, days_since or 999,
                user_id, risk_level, min(risk_score, 1.0), missed_7d, missed_3d, days_since or 999
            ))
        
        conn.commit()
        return {"status": "success", "users_processed": len(user_ids)}
    finally:
        cursor.close()
        conn.close()
