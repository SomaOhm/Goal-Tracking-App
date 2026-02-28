"""Database session dependency for FastAPI routes."""

from sqlalchemy.orm import Session
from app.database import SessionLocal


def get_db() -> Session:
    """Dependency for getting database session.
    
    Creates a new database session for each request and ensures
    it's properly closed after use.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
