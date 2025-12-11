"""
Meta-Cognitive Orchestrator (Cognitive PRD Section 3).

Coordinates all engines, handles conflicts, maintains coherence.
"""

import logging
from typing import Any

from aura.engines.emotion.engine import EmotionEngine
from aura.engines.goal.engine import GoalEngine
from aura.engines.identity.engine import IdentityEngine
from aura.engines.learning.engine import LearningEngine
from aura.engines.reflection.engine import ReflectionEngine
from aura.llm.layers import LLMLayers, SynthesisContext
from aura.models.emotion import EmotionInfluence
from aura.orchestrator.message_bus import MessageBus

logger = logging.getLogger(__name__)


class Orchestrator:
    """
    Meta-cognitive orchestrator coordinating all cognitive engines.

    Based on Cognitive PRD OR-001 through OR-004.
    """

    def __init__(
        self,
        emotion_engine: EmotionEngine,
        learning_engine: LearningEngine,
        identity_engine: IdentityEngine,
        goal_engine: GoalEngine,
        reflection_engine: ReflectionEngine,
        message_bus: MessageBus,
        llm_layers: LLMLayers,
    ):
        """
        Initialize orchestrator.

        Args:
            emotion_engine: Emotion engine instance
            learning_engine: Learning engine instance
            identity_engine: Identity engine instance
            goal_engine: Goal engine instance
            reflection_engine: Reflection engine instance
            message_bus: Message bus for inter-engine communication
            llm_layers: LLM layer manager
        """
        self.emotion_engine = emotion_engine
        self.learning_engine = learning_engine
        self.identity_engine = identity_engine
        self.goal_engine = goal_engine
        self.reflection_engine = reflection_engine
        self.message_bus = message_bus
        self.llm_layers = llm_layers

        self.logger = logging.getLogger("aura.orchestrator")

    async def process_query(
        self,
        user_input: str,
        user_id: str = "default",
        conversation_history: list[dict[str, str]] | None = None,
        context_limit: int | None = None,
        enable_l2_analysis: bool | None = None,
    ) -> str:
        """
        Full orchestrated query processing.

        Steps (Cognitive PRD Section 3.3 OR-008):
        1. Parallel engine queries
        2. Detect conflicts
        3. Resolve conflicts
        4. Synthesize L3 context
        5. Generate response
        6. Coherence check
        7. Trigger L2 async

        Args:
            user_input: User's message
            user_id: User identifier
            conversation_history: Previous messages

        Returns:
            Generated response
        """
        self.logger.info(f"Processing query from user {user_id}")

        # Step 1: Parallel engine queries
        emotional_state = await self.emotion_engine.get_current_state()

        learning_context = await self.learning_engine.get_learning_context(
            context=user_input,
            user_id=user_id,
        )

        identity_context = await self.identity_engine.get_identity_context(
            conversation_topic=user_input
        )

        goal_context = await self.goal_engine.get_goal_context()

        # Step 2 & 3: Detect and resolve conflicts
        # For now, skip conflict detection (no competing signals yet)

        # Step 4: Synthesize context for L3
        synthesis_context = SynthesisContext(
            user_input=user_input,
            conversation_history=conversation_history or [],
            emotional_state=emotional_state,
            learning_context=learning_context,
            identity_context=identity_context,
            goal_context=goal_context,
        )

        # Step 5: Generate response (L3)
        context_window_size = context_limit if context_limit is not None else 20
        response = await self.llm_layers.l3_synthesis(
            synthesis_context,
            max_history_messages=context_window_size,
        )

        # Step 6: Coherence check
        # TODO: Implement coherence validation

        # Apply emotional influence from conversation
        await self._apply_conversation_influence(user_input, response)

        # Log experience for learning
        await self._log_interaction_experience(
            user_id=user_id,
            user_input=user_input,
            aura_response=response,
            emotional_state=emotional_state,
            learning_context=learning_context,
        )

        # Step 7: Trigger L2 async analysis (fire-and-forget)
        # Only if enabled (default: True)
        if enable_l2_analysis is None or enable_l2_analysis:
            import asyncio
            asyncio.create_task(self._async_l2_analysis(
                user_input=user_input,
                aura_response=response,
                emotional_before=emotional_state,
            ))

        return response
    
    async def _async_l2_analysis(
        self,
        user_input: str,
        aura_response: str,
        emotional_before: Any,
    ) -> None:
        """
        Run L2 post-response analysis in background.
        
        Non-blocking metacognitive analysis for learning and improvement.
        """
        try:
            # Get post-response emotional state
            emotional_after = await self.emotion_engine.get_current_state()
            
            # Run L2 deep analysis
            analysis = await self.llm_layers.l2_reasoning({
                'user_input': user_input,
                'aura_response': aura_response,
                'emotion_before': emotional_before.vector.model_dump(),
                'emotion_after': emotional_after.vector.model_dump(),
            })
            
            self.logger.info(f"L2 post-analysis complete: {analysis.get('analysis', '')[:100]}...")
            
            # TODO: Extract patterns and send to learning engine when pattern detection is ready
            
        except Exception as e:
            self.logger.error(f"L2 analysis failed: {e}")

    async def stream_query(
        self,
        user_input: str,
        user_id: str = "default",
        conversation_history: list[dict[str, str]] | None = None,
    ):
        """
        Stream orchestrated response generation.

        Yields text chunks as they're generated.
        """
        # Parallel engine queries
        emotional_state = await self.emotion_engine.get_current_state()

        learning_context = await self.learning_engine.get_learning_context(
            context=user_input,
            user_id=user_id,
        )

        identity_context = await self.identity_engine.get_identity_context(
            conversation_topic=user_input
        )

        goal_context = await self.goal_engine.get_goal_context()

        # Update last interaction time (for idle detection)
        self.goal_engine.last_user_interaction = datetime.utcnow()

        # Synthesis context
        synthesis_context = SynthesisContext(
            user_input=user_input,
            conversation_history=conversation_history or [],
            emotional_state=emotional_state,
            learning_context=learning_context,
            identity_context=identity_context,
            goal_context=goal_context,
        )

        # Stream L3 generation
        full_response = ""
        async for chunk in self.llm_layers.stream_l3_synthesis(synthesis_context):
            full_response += chunk
            yield chunk

        # Post-streaming updates
        await self._apply_conversation_influence(user_input, full_response)

        await self._log_interaction_experience(
            user_id=user_id,
            user_input=user_input,
            aura_response=full_response,
            emotional_state=emotional_state,
            learning_context=learning_context,
        )

    async def _apply_conversation_influence(
        self, user_input: str, aura_response: str
    ) -> None:
        """Apply emotional influence from conversation."""
        # Simple heuristic for emotional influence
        # TODO: Use LLM to analyze emotional content

        emotions = {}

        # Positive words increase joy/interest
        positive_words = ["happy", "great", "love", "wonderful", "excited", "thank"]
        if any(word in user_input.lower() for word in positive_words):
            emotions["joy"] = 0.2
            emotions["interest"] = 0.1

        # Questions increase curiosity
        if "?" in user_input:
            emotions["curiosity"] = 0.15

        # Apply if we detected any emotions
        if emotions:
            influence = EmotionInfluence(
                source="conversation",
                emotions=emotions,
                intensity=0.5,
                reason="User interaction",
            )
            await self.emotion_engine.apply_influence(influence)

    async def _log_interaction_experience(
        self,
        user_id: str,
        user_input: str,
        aura_response: str,
        emotional_state: Any,
        learning_context: Any,
    ) -> None:
        """Log interaction as experience for learning."""
        try:
            experience_data = {
                "user_id": user_id,
                "task_type": "conversation",
                "domain": "general",
                "context": {"user_query": user_input},
                "aura_response": {"response": aura_response},
                "outcome": {"success": True},  # Assume success if no error
                "emotional_state": {
                    "pre": emotional_state.vector.model_dump(),
                    "dominant": emotional_state.dominant[0],
                },
            }

            await self.learning_engine.log_experience(experience_data)

        except Exception as e:
            self.logger.error(f"Failed to log experience: {e}")

