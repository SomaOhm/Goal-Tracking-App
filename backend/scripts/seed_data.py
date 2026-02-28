"""Seed database with sample data for development/testing."""

import asyncio
from uuid import uuid4
from datetime import datetime
from app.database import AsyncSessionLocal
from app.models import User, Goal, Checkin, Message
from sqlalchemy.orm import selectinload


async def seed_database():
    """Populate database with sample data."""
    async with AsyncSessionLocal() as session:
        # Create sample users
        mentor = User(
            id=uuid4(),
            name="Dr. Sarah Johnson",
            mentor_id=None,
            created_at=datetime.utcnow()
        )
        
        member1 = User(
            id=uuid4(),
            name="Alice Chen",
            mentor_id=mentor.id,
            created_at=datetime.utcnow()
        )
        
        member2 = User(
            id=uuid4(),
            name="Bob Smith",
            mentor_id=mentor.id,
            created_at=datetime.utcnow()
        )
        
        session.add_all([mentor, member1, member2])
        await session.flush()
        
        # Create sample goals
        goal1 = Goal(
            id=uuid4(),
            user_id=member1.id,
            title="Daily Exercise",
            category="health",
            frequency="daily",
            created_at=datetime.utcnow()
        )
        
        goal2 = Goal(
            id=uuid4(),
            user_id=member1.id,
            title="Read 30 minutes",
            category="personal_development",
            frequency="daily",
            created_at=datetime.utcnow()
        )
        
        goal3 = Goal(
            id=uuid4(),
            user_id=member2.id,
            title="Meditation",
            category="wellness",
            frequency="daily",
            created_at=datetime.utcnow()
        )
        
        session.add_all([goal1, goal2, goal3])
        await session.flush()
        
        # Create sample check-ins
        for i in range(7):
            checkin = Checkin(
                id=uuid4(),
                goal_id=goal1.id,
                user_id=member1.id,
                completed=i % 2 == 0,  # Alternate completed/incomplete
                timestamp=datetime.utcnow(),
                synced=False
            )
            session.add(checkin)
        
        await session.flush()
        
        # Create sample messages
        msg1 = Message(
            id=uuid4(),
            user_id=member1.id,
            group_id=None,
            content="I'm struggling with my exercise routine",
            is_ai=False,
            created_at=datetime.utcnow()
        )
        
        msg2 = Message(
            id=uuid4(),
            user_id=member1.id,
            group_id=None,
            content="Great effort! Here are some tips to stay consistent...",
            is_ai=True,
            created_at=datetime.utcnow()
        )
        
        session.add_all([msg1, msg2])
        
        await session.commit()
        
        print("✓ Database seeded successfully!")
        print(f"  - Created 3 users (1 mentor, 2 members)")
        print(f"  - Created 3 goals")
        print(f"  - Created 7 check-ins")
        print(f"  - Created 2 messages")


if __name__ == "__main__":
    asyncio.run(seed_database())
