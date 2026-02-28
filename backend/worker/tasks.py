from worker.celery_app import celery
from app.database import mongo_db
from app.gemini import review_progress
from datetime import datetime, timedelta


@celery.task
def weekly_review():

    # example: review all active users
    users = mongo_db.users.find({})

    for user in users:
        checkins = mongo_db.checkins.find({
            "user_id": user["_id"],
            "timestamp": {
                "$gte": datetime.utcnow() - timedelta(days=7)
            }
        })

        context = list(checkins)
        ai_message = review_progress(str(context))

        mongo_db.group_feed.insert_one({
            "user_id": user["_id"],
            "content": ai_message,
            "type": "ai_coach",
            "timestamp": datetime.utcnow()
        })
        
        @celery.task
        
def sync_checkins_to_snowflake():

    from app.database import get_snowflake_connection

    conn = get_snowflake_connection()
    cursor = conn.cursor()

    new_checkins = mongo_db.checkins.find({
        "synced": {"$ne": True}
    })

    for row in new_checkins:
        cursor.execute("""
            INSERT INTO staging_checkins VALUES (%s, %s, %s, %s)
        """, (
            row["_id"],
            row["goal_id"],
            row["completed"],
            row["timestamp"]
        ))

        mongo_db.checkins.update_one(
            {"_id": row["_id"]},
            {"$set": {"synced": True}}
        )