"""
Reflection Engine - Continuous self-improvement through analysis.

Implements PRD Section 5.5 (Reflection Engine).
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING, TypedDict, Any
from uuid import uuid4

from dateutil import parser

from aura.db.client import get_db_client
from aura.engines.base import BaseEngine
from aura.models.reflection import Reflection, ReflectionInsight

if TYPE_CHECKING:
    from aura.llm.layers import LLMLayers
    from aura.orchestrator.protocols import MessageBusProtocol

logger = logging.getLogger(__name__)


class EmotionalSummary(TypedDict):
    """Type definition for emotional summary data."""
    states_count: int
    dominant_emotion: str | None
    emotion_distribution: dict[str, int]


class Pattern(TypedDict):
    """Type definition for a learned pattern."""
    description: str
    confidence: float


class LearningSummary(TypedDict):
    """Type definition for learning analysis data."""
    experiences_count: int
    rules_created: int
    patterns: list[Pattern]


class GoalProgress(TypedDict):
    """Type definition for goal progress data."""
    goals_updated: int
    goals_completed: int


class ReflectionEngine(BaseEngine):
    """
    Reflection Engine for continuous self-improvement.

    Features:
    - Nightly reflection sessions
    - Pattern detection across experiences
    - Self-analysis and improvement proposals
    - Metacognitive awareness
    """

    def __init__(self) -> None:
        """Initialize reflection engine."""
        super().__init__("reflection_engine")
        self.logger = logging.getLogger(f"aura.engines.{self.engine_id}")

        # Database
        self.db = get_db_client()

        # External dependencies
        self._llm_layers: "LLMLayers | None" = None
        self._message_bus: "MessageBusProtocol | None" = None

        # State
        self.last_reflection: datetime | None = None
        # Config-driven interval
        self.reflection_interval = float(os.getenv("REFLECTION_INTERVAL", "86400.0"))

    def set_dependencies(self, llm_layers: "LLMLayers") -> None:
        """Set external dependencies."""
        self._llm_layers = llm_layers

    def set_message_bus(self, bus: "MessageBusProtocol") -> None:
        """Set message bus for inter-engine communication."""
        self._message_bus = bus

    async def initialize(self) -> None:
        """Initialize engine resources."""
        self.logger.info("Initializing Reflection Engine...")

        # Load last reflection time
        try:
            result = await self.db.query(
                """
                SELECT timestamp FROM reflection
                ORDER BY timestamp DESC
                LIMIT 1
                """
            )

            if result:
                # Parse timestamp string to datetime object
                timestamp_str = result[0]["timestamp"]
                if isinstance(timestamp_str, str):
                    try:
                        dt = parser.isoparse(timestamp_str)
                        # Ensure timezone naive UTC
                        if dt.tzinfo:
                            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
                        self.last_reflection = dt
                    except Exception as e:
                        self.logger.warning(f"Error parsing timestamp {timestamp_str}: {e}")
                        self.last_reflection = datetime.utcnow()
                elif isinstance(timestamp_str, datetime):
                    # Ensure it's timezone-naive
                    self.last_reflection = timestamp_str.replace(tzinfo=None) if timestamp_str.tzinfo else timestamp_str
                else:
                    self.last_reflection = datetime.utcnow()

        except Exception as e:
            self.logger.warning(f"Could not load last reflection: {e}")

        self.logger.info(
            f"Reflection Engine initialized - "
            f"Last reflection: {self.last_reflection or 'Never'}"
        )

    async def tick(self) -> None:
        """
        Execute one reflection engine cycle.

        Checks if it's time for reflection.
        """
        now = datetime.utcnow()

        # Check if reflection is due
        if self.last_reflection:
            time_since = (now - self.last_reflection).total_seconds()
            if time_since < self.reflection_interval:
                # Not yet time
                await asyncio.sleep(3600.0)  # Check every hour
                return

        # Time for reflection!
        self.logger.info("Starting reflection session...")

        try:
            await self.reflect_on_day()
            # Set timestamp AFTER completion to prevent drift/overlap
            self.last_reflection = datetime.utcnow()
        except Exception as e:
            self.logger.error(f"Reflection failed: {e}")

        await asyncio.sleep(3600.0)  # Check every hour

    async def shutdown(self) -> None:
        """Clean up engine resources."""
        self.logger.info("Shutting down Reflection Engine...")

    # Core Methods

    async def reflect_on_day(self) -> Reflection:
        """
        Perform daily reflection on experiences.

        Analyzes:
        - Emotional trajectory
        - Learning patterns
        - Goal progress
        - Identity shifts

        Returns:
            Reflection session
        """
        now = datetime.utcnow()
        period_start = now - timedelta(hours=24)

        self.logger.info(f"Reflecting on period: {period_start} to {now}")

        # Gather data from different engines in parallel
        # Note: We use typed return values, but asyncio.gather loses type info without careful handling.
        # We cast the results for type safety in the unpacking.
        tasks = [
            self._summarize_emotions(period_start, now),
            self._analyze_learning(period_start, now),
            self._review_goals(period_start, now),
            self._detect_identity_changes(period_start, now)
        ]
        
        results = await asyncio.gather(*tasks)
        emotional_summary: EmotionalSummary = results[0] # type: ignore
        learning_patterns: LearningSummary = results[1] # type: ignore
        goal_progress: GoalProgress = results[2] # type: ignore
        identity_shifts: list[dict[str, object]] = results[3] # type: ignore

        # Extract insights
        insights = []

        # Insight from emotional patterns
        if emotional_summary.get("dominant_emotion"):
            insights.append(
                ReflectionInsight(
                    type="emotional_pattern",
                    description=f"Dominant emotion: {emotional_summary['dominant_emotion']}",
                    confidence=0.8,
                    actionable=False
                )
            )

        # Insight from learning
        if learning_patterns.get("experiences_count", 0) >= 5:
            insights.append(
                ReflectionInsight(
                    type="learning_opportunity",
                    description=f"Logged {learning_patterns['experiences_count']} experiences - "
                    "pattern extraction recommended",
                    confidence=0.7,
                    actionable=True
                )
            )

        # Generate proposals
        proposals = await self._generate_proposals(emotional_summary, learning_patterns, goal_progress)

        # Create reflection
        # Use robust ID
        reflection_id = f"reflection:{int(now.timestamp())}-{uuid4().hex[:6]}"
        
        reflection = Reflection(
            reflection_id=reflection_id,
            period_start=period_start,
            period_end=now,
            reflection_type="daily",
            insights=insights,
            patterns_found=learning_patterns.get("patterns", []),
            emotional_summary=emotional_summary, # type: ignore[arg-type]
            goal_progress=goal_progress, # type: ignore[arg-type]
            identity_shifts=identity_shifts, # type: ignore[arg-type]
            proposals=proposals,
        )

        # Store reflection
        try:
            await self.db.create("reflection", reflection.model_dump())
            self.logger.info(
                f"[{reflection.reflection_id}] Reflection complete - {len(insights)} insights, "
                f"{len(learning_patterns.get('patterns', []))} patterns"
            )
        except Exception as e:
            self.logger.error(f"Failed to store reflection: {e}")

        # Trigger actions based on insights
        await self._act_on_insights(insights)

        return reflection

    async def _generate_proposals(
        self, 
        emotional_summary: EmotionalSummary, 
        learning_patterns: LearningSummary, 
        goal_progress: GoalProgress
    ) -> list[str]:
        """Generate improvement proposals using L5."""
        if not self._llm_layers:
            return []

        try:
            # Sanitize inputs to prevent injection
            safe_emotional = json.dumps(emotional_summary, default=str)
            safe_learning = json.dumps(learning_patterns, default=str)
            safe_goals = json.dumps(goal_progress, default=str)

            prompt = f"""Review the daily summary and propose improvements for Aura.

Emotional Summary: {safe_emotional}
Learning Summary: {safe_learning}
Goal Progress: {safe_goals}

Task:
Suggest concrete configuration tweaks or behavioral adjustments to improve Aura's balance and learning.
Focus on:
1. Emotion regulation parameters (e.g. "Increase patience")
2. Goal focus adjustments
3. Learning strategy

Output JSON:
{{
  "proposals": ["Proposal 1...", "Proposal 2..."]
}}
"""
            # Add timeout
            result = await asyncio.wait_for(
                self._llm_layers.l5_structure_analysis(prompt, "Improvement Proposals"),
                timeout=30.0
            )
            return result.get("proposals", [])
        except asyncio.TimeoutError:
            self.logger.error("Proposal generation timed out")
            return []
        except Exception as e:
            self.logger.error(f"Proposal generation failed: {e}")
            return []

    async def analyze_interaction(
        self,
        user_input: str,
        aura_response: str,
        context: dict[str, object],
    ) -> list[ReflectionInsight]:
        """
        Immediate reflection on a single interaction.

        Args:
            user_input: User's message
            aura_response: Aura's response
            context: Interaction context

        Returns:
            List of insights
        """
        insights = []

        # Quick coherence check
        if self._llm_layers:
            # Use L2 for quick analysis if available
            try:
                # Add timeout
                analysis = await asyncio.wait_for(
                    self._llm_layers.l2_reasoning({
                        "user_input": user_input,
                        "aura_response": aura_response,
                        "emotion_before": {}, # Not critical for quick check
                        "emotion_after": {}
                    }),
                    timeout=5.0 # Short timeout for real-time path
                )
                
                if analysis.get("critique"):
                    insights.append(ReflectionInsight(
                        type="critique",
                        description=analysis["critique"],
                        confidence=0.6,
                        actionable=True
                    ))
            except asyncio.TimeoutError:
                self.logger.warning("Quick analysis timed out")
            except Exception as e:
                self.logger.warning(f"Quick analysis failed: {e}")

        return insights

    # Private Methods

    async def _summarize_emotions(
        self, start: datetime, end: datetime
    ) -> EmotionalSummary:
        """Summarize emotional trajectory for period."""
        try:
            result = await self.db.query(
                """
                SELECT * FROM emotion_state
                WHERE timestamp >= $start AND timestamp <= $end
                ORDER BY timestamp ASC
                """,
                {"start": start.isoformat(), "end": end.isoformat()},
            )

            # DatabaseClient already normalizes to flat list
            if not result:
                return {
                    "states_count": 0,
                    "dominant_emotion": None,
                    "emotion_distribution": {}
                }

            states = result

            # Find dominant emotion across period
            emotion_counts: dict[str, int] = {}
            for state in states:
                dominant = state.get("dominant", [])
                if dominant:
                    emotion = dominant[0]
                    emotion_counts[emotion] = emotion_counts.get(emotion, 0) + 1

            dominant_emotion = (
                max(emotion_counts.items(), key=lambda x: x[1])[0]
                if emotion_counts
                else None
            )

            return {
                "states_count": len(states),
                "dominant_emotion": dominant_emotion,
                "emotion_distribution": emotion_counts,
            }

        except Exception as e:
            self.logger.error(f"Failed to summarize emotions: {e}")
            return {
                "states_count": 0,
                "dominant_emotion": None,
                "emotion_distribution": {}
            }

    async def _analyze_learning(
        self, start: datetime, end: datetime
    ) -> LearningSummary:
        """Analyze learning patterns for period."""
        try:
            # Parallelize queries since SurrealDB client might not support multi-statement well
            # Also it's cleaner for error handling
            
            # 1. Count experiences
            task1 = self.db.query(
                """
                SELECT count() FROM experience
                WHERE timestamp >= $start AND timestamp <= $end
                GROUP ALL
                """,
                {"start": start.isoformat(), "end": end.isoformat()}
            )
            
            # 2. Count rules
            task2 = self.db.query(
                """
                SELECT count() FROM rule
                WHERE created >= $start AND created <= $end
                GROUP ALL
                """,
                {"start": start.isoformat(), "end": end.isoformat()}
            )
            
            # 3. Get recent experiences
            task3 = self.db.query(
                """
                SELECT context, aura_response, outcome FROM experience 
                WHERE timestamp >= $start AND timestamp <= $end 
                ORDER BY timestamp DESC 
                LIMIT 10
                """,
                {"start": start.isoformat(), "end": end.isoformat()}
            )
            
            results = await asyncio.gather(task1, task2, task3)
            exp_result, rule_result, recent_exps = results
            
            experiences_count = 0
            if exp_result:
                experiences_count = exp_result[0].get("count", 0)
                
            rules_count = 0
            if rule_result:
                rules_count = rule_result[0].get("count", 0)

            # Detect actual patterns if we have enough experiences
            patterns: list[Pattern] = []
            if experiences_count >= 5 and self._llm_layers:
                if recent_exps:
                    context_str = "\n".join([
                        f"In: {e.get('context', {}).get('user_query', '')} -> Out: {e.get('aura_response', {}).get('response', '')[:50]}..."
                        for e in recent_exps
                    ])
                    
                    prompt = f"""Analyze these recent interactions for recurring patterns.
                    
Interactions:
{context_str}

Task:
Identify any recurring patterns in user behavior or Aura's responses.
Look for: repetitive topics, recurring emotional triggers, or communication styles.

Output JSON:
{{
  "patterns": [
    {{
      "description": "User frequently asks about...",
      "confidence": 0.8
    }}
  ]
}}"""
                    try:
                        # Add timeout
                        result = await asyncio.wait_for(
                            self._llm_layers.l5_structure_analysis(prompt, "Reflection Pattern Detection"),
                            timeout=30.0
                        )
                        patterns = result.get("patterns", [])
                    except asyncio.TimeoutError:
                        self.logger.warning("Pattern detection timed out")
                    except Exception as e:
                        self.logger.warning(f"Pattern detection failed: {e}")

            return {
                "experiences_count": experiences_count,
                "rules_created": rules_count,
                "patterns": patterns,
            }

        except Exception as e:
            self.logger.error(f"Failed to analyze learning: {e}")
            return {
                "experiences_count": 0,
                "rules_created": 0,
                "patterns": []
            }

    async def _review_goals(self, start: datetime, end: datetime) -> GoalProgress:
        """Review goal progress for period."""
        try:
            result = await self.db.query(
                """
                SELECT * FROM goal
                WHERE updated >= $start AND updated <= $end
                """,
                {"start": start.isoformat(), "end": end.isoformat()},
            )

            if not result:
                return {"goals_updated": 0, "goals_completed": 0}

            goals = result

            completed = len([g for g in goals if g.get("status") == "completed"])

            return {
                "goals_updated": len(goals),
                "goals_completed": completed,
            }

        except Exception as e:
            self.logger.error(f"Failed to review goals: {e}")
            return {"goals_updated": 0, "goals_completed": 0}

    async def _detect_identity_changes(
        self, start: datetime, end: datetime
    ) -> list[dict[str, object]]:
        """Detect identity changes for period."""
        try:
            result = await self.db.query(
                """
                SELECT * FROM identity_change
                WHERE timestamp >= $start AND timestamp <= $end
                ORDER BY timestamp ASC
                """,
                {"start": start.isoformat(), "end": end.isoformat()},
            )

            if not result:
                return []

            return result

        except Exception as e:
            self.logger.error(f"Failed to detect identity changes: {e}")
            return []

    async def _act_on_insights(self, insights: list[ReflectionInsight]) -> None:
        """Take action based on reflection insights."""
        for insight in insights:
            if not insight.actionable:
                continue

            # Trigger pattern extraction if recommended
            if insight.type == "learning_opportunity" and self._message_bus:
                self.logger.info("Triggering pattern extraction based on reflection")
                
                from aura.models.messages import EngineMessage, MessagePriority
                message = EngineMessage(
                    source="reflection_engine",
                    target="learning_engine",
                    type="trigger_extraction",
                    payload={"reason": "reflection_insight"},
                    priority=MessagePriority.LOW
                )
                await self._message_bus.publish(message)
