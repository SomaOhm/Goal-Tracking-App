import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

app = Celery(
    "sync_pipeline",
    broker=os.getenv("CELERY_BROKER_URL"),
    backend=os.getenv("CELERY_RESULT_BACKEND")
)

# Schedule the sync job every 5 minutes
app.conf.beat_schedule = {
    'sync-mongo-to-snowflake': {
        'task': 'sync_worker.sync_to_snowflake',
        'schedule': 300.0, 
    },
}
app.conf.timezone = 'UTC'