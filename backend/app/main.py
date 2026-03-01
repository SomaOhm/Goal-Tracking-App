from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import member, mentor, goals, dashboard, chat, mentor_chat, coach
from app.database import engine, Base


app = FastAPI(
    title="Goal Tracking App API",
    description="API for managing goals, mentors, and progress tracking",
    version="1.0.0"
)


# Create tables on startup
@app.on_event("startup")
def startup():
    """Create database tables on application startup."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning: Could not create database tables: {e}")
        print("API will run without database. Update DATABASE_URL in .env to connect to a real database.")



# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(member.router)
app.include_router(mentor.router)
app.include_router(goals.router)
app.include_router(dashboard.router)
app.include_router(chat.router)
app.include_router(mentor_chat.router)
app.include_router(coach.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "service": "Goal Tracking App"
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}