"""Memory API routes for retrieval and management."""

from typing import Any

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field

from aura.engines.memory.manager import get_memory_manager
from aura.models.memory import Memory

router = APIRouter()


class MemoryListResponse(BaseModel):
    """Response model for memory list endpoints."""

    success: bool
    memories: list[Memory]
    count: int


class MemoryResponse(BaseModel):
    """Response model for single memory endpoint."""

    success: bool
    memory: Memory | None = None
    message: str = ""


@router.get("/recent", response_model=MemoryListResponse)
async def get_recent_memories(
    limit: int = Query(default=10, ge=1, le=100, description="Number of memories to retrieve"),
    user_id: str = Query(default="aura_default_user", description="User identifier"),
    importance_min: float = Query(default=0.0, ge=0.0, le=1.0, description="Minimum importance threshold"),
) -> MemoryListResponse:
    """
    Get recent memories sorted by timestamp.

    Args:
        limit: Maximum number of memories to return (1-100)
        user_id: Filter memories by user
        importance_min: Minimum importance score (0.0-1.0)

    Returns:
        List of recent memories with metadata
    """
    try:
        memory_manager = get_memory_manager()
        
        # Retrieve memories with basic filtering
        memories = await memory_manager.retrieve_memories(
            query="",  # Empty query gets recent memories
            limit=limit,
            importance_min=importance_min,
            user_id=user_id,  # Filter by user_id
        )

        return MemoryListResponse(
            success=True,
            memories=memories,
            count=len(memories),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve memories: {str(e)}",
        )


@router.get("/search", response_model=MemoryListResponse)
async def search_memories(
    query: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(default=10, ge=1, le=100),
    user_id: str = Query(default="aura_default_user"),
    importance_min: float = Query(default=0.0, ge=0.0, le=1.0),
) -> MemoryListResponse:
    """
    Search memories using semantic similarity.

    Uses vector embeddings to find memories similar to the query.

    Args:
        query: Semantic search query
        limit: Maximum results
        user_id: Filter by user
        importance_min: Minimum importance

    Returns:
        Semantically similar memories ranked by relevance
    """
    try:
        memory_manager = get_memory_manager()
        
        memories = await memory_manager.retrieve_memories(
            query=query,
            limit=limit,
            importance_min=importance_min,
        )

        return MemoryListResponse(
            success=True,
            memories=memories,
            count=len(memories),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search memories: {str(e)}",
        )


@router.get("/by-emotion/{emotion}", response_model=MemoryListResponse)
async def get_memories_by_emotion(
    emotion: str,
    threshold: float = Query(default=0.5, ge=0.0, le=1.0, description="Minimum emotion intensity"),
    limit: int = Query(default=10, ge=1, le=100),
) -> MemoryListResponse:
    """
    Find memories associated with a specific emotion.

    Example: Find all memories where 'frustration' > 0.6

    Args:
        emotion: Emotion name (e.g., 'joy', 'frustration', 'curiosity')
        threshold: Minimum emotion intensity
        limit: Maximum results

    Returns:
        Memories with strong emotional association
    """
    try:
        memory_manager = get_memory_manager()
        
        memories = await memory_manager.find_by_emotion(
            emotion_name=emotion,
            threshold=threshold,
            limit=limit,
        )

        return MemoryListResponse(
            success=True,
            memories=memories,
            count=len(memories),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve memories by emotion: {str(e)}",
        )


@router.get("/{memory_id}", response_model=MemoryResponse)
async def get_memory_by_id(memory_id: str) -> MemoryResponse:
    """
    Get a specific memory by ID.

    Args:
        memory_id: Memory identifier (e.g., "memory:abc123")

    Returns:
        Memory details
    """
    try:
        memory_manager = get_memory_manager()
        
        # Fetch single memory from database
        from aura.db.client import get_db_client
        db = get_db_client()
        
        result = await db.select(memory_id)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Memory {memory_id} not found",
            )
        
        memory = Memory(**result[0])
        
        return MemoryResponse(
            success=True,
            memory=memory,
            message="Memory retrieved successfully",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve memory: {str(e)}",
        )


@router.get("/stats/summary")
async def get_memory_stats() -> dict[str, Any]:
    """
    Get memory database statistics.

    Returns:
        Memory counts, emotional distribution, importance stats
    """
    try:
        from aura.db.client import get_db_client
        db = get_db_client()
        
        # Get total count
        count_result = await db.query("SELECT count() FROM memory GROUP ALL")
        total_count = count_result[0]["count"] if count_result else 0
        
        # Get learned vs not learned
        learned_result = await db.query("SELECT count() FROM memory WHERE learned_from = true GROUP ALL")
        learned_count = learned_result[0]["count"] if learned_result else 0
        
        return {
            "success": True,
            "total_memories": total_count,
            "learned_from": learned_count,
            "not_learned": total_count - learned_count,
            "learning_rate": (learned_count / total_count * 100) if total_count > 0 else 0.0,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get memory stats: {str(e)}",
        )

