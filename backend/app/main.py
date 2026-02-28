import os
import json
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
import google.generativeai as genai
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables
load_dotenv()

app = FastAPI(title="Mentor AI Coaching Backend")

# Initialize MongoDB (Async)
client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = client["app_db"]
goals_col = db["goals"]
checkins_col = db["checkins"]
messages_col = db["messages"]

# Configure Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
# Using gemini-pro for text tasks
model = genai.GenerativeModel('gemini-pro')

# ---------------- Pydantic Models ----------------

class GoalPlanRequest(BaseModel):
    user_id: str
    group_theme: str
    user_description: str
    constraints: str

class ChatRequest(BaseModel):
    user_id: str
    group_id: str
    message: str

class ReviewProgressRequest(BaseModel):
    user_id: str
    group_id: str

# ---------------- Endpoints ----------------

@app.post("/generate_goal_plan")
async def generate_goal_plan(req: GoalPlanRequest):
    """
    Takes user's natural language description and group theme,
    and uses Gemini to generate a structured JSON goal plan.
    """
    prompt = f"""
    You are an expert coach for a group focused on "{req.group_theme}".
    The user has the following goal description: "{req.user_description}".
    Their constraints are: "{req.constraints}".
    
    Create a structured, achievable plan. You MUST return ONLY a valid JSON object with the following structure:
    {{
        "title": "Short title of the goal",
        "category": "The category of the goal",
        "frequency": "daily or weekly",
        "subgoals": ["Subgoal 1", "Subgoal 2"],
        "habits": ["Habit 1", "Habit 2"]
    }}
    Do not include markdown backticks like ```json.
    """
    
    try:
        response = model.generate_content(prompt)
        plan_data = json.loads(response.text.strip())
        
        # Save structured plan to MongoDB
        goal_doc = {
            "user_id": req.user_id,
            "group_theme": req.group_theme,
            "title": plan_data.get("title"),
            "category": plan_data.get("category"),
            "frequency": plan_data.get("frequency"),
            "subgoals": plan_data.get("subgoals", []),
            "habits": plan_data.get("habits", []),
            "created_at": datetime.utcnow()
        }
        result = await goals_col.insert_one(goal_doc)
        goal_doc["_id"] = str(result.inserted_id)
        
        return {"status": "success", "plan": goal_doc}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate plan: {str(e)}")


@app.post("/chat")
async def chat_with_coach(req: ChatRequest):
    """
    Reads context from MongoDB (goals & check-ins), calls Gemini,
    returns the AI reply, and saves the conversation.
    """
    # 1. Fetch Context from MongoDB
    user_goals = await goals_col.find({"user_id": req.user_id}).to_list(length=5)
    recent_checkins = await checkins_col.find({"user_id": req.user_id}).sort("timestamp", -1).to_list(length=7)
    recent_messages = await messages_col.find({"user_id": req.user_id}).sort("timestamp", -1).to_list(length=3)
    
    # 2. Build Context Strings
    goals_context = "\n".join([f"- {g.get('title')} ({g.get('frequency')})" for g in user_goals])
    checkins_context = "\n".join([f"- {c.get('timestamp')}: {'Completed' if c.get('completed') else 'Missed'}" for c in recent_checkins])
    chat_history = "\n".join([f"User: {m.get('user_message')}\nCoach: {m.get('ai_reply')}" for m in recent_messages[::-1]])
    
    # 3. Construct Prompt
    prompt = f"""
    System: You are an encouraging group accountability coach. Use the context below to give specific, practical advice. Keep it concise.
    
    Active Goals:
    {goals_context or "No active goals yet."}
    
    Recent Check-ins:
    {checkins_context or "No recent check-ins."}
    
    Recent Chat History:
    {chat_history or "No previous chat history."}
    
    User's New Message: "{req.message}"
    """
    
    # 4. Call Gemini
    try:
        response = model.generate_content(prompt)
        ai_reply_text = response.text.strip()
        
        # 5. Save to MongoDB
        await messages_col.insert_one({
            "user_id": req.user_id,
            "group_id": req.group_id,
            "user_message": req.message,
            "ai_reply": ai_reply_text,
            "timestamp": datetime.utcnow()
        })
        
        # 6. Return to Frontend
        return {"reply": ai_reply_text}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Chat failed: {str(e)}")


@app.post("/review_progress")
async def trigger_review_progress(req: ReviewProgressRequest):
    """
    Typically triggered by a Celery job/cron daily or weekly.
    Aggregates check-ins, generates a coach message, and simulates posting to the feed.
    """
    recent_checkins = await checkins_col.find({"user_id": req.user_id}).sort("timestamp", -1).to_list(length=14)
    completed = sum(1 for c in recent_checkins if c.get("completed"))
    total = len(recent_checkins)
    
    prompt = f"""
    You are an AI coach. Review the user's progress for the week.
    Out of {total} scheduled check-ins, they completed {completed}.
    
    Write an engaging, public feed post to encourage them or suggest a small tweak.
    """
    
    response = model.generate_content(prompt)
    coach_post = response.text.strip()
    
    # In a real app, you would insert this into a `group_feed` collection here
    
    return {
        "status": "success",
        "feed_post": coach_post,
        "metrics": {"total": total, "completed": completed}
    }