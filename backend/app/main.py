from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import chat

app = FastAPI(
    title="Goal Tracking App API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)

@app.get("/")
async def root():
    return {"status": "healthy"}

@app.get("/health")
async def health():
    return {"status": "ok"}