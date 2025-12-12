"""
Memory Manager - Active retrieval with hybrid search (Vector + Graph).

Based on PRD Section 5.6 (Memory Engine - The Librarian).
"""

import logging
from datetime import datetime
from typing import Any
from uuid import uuid4

from aura.db.client import get_db_client
from aura.llm.embeddings import get_embeddings_client
from aura.models.memory import Memory

logger = logging.getLogger(__name__)


class MemoryManager:
    """
    Memory management with hybrid search (semantic + graph traversal).

    Not just a DB - actively finds the right context for queries.
    """

    def __init__(self):
        """Initialize memory manager."""
        self.db = get_db_client()
        self.embeddings = get_embeddings_client()

    async def store_memory(
        self,
        content: str,
        user_id: str | None = None,
        conversation_id: str | None = None,
        emotional_signature: dict[str, float] | None = None,
        importance: float = 0.5,
        tags: list[str] | None = None,
    ) -> str:
        """
        Store a memory with semantic embedding.

        Args:
            content: Memory content
            user_id: User identifier
            conversation_id: Conversation identifier
            emotional_signature: Emotional state during memory formation
            importance: Importance score [0, 1]
            tags: Optional tags

        Returns:
            memory_id
        """
        memory_id = f"memory:{uuid4().hex[:12]}"

        try:
            # Generate embedding
            embedding = await self.embeddings.embed(content)

            memory = Memory(
                memory_id=memory_id,
                content=content,
                user_id=user_id,
                conversation_id=conversation_id,
                emotional_signature=emotional_signature or {},
                importance=importance,
                tags=tags or [],
                embedding=embedding,
            )

            await self.db.create("memory", memory.model_dump())

            logger.info(f"Memory stored: {memory_id}")
            return memory_id

        except Exception as e:
            logger.error(f"Failed to store memory: {e}")
            raise

    async def retrieve_memories(
        self,
        query: str,
        limit: int = 10,
        emotional_filter: dict[str, float] | None = None,
        importance_min: float = 0.0,
        user_id: str | None = None,
    ) -> list[Memory]:
        """
        Retrieve memories using hybrid search.

        Strategy:
        1. Semantic search via embedding similarity
        2. Emotional filtering
        3. Importance weighting
        4. User filtering

        Args:
            query: Search query
            limit: Maximum memories to return
            emotional_filter: Filter by emotional signature
            importance_min: Minimum importance threshold
            user_id: Filter by user identifier

        Returns:
            List of relevant memories
        """
        try:
            # Generate query embedding only if query is not empty
            query_embedding = None
            if query and query.strip():
                query_embedding = await self.embeddings.embed(query)

            conditions = [f"importance >= {importance_min}"]
            
            # Filter by user_id if provided
            if user_id:
                conditions.append(f"user_id = '{user_id}'")
            
            where_clause = " AND ".join(conditions) if conditions else "true"

            if query_embedding:
                # Use vector similarity search (cosine similarity)
                # Note: SurrealDB vector search
                result = await self.db.query(
                    f"""
                    SELECT *, vector::similarity::cosine(embedding, $query_embedding) AS relevance
                    FROM memory
                    WHERE {where_clause}
                    ORDER BY relevance DESC, importance DESC
                    LIMIT {limit}
                    """,
                    {"query_embedding": query_embedding}
                )
            else:
                # Fallback to text-based filtering (no embedding)
                result = await self.db.query(
                    f"""
                    SELECT * FROM memory
                    WHERE {where_clause}
                    ORDER BY importance DESC, timestamp DESC
                    LIMIT {limit}
                    """
                )

            if not result:
                return []

            memories = [Memory(**mem_data) for mem_data in result]

            logger.debug(f"Retrieved {len(memories)} memories")
            return memories

        except Exception as e:
            logger.error(f"Failed to retrieve memories: {e}")
            return []

    async def find_by_emotion(
        self, emotion_name: str, threshold: float = 0.5, limit: int = 10
    ) -> list[Memory]:
        """
        Find memories linked to specific emotion.

        Example: "Find memories about 'Python' that are linked to 'Frustration'"

        Args:
            emotion_name: Emotion to search for
            threshold: Minimum emotion intensity
            limit: Maximum memories

        Returns:
            Memories with strong emotional association
        """
        try:
            # Query memories where emotional_signature contains emotion above threshold
            # Note: SurrealDB object field access syntax
            result = await self.db.query(
                f"""
                SELECT * FROM memory
                WHERE emotional_signature.{emotion_name} >= {threshold}
                ORDER BY emotional_signature.{emotion_name} DESC
                LIMIT {limit}
                """
            )

            if not result:
                return []

            memories = [Memory(**mem_data) for mem_data in result]

            logger.debug(
                f"Found {len(memories)} memories with {emotion_name} >= {threshold}"
            )
            return memories

        except Exception as e:
            logger.error(f"Failed to find memories by emotion: {e}")
            return []

    async def update_memory_importance(
        self, memory_id: str, new_importance: float
    ) -> None:
        """Update memory importance based on recall frequency."""
        try:
            await self.db.merge(memory_id, {"importance": new_importance})
            logger.debug(f"Memory {memory_id} importance updated to {new_importance}")
        except Exception as e:
            logger.error(f"Failed to update memory importance: {e}")

    async def mark_as_learned(self, memory_id: str) -> None:
        """Mark memory as having been learned from."""
        try:
            await self.db.merge(memory_id, {"learned_from": True})
            logger.debug(f"Memory {memory_id} marked as learned from")
        except Exception as e:
            logger.error(f"Failed to mark memory as learned: {e}")


# Global memory manager
_memory_manager: MemoryManager | None = None


def get_memory_manager() -> MemoryManager:
    """Get global memory manager."""
    global _memory_manager
    if _memory_manager is None:
        _memory_manager = MemoryManager()
    return _memory_manager

