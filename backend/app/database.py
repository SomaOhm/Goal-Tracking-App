import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

client = AsyncIOMotorClient(os.getenv("MONGO_URI"))
db = client["app_db"]

# Async collections for FastAPI
goals_col = db["goals"]
checkins_col = db["checkins"]
messages_col = db["messages"]