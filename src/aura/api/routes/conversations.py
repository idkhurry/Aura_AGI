"""Conversation management API routes (for generic chat UI)."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from aura.db.client import get_db_client

router = APIRouter()


def convert_record_id(value: Any) -> str:
    """Convert SurrealDB RecordID to string."""
    if hasattr(value, '__str__') and not isinstance(value, str):
        return str(value)
    return value


class ConversationCreate(BaseModel):
    """Request to create a new conversation."""

    title: str | None = None
    user_id: str = "default"


class ConversationResponse(BaseModel):
    """Conversation response."""

    id: str
    title: str
    user_id: str
    created_at: str
    updated_at: str
    message_count: int


@router.post("/", response_model=ConversationResponse)
async def create_conversation(request: ConversationCreate) -> dict[str, Any]:
    """Create a new conversation."""
    import logging
    logger = logging.getLogger(__name__)
    
    db = get_db_client()

    # Generate conversation ID and timestamp
    conversation_id = f"conversation:{int(datetime.utcnow().timestamp() * 1000)}"  # Use milliseconds as int
    now = datetime.utcnow()
    now_iso = now.isoformat()
    
    # Generate meaningful default title: "Aura + username + timestamp"
    if not request.title:
        # Format timestamp as human-readable (e.g., "Dec 11, 2025 14:30")
        timestamp_str = now.strftime("%b %d, %Y %H:%M")
        default_title = f"Aura & {request.user_id} - {timestamp_str}"
    else:
        default_title = request.title

    logger.info(f"Creating conversation with ID: {conversation_id}, title: {default_title}")
    
    # Create conversation in database
    create_result = await db.create(
        conversation_id,
        {
            "title": default_title,
            "user_id": request.user_id,
            "created_at": now_iso,
            "updated_at": now_iso,
            "message_count": 0,
        },
    )
    logger.info(f"Create result: {create_result}")

    return {
        "id": conversation_id,
        "title": default_title,
        "user_id": request.user_id,
        "created_at": now_iso,
        "updated_at": now_iso,
        "message_count": 0,
    }


@router.get("/", response_model=list[ConversationResponse])
async def list_conversations(user_id: str = "default") -> list[dict[str, Any]]:
    """List all conversations for a user."""
    import logging
    logger = logging.getLogger(__name__)
    
    db = get_db_client()

    # Query conversations
    logger.info(f"Querying conversations for user_id: {user_id}")
    result = await db.query(
        "SELECT * FROM conversation WHERE user_id = $user_id ORDER BY updated_at DESC",
        {"user_id": user_id},
    )
    logger.info(f"Query result: {result}")

    # Parse results - db.query returns list directly
    conversations = []
    if result and isinstance(result, list):
        logger.info(f"Found {len(result)} conversations")
        for conv in result:
            conversations.append(
                {
                    "id": convert_record_id(conv.get("id", "")),
                    "title": conv.get("title", "Untitled"),
                    "user_id": conv.get("user_id", user_id),
                    "created_at": conv.get("created_at", ""),
                    "updated_at": conv.get("updated_at", ""),
                    "message_count": conv.get("message_count", 0),
                }
            )
    else:
        logger.warning(f"No conversations found or unexpected result structure: {result}")

    logger.info(f"Returning {len(conversations)} conversations")
    return conversations


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(conversation_id: str) -> dict[str, Any]:
    """Get a specific conversation."""
    import logging
    logger = logging.getLogger(__name__)
    
    db = get_db_client()

    # Get conversation
    logger.info(f"Attempting to get conversation with ID: {conversation_id}")
    result = await db.select(conversation_id)
    logger.info(f"Select result: {result}")

    # Result is now normalized to list
    if not result or len(result) == 0:
        logger.error(f"Conversation not found: {conversation_id}")
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv = result[0]

    return {
        "id": convert_record_id(conv.get("id", conversation_id)),
        "title": conv.get("title", "Untitled"),
        "user_id": conv.get("user_id", "default"),
        "created_at": conv.get("created_at", ""),
        "updated_at": conv.get("updated_at", ""),
        "message_count": conv.get("message_count", 0),
    }


class ConversationUpdate(BaseModel):
    """Request to update a conversation."""

    title: str | None = None


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str, request: ConversationUpdate
) -> dict[str, Any]:
    """Update a conversation."""
    db = get_db_client()

    # Build update dict
    updates: dict[str, Any] = {"updated_at": datetime.utcnow().isoformat()}
    if request.title is not None:
        updates["title"] = request.title

    # Update conversation
    await db.merge(conversation_id, updates)

    # Get updated conversation
    result = await db.select(conversation_id)

    # Result is now normalized to list
    if not result or len(result) == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv = result[0]

    return {
        "id": convert_record_id(conv.get("id", conversation_id)),
        "title": conv.get("title", "Untitled"),
        "user_id": conv.get("user_id", "default"),
        "created_at": conv.get("created_at", ""),
        "updated_at": conv.get("updated_at", ""),
        "message_count": conv.get("message_count", 0),
    }


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str) -> dict[str, str]:
    """Delete a conversation."""
    db = get_db_client()

    await db.delete(conversation_id)

    return {"message": "Conversation deleted", "id": conversation_id}


# Message endpoints for conversation management


class MessageCreate(BaseModel):
    """Request to create a message."""

    content: str
    role: str = "user"


class MessageResponse(BaseModel):
    """Message response."""

    id: str
    conversation_id: str
    content: str
    role: str
    timestamp: str


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_conversation_messages(conversation_id: str) -> list[dict[str, Any]]:
    """Get all messages for a conversation."""
    db = get_db_client()

    # Query messages for this conversation
    result = await db.query(
        "SELECT * FROM message WHERE conversation_id = $conv_id ORDER BY timestamp ASC",
        {"conv_id": conversation_id},
    )

    # Result is now normalized to list
    messages = []
    for msg in result:
        messages.append(
            {
                "id": convert_record_id(msg.get("id", "")),
                "conversation_id": msg.get("conversation_id", conversation_id),
                "content": msg.get("content", ""),
                "role": msg.get("role", "user"),
                "timestamp": msg.get("timestamp", ""),
            }
        )

    return messages


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def create_message(
    conversation_id: str, request: MessageCreate
) -> dict[str, Any]:
    """Create a new message in a conversation."""
    db = get_db_client()

    # Generate message ID and timestamp
    message_id = f"message:{int(datetime.utcnow().timestamp() * 1000)}"  # Use milliseconds as int
    now = datetime.utcnow().isoformat()

    # Create message in database
    await db.create(
        message_id,
        {
            "conversation_id": conversation_id,
            "content": request.content,
            "role": request.role,
            "timestamp": now,
        },
    )

    # Update conversation's message count and updated_at
    await db.query(
        """
        UPDATE $conv_id SET 
            message_count += 1,
            updated_at = $now
        """,
        {"conv_id": conversation_id, "now": now},
    )

    return {
        "id": message_id,
        "conversation_id": conversation_id,
        "content": request.content,
        "role": request.role,
        "timestamp": now,
    }

