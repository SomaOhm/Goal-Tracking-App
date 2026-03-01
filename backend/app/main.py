from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import member, mentor, goals, dashboard, chat, mentor_chat, coach, snowflake
from app.database import engine, Base

app = FastAPI(
    title="Goal Tracking App API",
    description="API for managing goals, mentors, and progress tracking",
    version="1.0.0"
)

# ---------------------------------------------------------------------------
# MCP server note
# ---------------------------------------------------------------------------
# mcp_server.py uses the MCP *stdio* transport.  With stdio transport the MCP
# client (inspector, Claude Desktop, etc.) is responsible for spawning the
# server process itself — it owns the stdin/stdout pipe.  Auto-spawning the
# process here with stdout=DEVNULL severs that pipe and makes the server
# unreachable; it was removed.
#
# To test the MCP server:
#   1. Start this FastAPI backend:  uvicorn app.main:app --reload
#   2. In a second terminal run the MCP inspector:
#        npx @modelcontextprotocol/inspector python backend/mcp_server.py
#      or use the MCP CLI:
#        mcp dev backend/mcp_server.py
#   The inspector/CLI spawns mcp_server.py and communicates with it over
#   stdio.  The MCP tools then call http://localhost:8000/snowflake/* to
#   fetch data from Snowflake.
# ---------------------------------------------------------------------------


# Create tables in background so server becomes ready immediately
@app.on_event("startup")
def startup():
    """Create database tables in a background thread so startup is fast."""
    import threading
    def _create_tables():
        try:
            Base.metadata.create_all(bind=engine)
        except Exception as e:
            print(f"Warning: Database unreachable ({type(e).__name__}). API will run; use Supabase REST for data.")
    threading.Thread(target=_create_tables, daemon=True).start()



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
app.include_router(snowflake.router)


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