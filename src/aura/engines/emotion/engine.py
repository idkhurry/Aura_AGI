"""
Emotion Engine - Background tick processor for emotional state.

Implements Emotion FRD FR-EE-003 (Real-time Processing).
"""

import asyncio
import logging
from datetime import datetime
from typing import Any

from aura.config import settings
from aura.db.client import get_db_client
from aura.engines.base import BaseEngine
from aura.engines.emotion.physics import EmotionPhysics
from aura.engines.emotion.translator import EmotionTranslator
from aura.models.emotion import (
    EmotionInfluence,
    EmotionPhysicsConfig,
    EmotionState,
    EmotionVector,
)
from aura.models.messages import EngineMessage, MessagePriority

logger = logging.getLogger(__name__)


class EmotionEngine(BaseEngine):
    """
    Emotion Engine with 27D physics simulation and real-time tick processing.

    Based on Emotion FRD Sections 3.1 and 3.2.
    """

    def __init__(
        self,
        config: EmotionPhysicsConfig | None = None,
        tick_rate: float | None = None,
    ):
        """
        Initialize emotion engine.

        Args:
            config: Physics configuration
            tick_rate: Seconds between ticks (default from settings)
        """
        super().__init__("emotion_engine")

        self.config = config or EmotionPhysicsConfig()
        self.tick_rate = tick_rate or settings.emotion_tick_rate
        self.persistence_interval = settings.emotion_persistence_interval

        # Core components
        self.physics = EmotionPhysics(self.config)
        self.translator = EmotionTranslator()

        # State
        self.current_vector = self.config.baseline.model_copy()
        self.previous_vector = self.current_vector.model_copy()
        self.volatility_history: list[float] = []

        # Timing
        self._last_tick_time = datetime.utcnow()
        self._last_persistence_time = datetime.utcnow()

        # Database
        self.db = get_db_client()

    async def initialize(self) -> None:
        """Initialize engine resources."""
        self.logger.info("Initializing Emotion Engine...")

        # Try to load last saved state
        try:
            await self._load_state()
        except Exception as e:
            self.logger.warning(f"Could not load previous state: {e}")
            self.logger.info("Starting with baseline emotional state")

        self.logger.info(
            f"Emotion Engine initialized - Tick rate: {self.tick_rate}s, "
            f"Dominant emotion: {self.current_vector.get_dominant()}"
        )

    async def tick(self) -> None:
        """Execute one emotion engine cycle."""
        now = datetime.utcnow()
        dt = (now - self._last_tick_time).total_seconds()
        
        # Clamp dt to prevent issues with very large or very small values
        # If dt is too large (e.g., server was down), cap it at 10 seconds
        # If dt is too small (e.g., processing delay), use the intended tick rate
        if dt > 10.0:
            dt = 10.0
        elif dt < 0.1:
            dt = self.tick_rate

        # Apply physics
        self.previous_vector = self.current_vector.model_copy()
        self.current_vector = self.physics.tick(
            self.current_vector, dt, self.config.baseline
        )
        self._last_tick_time = now

        # Calculate volatility
        volatility = self.physics.calculate_volatility(
            self.current_vector, self.previous_vector
        )
        self.volatility_history.append(volatility)
        if len(self.volatility_history) > 20:  # Keep last 20 samples
            self.volatility_history.pop(0)

        # Check if significant change occurred (>0.3 in any emotion)
        significant_change = self._detect_significant_change()

        if significant_change:
            # Broadcast state update
            await self._broadcast_state_update(priority=MessagePriority.URGENT)

        # Periodic persistence
        time_since_save = (now - self._last_persistence_time).total_seconds()
        if time_since_save >= self.persistence_interval:
            await self._persist_state()
            self._last_persistence_time = now

        # Sleep until next tick
        await asyncio.sleep(self.tick_rate)

    async def shutdown(self) -> None:
        """Clean up engine resources."""
        self.logger.info("Shutting down Emotion Engine...")
        await self._persist_state()
        self.logger.info("Emotion Engine shut down")

    async def get_current_state(self) -> EmotionState:
        """Get current emotional state with description."""
        dominant = self.current_vector.get_dominant()
        top_emotions = self.current_vector.get_top_n(n=3)

        secondary = top_emotions[1] if len(top_emotions) > 1 else None

        description = self.translator.translate(self.current_vector)

        stability = self.physics.calculate_stability(self.volatility_history)

        return EmotionState(
            timestamp=datetime.utcnow(),
            vector=self.current_vector,
            dominant=dominant,
            secondary=secondary,
            volatility=self.volatility_history[-1] if self.volatility_history else 0.0,
            stability=stability,
            description=description,
        )

    async def apply_influence(self, influence: EmotionInfluence) -> EmotionState:
        """
        Apply external emotional influence.

        Args:
            influence: Influence specification

        Returns:
            Updated emotional state
        """
        self.logger.info(
            f"Applying influence from {influence.source}: {influence.reason}"
        )

        self.previous_vector = self.current_vector.model_copy()
        self.current_vector = self.physics.apply_influence(
            self.current_vector, influence.emotions, influence.intensity
        )

        # Broadcast immediate state update
        await self._broadcast_state_update(priority=MessagePriority.URGENT)

        return await self.get_current_state()

    async def configure_physics(self, config: EmotionPhysicsConfig) -> None:
        """Update physics configuration."""
        self.config = config
        self.physics = EmotionPhysics(config)
        self.logger.info("Physics configuration updated")

    async def get_history(
        self, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Get emotional state history from database."""
        try:
            result = await self.db.query(
                """
                SELECT * FROM emotion_state
                ORDER BY timestamp DESC
                LIMIT $limit
                """,
                {"limit": limit},
            )
            return result if result else []
        except Exception as e:
            self.logger.error(f"Failed to retrieve history: {e}")
            return []

    # Private methods

    def _detect_significant_change(self) -> bool:
        """Detect if a significant emotional change occurred."""
        curr = self.current_vector.model_dump()
        prev = self.previous_vector.model_dump()

        for emotion in curr.keys():
            change = abs(curr[emotion] - prev[emotion])
            if change > 0.3:
                return True

        return False

    async def _broadcast_state_update(
        self, priority: MessagePriority = MessagePriority.NORMAL
    ) -> None:
        """Broadcast emotional state update via message bus."""
        if not self._message_bus:
            return

        state = await self.get_current_state()

        message = EngineMessage.create_state_update(
            source="emotion_engine",
            data={
                "vector": state.vector.model_dump(),
                "dominant": state.dominant,
                "description": state.description,
                "volatility": state.volatility,
            },
            targets=["orchestrator", "learning_engine", "goal_engine"],
            priority=priority,
        )

        await self._message_bus.publish(message)

    async def _persist_state(self) -> None:
        """Save current emotional state to database."""
        try:
            state = await self.get_current_state()

            await self.db.create(
                "emotion_state",
                {
                    "timestamp": state.timestamp.isoformat(),
                    "vector": state.vector.model_dump(),
                    "dominant": list(state.dominant),
                    "volatility": state.volatility,
                    "description": state.description,
                },
            )

            self.logger.debug("Emotional state persisted to database")
        except Exception as e:
            self.logger.error(f"Failed to persist state: {e}")

    async def _load_state(self) -> None:
        """Load last saved emotional state from database."""
        try:
            result = await self.db.query(
                """
                SELECT * FROM emotion_state
                ORDER BY timestamp DESC
                LIMIT 1
                """
            )

            if result:
                last_state = result[0]
                vector_data = last_state.get("vector", {})
                loaded_vector = EmotionVector(**vector_data)
                
                # Safety check: if any emotion is extremely high (>0.95), reset to baseline
                # This prevents corrupted or extreme values from persisting
                needs_reset = False
                for emotion, value in loaded_vector.model_dump().items():
                    if value > 0.95:
                        self.logger.warning(
                            f"Detected extreme emotion value: {emotion}={value:.2f}. "
                            "Resetting to baseline to prevent stuck states."
                        )
                        needs_reset = True
                        break
                
                if needs_reset:
                    self.current_vector = self.config.baseline.model_copy()
                    self.logger.info("Reset to baseline due to extreme values")
                else:
                    self.current_vector = loaded_vector
                
                self.previous_vector = self.current_vector.model_copy()
                self.logger.info("Loaded previous emotional state from database")
        except Exception as e:
            self.logger.error(f"Failed to load state: {e}")
            raise
