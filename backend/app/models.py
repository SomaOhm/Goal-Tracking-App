from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer, JSON, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    mentor_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    goals = relationship("Goal", back_populates="user")
    checkins = relationship("Checkin", back_populates="user")
    messages = relationship("Message", back_populates="user")
    journal_entries = relationship("JournalEntry", back_populates="user")


class Goal(Base):
    __tablename__ = "goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    category = Column(String)  # fitness, mental_health, cs_prep, productivity
    frequency = Column(String)  # daily, weekly, custom
    start_date = Column(DateTime, default=datetime.utcnow)
    end_date = Column(DateTime, nullable=True)
    ai_plan = Column(JSON, nullable=True)  # Gemini-generated plan
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="goals")
    subgoals = relationship("Subgoal", back_populates="goal")
    habits = relationship("Habit", back_populates="goal")
    checkins = relationship("Checkin", back_populates="goal")


class Subgoal(Base):
    __tablename__ = "subgoals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, default="pending")  # pending, in_progress, completed
    order = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

    goal = relationship("Goal", back_populates="subgoals")


class Habit(Base):
    __tablename__ = "habits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text)
    frequency = Column(String)  # daily, weekly, custom
    schedule = Column(JSON)  # e.g., {"days": ["Mon", "Wed", "Fri"], "time": "09:00"}
    category = Column(String)  # optional sub-category
    created_at = Column(DateTime, default=datetime.utcnow)

    goal = relationship("Goal", back_populates="habits")


class Checkin(Base):
    __tablename__ = "checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    completed = Column(Boolean, nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    synced_to_snowflake = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    goal = relationship("Goal", back_populates="checkins")
    user = relationship("User", back_populates="checkins")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), nullable=True)
    user_message = Column(Text, nullable=True)
    ai_reply = Column(Text, nullable=True)
    is_ai = Column(Boolean, default=False)
    message_type = Column(String, default="chat")  # chat, coach_post, suggestion
    context_used = Column(JSON, nullable=True)  # Serialized context for audit
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="messages")


class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    text = Column(Text, nullable=False)
    sentiment_score = Column(Float, nullable=True)  # Computed sentiment (-1 to 1)
    mood_tags = Column(JSON, nullable=True)  # ["happy", "stressed", "motivated"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="journal_entries")


class GroupFeedPost(Base):
    __tablename__ = "group_feed_posts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    content = Column(Text, nullable=False)
    post_type = Column(String)  # human, ai_coach, milestone
    metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class GoalPlanSuggestion(Base):
    __tablename__ = "goal_plan_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    goal_id = Column(UUID(as_uuid=True), ForeignKey("goals.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    suggestion_type = Column(String)  # adjustment, new_subgoal, new_habit
    ai_suggestion = Column(JSON, nullable=False)  # Structured suggestion from Gemini
    accepted = Column(Boolean, nullable=True)
    human_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MentorInteraction(Base):
    __tablename__ = "mentor_interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mentor_id = Column(UUID(as_uuid=True), nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mode = Column(String)  # quick_check, deep_dive, risk_intervention
    mentor_message = Column(Text, nullable=False)
    ai_reply = Column(Text, nullable=False)
    sources_used = Column(JSON, nullable=True)  # Which data sources: postgres, snowflake, etc
    plan_patch = Column(JSON, nullable=True)  # Suggested modifications to patient plan
    task_list = Column(JSON, nullable=True)  # Suggested action items
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id])