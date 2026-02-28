import os
from motor.motor_asyncio import AsyncIOMotorClient
import snowflake.connector

MONGO_URI = os.getenv("MONGO_URI")
SNOWFLAKE_CONFIG = {
    "user": os.getenv("SNOWFLAKE_USER"),
    "password": os.getenv("SNOWFLAKE_PASSWORD"),
    "account": os.getenv("SNOWFLAKE_ACCOUNT"),
    "warehouse": os.getenv("SNOWFLAKE_WAREHOUSE"),
    "database": os.getenv("SNOWFLAKE_DATABASE"),
    "schema": os.getenv("SNOWFLAKE_SCHEMA"),
}

mongo_client = AsyncIOMotorClient(MONGO_URI)
mongo_db = mongo_client["goal_tracking"]

def get_snowflake_connection():
    return snowflake.connector.connect(**SNOWFLAKE_CONFIG)