"""Message repository for data access operations."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Message


class MessageRepository:
    """Repository for message data access."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self, 
        user_id, 
        group_id, 
        content: str, 
        is_ai: bool = False,
        message_type: str = "chat",
        context_used: dict = None
    ) -> Message:
        """Create a new message."""
        message = Message(
            user_id=user_id,
            group_id=group_id,
            user_message=content if not is_ai else None,
            ai_reply=content if is_ai else None,
            is_ai=is_ai,
            message_type=message_type,
            context_used=context_used
        )
        self.session.add(message)
        await self.session.commit()
        await self.session.refresh(message)
        return message

    async def get_by_id(self, message_id) -> Message | None:
        """Get message by ID."""
        result = await self.session.execute(
            select(Message).where(Message.id == message_id)
        )
        return result.scalar_one_or_none()

    async def get_by_user(self, user_id, limit: int = 50) -> list[Message]:
        """Get recent messages for a user."""
        result = await self.session.execute(
            select(Message)
            .where(Message.user_id == user_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_by_group(self, group_id, limit: int = 50) -> list[Message]:
        """Get recent messages for a group."""
        result = await self.session.execute(
            select(Message)
            .where(Message.group_id == group_id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        return result.scalars().all()

    async def get_conversation_pairs(self, user_id, limit: int = 20) -> list[tuple]:
        """Get user-AI message pairs for conversation history."""
        messages = await self.get_by_user(user_id, limit=limit * 2)
        
        # Return messages in chronological order
        messages_sorted = list(reversed(messages))
        
        return messages_sorted

    async def delete(self, message_id) -> bool:
        """Delete a message."""
        message = await self.get_by_id(message_id)
        if message:
            await self.session.delete(message)
            await self.session.commit()
            return True
        return False
