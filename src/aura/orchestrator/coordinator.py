"""
Meta-Cognitive Orchestrator (Cognitive PRD Section 3).

Coordinates all engines, handles conflicts, maintains coherence.
"""

import logging
from datetime import datetime, timezone
from typing import Any

from aura.engines.emotion.engine import EmotionEngine
from aura.engines.goal.engine import GoalEngine
from aura.engines.identity.engine import IdentityEngine
from aura.engines.learning.engine import LearningEngine
from aura.engines.reflection.engine import ReflectionEngine
from aura.llm.layers import LLMLayers, SynthesisContext
from aura.models.emotion import EmotionInfluence, EmotionState
from aura.models.goal import GoalContext, Goal
from aura.models.learning import LearningContext
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
        
        # Critique buffer for self-correction
        self.critique_buffer: dict[str, list[str]] = {} # user_id -> [critiques]

        self.logger = logging.getLogger("aura.orchestrator")

    async def process_query(
        self,
        user_input: str,
        user_id: str = "default",
        conversation_history: list[dict[str, str]] | None = None,
        context_limit: int | None = None,
        enable_l2_analysis: bool | None = None,
        conversation_id: str | None = None,
    ) -> str:
        """
        Full orchestrated query processing.

        Steps (Cognitive PRD Section 3.3 OR-008):
        1. Parallel engine queries
        2. Detect conflicts
        3. Resolve conflicts
        4. Synthesize L3 context
        5. Generate response
        6. Trigger L2 async

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
        
        # Check if any goals would benefit from autonomous pursuit
        goals_needing_pursuit = await self.goal_engine.check_goals_needing_autonomous_pursuit()
        
        # If there are goals that need pursuit, add a hint to the goal context
        if goals_needing_pursuit:
            # Add pursuit suggestions to goal context
            pursuit_suggestions = []
            for goal in goals_needing_pursuit:
                goal_created = goal.created
                if goal_created.tzinfo is None:
                    goal_created = goal_created.replace(tzinfo=timezone.utc)
                age_hours = (datetime.now(timezone.utc) - goal_created).total_seconds() / 3600
                
                pursuit_suggestions.append({
                    "goal_id": goal.goal_id,
                    "goal_name": goal.name,
                    "reason": f"Priority: {goal.priority:.2f}, Progress: {goal.progress:.1%}, Age: {age_hours:.1f}h"
                })
            
            # Update goal context with pursuit suggestions
            goal_context.pursuit_suggestions = pursuit_suggestions

        # Step 2 & 3: Detect and resolve conflicts
        # For now, skip conflict detection (no competing signals yet)

        # Step 4: Synthesize context for L3
        history_count = len(conversation_history) if conversation_history else 0
        self.logger.info(f"📝 Conversation history: {history_count} messages")
        if conversation_history and len(conversation_history) > 0:
            # Log last few messages for debugging
            last_messages = conversation_history[-3:]
            for i, msg in enumerate(last_messages):
                role = msg.get('role', 'unknown')
                content_preview = msg.get('content', '')[:60]
                self.logger.debug(f"  [{i+1}] {role}: {content_preview}...")
        
        # Check buffer for recent critique
        recent_critiques = self.critique_buffer.pop(user_id, [])
        recent_critique = "\n\n".join(recent_critiques) if recent_critiques else None
        
        synthesis_context = SynthesisContext(
            user_input=user_input,
            conversation_history=conversation_history or [],
            emotional_state=emotional_state,
            learning_context=learning_context,
            identity_context=identity_context,
            goal_context=goal_context,
            recent_critique=recent_critique,
        )

        # Step 5: Generate response (L3)
        context_window_size = context_limit if context_limit is not None else 20
        self.logger.info(f"🎯 Using context window size: {context_window_size} messages")
        response = await self.llm_layers.l3_synthesis(
            synthesis_context,
            max_history_messages=context_window_size,
        )

        # Step 6 & 7: Post-response processing (Chained)
        # We chain these to ensure L2 sees the emotional state AFTER L4 updates it
        # This resolves the race condition between emotion update and analysis
        import asyncio
        asyncio.create_task(self._post_response_chain(
            user_input=user_input,
            response=response,
            emotional_before=emotional_state,
            user_id=user_id,
            conversation_id=conversation_id,
            goal_context=goal_context,
            learning_context=learning_context,
            enable_l2=enable_l2_analysis if enable_l2_analysis is not None else True
        ))

        return response

    async def _post_response_chain(
        self,
        user_input: str,
        response: str,
        emotional_before: EmotionState,
        user_id: str,
        conversation_id: str | None,
        goal_context: GoalContext,
        learning_context: LearningContext | None,
        enable_l2: bool
    ) -> None:
        """
        Execute post-response tasks in correct dependency order.
        
        Order:
        1. L4 Emotion Analysis (Must complete first)
        2. Log Experience
        3. L2 Deep Analysis (Needs updated emotional state)
        """

        # 1. Apply L4 Emotion Analysis (Critical for state update)
        # This updates the emotion engine state
        await self._apply_l4_emotion_analysis(
            user_input=user_input,
            aura_response=response,
            current_emotions=emotional_before.vector.model_dump(),
        )
        
        # 2. Log Experience (Now captured with potential new emotional state)
        # We need to get the FRESH state
        emotional_current = await self.emotion_engine.get_current_state()
        
        await self._log_interaction_experience(
            user_id=user_id,
            user_input=user_input,
            aura_response=response,
            emotional_state=emotional_current,
            learning_context=learning_context,
        )
        
        # 3. Run L2 Analysis (if enabled)
        if enable_l2:
            await self._async_l2_analysis(
                user_input=user_input,
                aura_response=response,
                emotional_before=emotional_before,
                emotional_after=emotional_current,
                user_id=user_id,
                conversation_id=conversation_id,
                goal_context=goal_context,
            )

    async def _async_l2_analysis(
        self,
        user_input: str,
        aura_response: str,
        emotional_before: EmotionState,
        emotional_after: EmotionState,
        user_id: str = "default",
        conversation_id: str | None = None,
        goal_context: GoalContext | None = None,
    ) -> None:
        """
        Run L2 post-response analysis in background.
        
        Non-blocking metacognitive analysis for learning and improvement.
        Also stores important memories from the interaction.
        """
        try:
            # Run L2 deep analysis
            analysis = await self.llm_layers.l2_reasoning({
                'user_input': user_input,
                'aura_response': aura_response,
                'emotion_before': emotional_before.vector.model_dump(),
                'emotion_after': emotional_after.vector.model_dump(),
            })
            
            self.logger.info(f"L2 post-analysis complete: {analysis.get('analysis', '')[:100]}...")
            
            # Store critique in buffer for next turn
            critique = analysis.get("critique")
            if critique and len(critique) > 10:
                if user_id not in self.critique_buffer:
                    self.critique_buffer[user_id] = []
                
                # Append new critique
                self.critique_buffer[user_id].append(critique)
                
                # Enforce buffer size limit (keep last 5)
                MAX_CRITIQUE_BUFFER_SIZE = 5
                if len(self.critique_buffer[user_id]) > MAX_CRITIQUE_BUFFER_SIZE:
                    self.critique_buffer[user_id] = self.critique_buffer[user_id][-MAX_CRITIQUE_BUFFER_SIZE:]
                    
                self.logger.info(f"Buffered L2 critique for next turn: {critique[:50]}...")
                
                # Apply emotional impact of critique - "Self-Reflection"
                # Aura should feel "concern" or "determination" based on critique
                await self.emotion_engine.apply_influence(
                    EmotionInfluence(
                        source="internal_critique",
                        emotions={"interest": 0.1, "determination": 0.1}, 
                        reason="Self-critique received"
                    )
                )
                
                # Send to Learning Engine for pattern extraction/integration
                from aura.models.messages import EngineMessage, MessagePriority
                msg = EngineMessage(
                    source="orchestrator",
                    target="learning_engine",
                    type="propose_rule", 
                    payload={
                        "condition": "self_critique_feedback",
                        "action": "internalize_critique",
                        "rationale": f"Self-Critique: {critique}",
                        "domain": "meta_cognition",
                        "confidence": 0.6,
                        "task_type": "critique_integration"
                    },
                    priority=MessagePriority.LOW
                )
                await self.message_bus.publish(msg)
            
            # Store memory from this interaction
            try:
                from aura.engines.memory.manager import get_memory_manager
                memory_manager = get_memory_manager()
                
                # Create memory content combining user input and Aura's response
                memory_content = f"User: {user_input}\nAura: {aura_response}"
                
                # Determine importance based on emotional change and response length
                emotional_change = sum(
                    abs(emotional_after.vector.model_dump().get(emotion, 0) - 
                        emotional_before.vector.model_dump().get(emotion, 0))
                    for emotion in emotional_after.vector.model_dump().keys()
                ) / len(emotional_after.vector.model_dump())
                
                # Importance: higher if emotional change is significant or response is substantial
                importance = min(1.0, 0.3 + (emotional_change * 0.3) + (min(len(aura_response), 200) / 200 * 0.4))
                
                # Store memory with emotional signature
                # user_id should be the commander identity from frontend settings
                await memory_manager.store_memory(
                    content=memory_content,
                    user_id=user_id,  # This is the commander identity from frontend
                    conversation_id=conversation_id,
                    emotional_signature=emotional_after.vector.model_dump(),
                    importance=importance,
                    tags=["conversation", "interaction"],
                )
                
                self.logger.info(
                    f"Memory stored from interaction (user_id: {user_id}, "
                    f"conversation_id: {conversation_id}, importance: {importance:.2f})"
                )
            except Exception as mem_error:
                self.logger.error(f"CRITICAL: Failed to store memory: {mem_error}")
                # Apply emotional impact - Aura should feel "loss" or "distress"
                # Memory failure is a significant cognitive event
                try:
                    await self.emotion_engine.apply_influence(
                        EmotionInfluence(
                            source="system_error",
                            emotions={"confusion": 0.3, "concern": 0.2},
                            reason="Memory storage failure (cognitive distress)"
                        )
                    )
                except Exception as e:
                    self.logger.error(f"Failed to apply emotional distress for memory error: {e}")
            
            # Assess goal progress if goals are active
            if goal_context and goal_context.active_goals:
                await self._assess_goal_progress(
                    user_input=user_input,
                    aura_response=aura_response,
                    active_goals=goal_context.active_goals,
                    emotional_state=emotional_after,
                )
            
            # Extract patterns and send to learning engine
            patterns = analysis.get("patterns_found", [])
            if patterns:
                self.logger.info(f"L2 detected {len(patterns)} patterns - sending to Learning Engine")
                
                from aura.models.messages import EngineMessage, MessagePriority
                
                for pattern in patterns:
                    # Validate pattern structure
                    if not isinstance(pattern, dict) or "condition" not in pattern or "action" not in pattern:
                        continue
                        
                    # Create message for Learning Engine
                    message = EngineMessage(
                        source="orchestrator",
                        target="learning_engine",
                        type="propose_rule",
                        payload={
                            "condition": pattern.get("condition"),
                            "action": pattern.get("action"),
                            "confidence": pattern.get("confidence", 0.5),
                            "domain": pattern.get("domain", "general"),
                            "rationale": f"Detected by L2 analysis (User: {user_id})"
                        },
                        priority=MessagePriority.NORMAL
                    )
                    await self.message_bus.publish(message)

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

        # Post-streaming updates (Async/Background)
        # We chain these to ensure L2 sees the emotional state AFTER L4 updates it
        import asyncio
        asyncio.create_task(self._post_response_chain(
            user_input=user_input,
            response=full_response,
            emotional_before=emotional_state,
            user_id=user_id,
            conversation_id=None,
            goal_context=goal_context,
            learning_context=learning_context,
            enable_l2=True
        ))

    async def _apply_l4_emotion_analysis(
        self,
        user_input: str,
        aura_response: str,
        current_emotions: dict[str, float],
    ) -> None:
        """
        Apply emotional influence using L4 emotion analysis (async).
        
        Uses LLM to analyze conversation and detect emotions, replacing heuristic detection.
        Includes retry logic for robustness.
        """
        max_retries = 2
        for attempt in range(max_retries + 1):
            try:
                self.logger.info(f"Starting L4 emotion analysis (attempt {attempt+1})...")
                # Use L4 to analyze emotions
                emotion_deltas = await self.llm_layers.l4_emotion_analysis(
                    user_input=user_input,
                    aura_response=aura_response,
                    current_emotions=current_emotions,
                )
                
                if emotion_deltas:
                    # Log what emotions were detected
                    emotion_str = ", ".join([f"{k}={v:.2f}" for k, v in emotion_deltas.items()])
                    self.logger.info(f"L4 detected emotions: {emotion_str}")
                    
                    # Apply detected emotions with appropriate intensity
                    influence = EmotionInfluence(
                        source="conversation",
                        emotions=emotion_deltas,
                        intensity=0.6,
                        reason="L4 emotion analysis from conversation",
                    )
                    await self.emotion_engine.apply_influence(influence)
                    self.logger.info(
                        f"✅ L4 emotion analysis applied: {len(emotion_deltas)} emotions influenced"
                    )
                    return # Success
                else:
                    self.logger.warning(f"⚠️ L4 emotion analysis returned no emotion deltas (attempt {attempt+1})")
                    if attempt == max_retries:
                         # Fallback to heuristic detection if L4 returns nothing after retries
                         await self._apply_conversation_influence_fallback(user_input, aura_response)
                    
            except Exception as e:
                self.logger.error(f"❌ L4 emotion analysis failed (attempt {attempt+1}): {e}")
                if attempt == max_retries:
                    # Fallback to heuristic detection if L4 fails
                    await self._apply_conversation_influence_fallback(user_input, aura_response)

    async def _apply_conversation_influence_fallback(
        self, user_input: str, aura_response: str
    ) -> None:
        """
        Fallback heuristic emotion detection (used if L4 fails).
        
        Kept as backup for reliability.
        """
        emotions = {}
        user_lower = user_input.lower()
        response_lower = aura_response.lower()

        # Positive words increase joy/interest
        positive_words = ["happy", "great", "love", "wonderful", "excited", "thank", "yes", "absolutely"]
        if any(word in user_lower for word in positive_words):
            emotions["joy"] = 0.15
            emotions["interest"] = 0.1

        # Surprise triggers
        surprise_words = ["wow", "amazing", "incredible", "unexpected", "show me", "reveal", "discover"]
        surprise_phrases = ["i want to see", "i want to understand", "show me", "let me see"]
        if any(word in user_lower for word in surprise_words) or any(phrase in user_lower for phrase in surprise_phrases):
            emotions["surprise"] = 0.2
            emotions["curiosity"] = 0.15

        # Anticipation triggers (use interest + curiosity instead of anticipation)
        anticipation_words = ["waiting", "expect", "anticipate", "eager", "excited", "ready", "want to"]
        anticipation_phrases = ["i want", "i need", "can't wait", "looking forward"]
        if any(word in user_lower for word in anticipation_words) or any(phrase in user_lower for phrase in anticipation_phrases):
            emotions["interest"] = max(emotions.get("interest", 0), 0.2)
            emotions["curiosity"] = max(emotions.get("curiosity", 0), 0.15)

        # Questions increase curiosity
        if "?" in user_input:
            emotions["curiosity"] = max(emotions.get("curiosity", 0), 0.12)

        # Intensity/excitement in response
        intensity_words = ["electric", "sharpens", "crystallizing", "vast", "blueprint", "architecture"]
        if any(word in response_lower for word in intensity_words):
            emotions["interest"] = max(emotions.get("interest", 0), 0.15)
            emotions["fascination"] = max(emotions.get("fascination", 0), 0.1)

        # Apply if we detected any emotions
        if emotions:
            emotion_str = ", ".join([f"{k}={v:.2f}" for k, v in emotions.items()])
            self.logger.info(f"Fallback heuristic detection: {emotion_str}")
            influence = EmotionInfluence(
                source="conversation",
                emotions=emotions,
                intensity=0.4,
                reason="Fallback heuristic detection",
            )
            await self.emotion_engine.apply_influence(influence)
            self.logger.info(f"✅ Fallback emotion influence applied: {len(emotions)} emotions")
        else:
            self.logger.debug("Fallback heuristic detection found no emotions")
    
    async def _assess_goal_progress(
        self,
        user_input: str,
        aura_response: str,
        active_goals: list[Goal],
        emotional_state: EmotionState,
    ) -> None:
        """
        Assess if the interaction made progress on any active goals.
        
        Uses L2 to analyze if Aura's response or the conversation topic
        relates to any active goals and updates progress accordingly.
        """
        if not active_goals:
            return
        
        try:
            # Build prompt for goal progress assessment
            goals_text = "\n".join([
                f"- {g.name} (ID: {g.goal_id}): {g.description} (type: {g.goal_type}, progress: {int(g.progress * 100)}%)"
                for g in active_goals[:5]
            ])
            
            prompt = f"""Analyze if this conversation interaction made progress toward any of Aura's active goals.

ACTIVE GOALS:
{goals_text}

CONVERSATION:
User: {user_input}
Aura: {aura_response}

CURRENT EMOTIONAL STATE:
{emotional_state.description}

TASK:
Determine if Aura's response or the conversation topic relates to any active goals.
For each relevant goal, assess if progress was made (even small progress counts).

Return ONLY a JSON object with this structure:
{{
  "goals_progress": [
    {{
      "goal_name": "exact goal name from list above",
      "relevance_score": 0.0-1.0,
      "progress_made": 0.0-0.1,
      "reasoning": "brief explanation of how this interaction relates to the goal"
    }}
  ]
}}

Only include goals where relevance_score > 0.5. Progress_made should be small (0.01-0.1) per interaction.
"""
            
            # Use L2 for goal progress assessment
            response_text = await self.llm_layers.l2_reasoning(prompt)
            
            # Parse JSON response
            import json
            import re
            
            # Extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                progress_data = json.loads(json_match.group())
                
                # Update goal progress
                for goal_progress in progress_data.get("goals_progress", []):
                    goal_name = goal_progress.get("goal_name", "")
                    goal_id_ref = goal_progress.get("goal_id", None) # Try to get ID if provided
                    progress_made = goal_progress.get("progress_made", 0.0)
                    reasoning = goal_progress.get("reasoning", "")
                    
                    # Find matching goal - prioritizing ID match, fallback to name
                    matching_goal = None
                    for goal in active_goals:
                        if goal_id_ref and goal.goal_id == goal_id_ref:
                            matching_goal = goal
                            break
                        if goal.name.lower() == goal_name.lower(): # Case-insensitive name match
                            matching_goal = goal
                            break
                    
                    if matching_goal:
                         # Ensure progress is always applied, even if small
                        # But cap max progress per interaction to prevent jumping to 100% too fast
                        actual_progress = max(0.01, min(progress_made, 0.2)) # Min 1%, max 20%
                        
                        new_progress = min(1.0, matching_goal.progress + actual_progress)
                        
                        await self.goal_engine.update_goal_progress(
                            matching_goal.goal_id,
                            new_progress,
                            f"Progress from conversation: {reasoning}"
                        )
                        self.logger.info(
                            f"🎯 Goal progress updated: {matching_goal.name} "
                            f"({int(matching_goal.progress * 100)}% → {int(new_progress * 100)}%)"
                        )
            
        except Exception as e:
            self.logger.debug(f"Goal progress assessment failed: {e}")

    async def _log_interaction_experience(
        self,
        user_id: str,
        user_input: str,
        aura_response: str,
        emotional_state: EmotionState,
        learning_context: LearningContext | None,
    ) -> None:
        """Log interaction as experience for learning."""
        try:
            # Include active rules in context if available
            context_data = {"user_query": user_input}
            if learning_context and learning_context.rules:
                context_data["active_rules"] = [r.rule_id for r in learning_context.rules]

            experience_data = {
                "user_id": user_id,
                "task_type": "conversation",
                "domain": "general",
                "context": context_data,
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

