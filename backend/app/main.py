from fastapi import FastAPI
from pydantic import BaseModel
from app.database import mongo_db, get_snowflake_connection
from app.gemini import generate_goal_plan, review_progress, mentor_copilot
from datetime import datetime

app = FastAPI()
class GoalRequest(BaseModel):
    user_id: str
    group_id: str
    description: str
    constraints: dict


@app.post("/goals/create")
async def create_goal(data: GoalRequest):
    plan = await generate_goal_plan(
        data.description,
        data.group_id,
        data.constraints
    )

    await mongo_db.goals.insert_one({
        "user_id": data.user_id,
        "group_id": data.group_id,
        "plan": plan,
        "created_at": datetime.utcnow()
    })

    return {"plan": plan}
class ChatRequest(BaseModel):
    user_id: str
    group_id: str
    message: str


@app.post("/chat")
async def chat(data: ChatRequest):

    goals = await mongo_db.goals.find(
        {"user_id": data.user_id}
    ).to_list(10)

    checkins = await mongo_db.checkins.find(
        {"user_id": data.user_id}
    ).to_list(10)

    context = {
        "goals": goals,
        "checkins": checkins
    }

    ai_reply = await review_progress(str(context))

    await mongo_db.messages.insert_one({
        "user_id": data.user_id,
        "group_id": data.group_id,
        "message": data.message,
        "ai_reply": ai_reply,
        "timestamp": datetime.utcnow()
    })

    return {"reply": ai_reply}
class MentorChat(BaseModel):
    mentor_id: str
    patient_id: str
    message: str


@app.post("/mentor/chat")
async def mentor_chat(data: MentorChat):

    user_data = await mongo_db.goals.find(
        {"user_id": data.patient_id}
    ).to_list(20)

    conn = get_snowflake_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM mentor_dashboard
        WHERE user_id = %s
    """, (data.patient_id,))
    analytics = cursor.fetchall()

    context = {
        "operational_data": user_data,
        "analytics": analytics
    }

    ai_reply = await mentor_copilot(context, data.message)

    await mongo_db.mentor_messages.insert_one({
        "mentor_id": data.mentor_id,
        "patient_id": data.patient_id,
        "ai_reply": ai_reply,
        "timestamp": datetime.utcnow()
    })

    return {"reply": ai_reply}