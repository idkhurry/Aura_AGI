"""Chat API with full orchestration."""

from typing import Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from aura.db.client import get_db_client

router = APIRouter()

# Global orchestrator reference (will be set by main.py)
_orchestrator: Any = None


def set_orchestrator(orchestrator: Any) -> None:
    """Set the global orchestrator instance."""
    global _orchestrator
    _orchestrator = orchestrator


def get_orchestrator() -> Any:
    """Get the orchestrator or raise error."""
    if _orchestrator is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Orchestrator not initialized",
        )
    return _orchestrator


class ChatMessage(BaseModel):
    """Chat message model."""

    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    """Request model for chat endpoint."""

    message: str = Field(..., description="User message")
    user_id: str = Field(default="default")
    conversation_history: list[ChatMessage] = Field(default_factory=list)
    stream: bool = Field(default=False, description="Stream response")
    
    # Optional context for persistence
    conversation_id: str | None = Field(default=None, description="Conversation ID to save to")
    
    # Advanced options (from frontend settings)
    context_limit: int | None = Field(default=None, ge=5, le=999, description="Max conversation history")
    enable_l2: bool | None = Field(default=None, description="Enable L2 post-analysis")


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""

    success: bool
    response: str
    emotional_state: dict[str, Any] = Field(default_factory=dict)
    learning_applied: bool = False


@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatRequest) -> ChatResponse:
    """
    Send message to Aura with full cognitive orchestration.

    This endpoint coordinates:
    - Emotion Engine (emotional state coloring)
    - Learning Engine (retrieved rules and patterns)
    - LLM Layers (L3 synthesis with context)

    Returns emotionally-aware, learned response.
    """
    orchestrator = get_orchestrator()

    try:
        # Convert conversation history to dict format
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in request.conversation_history
        ]

        # Process through orchestrator with optional settings
        # user_id should be the commander identity from frontend (e.g., "Mai")
        response = await orchestrator.process_query(
            user_input=request.message,
            user_id=request.user_id,  # Commander identity from frontend settings
            conversation_history=history,
            context_limit=request.context_limit,
            enable_l2_analysis=request.enable_l2,
            conversation_id=request.conversation_id,
        )

        # Get current emotional state for response
        emotional_state = await orchestrator.emotion_engine.get_current_state()

        # Save to database if conversation_id is provided
        if request.conversation_id:
            db = get_db_client()
            now = datetime.utcnow().isoformat()
            
            # 1. Save User Message
            user_msg_id = f"message:{int(datetime.utcnow().timestamp() * 1000)}"
            await db.create(
                user_msg_id,
                {
                    "conversation_id": request.conversation_id,
                    "content": request.message,
                    "role": "user",
                    "timestamp": now,
                },
            )
            
            # 2. Save Aura Response
            aura_msg_id = f"message:{int(datetime.utcnow().timestamp() * 1000) + 1}"
            await db.create(
                aura_msg_id,
                {
                    "conversation_id": request.conversation_id,
                    "content": response,
                    "role": "assistant",
                    "timestamp": now,
                },
            )
            
            # 3. Update Conversation (count + timestamp)
            await db.query(
                """
                UPDATE $conv_id SET 
                    message_count += 2,
                    updated_at = $now,
                    final_emotion = $emotion
                """,
                {
                    "conv_id": request.conversation_id, 
                    "now": now,
                    "emotion": {
                        "dominant": emotional_state.dominant[0],
                        "description": emotional_state.description
                    }
                },
            )

        return ChatResponse(
            success=True,
            response=response,
            emotional_state={
                "dominant": emotional_state.dominant[0],
                "intensity": emotional_state.dominant[1],
                "description": emotional_state.description,
            },
            learning_applied=True,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process message: {str(e)}",
        )


@router.post("/stream")
async def stream_message(request: ChatRequest) -> StreamingResponse:
    """
    Stream message response in real-time.

    Returns Server-Sent Events stream of text chunks.
    """
    orchestrator = get_orchestrator()

    async def generate():
        try:
            # Convert conversation history
            history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.conversation_history
            ]

            # Stream through orchestrator
            async for chunk in orchestrator.stream_query(
                user_input=request.message,
                user_id=request.user_id,
                conversation_history=history,
            ):
                yield f"data: {chunk}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            yield f"data: Error: {str(e)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
    )

