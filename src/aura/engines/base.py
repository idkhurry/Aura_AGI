"""Base engine abstraction."""

import asyncio
import logging
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from aura.orchestrator.protocols import MessageBusProtocol

logger = logging.getLogger(__name__)


class EngineState(str, Enum):
    """Engine lifecycle states."""

    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    ERROR = "error"


class BaseEngine(ABC):
    """
    Abstract base class for all cognitive engines.

    Provides lifecycle management and common interface.
    """

    def __init__(self, engine_id: str) -> None:
        """Initialize base engine."""
        self.engine_id = engine_id
        self.state = EngineState.STOPPED
        self._task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self.logger = logging.getLogger(f"aura.engines.{engine_id}")
        self._message_bus: "MessageBusProtocol | None" = None

    def set_message_bus(self, message_bus: "MessageBusProtocol") -> None:
        """Set message bus for inter-engine communication."""
        self._message_bus = message_bus

    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize engine resources.

        Called once during startup before the main loop.
        """
        pass

    @abstractmethod
    async def tick(self) -> None:
        """
        Execute one cycle of the engine's main loop.

        Called periodically based on engine's tick rate.
        """
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """
        Clean up engine resources.

        Called once during shutdown.
        """
        pass

    async def start(self) -> None:
        """Start the engine."""
        if self.state != EngineState.STOPPED:
            self.logger.warning(f"Engine {self.engine_id} already started")
            return

        self.logger.info(f"Starting engine: {self.engine_id}")
        self.state = EngineState.STARTING

        try:
            await self.initialize()
            self._stop_event.clear()
            self._task = asyncio.create_task(self._run_loop())
            self.state = EngineState.RUNNING
            self.logger.info(f"Engine {self.engine_id} started")
        except Exception as e:
            self.logger.error(f"Failed to start engine {self.engine_id}: {e}")
            self.state = EngineState.ERROR
            raise

    async def stop(self) -> None:
        """Stop the engine."""
        if self.state != EngineState.RUNNING:
            self.logger.warning(f"Engine {self.engine_id} not running")
            return

        self.logger.info(f"Stopping engine: {self.engine_id}")
        self.state = EngineState.STOPPING

        self._stop_event.set()

        if self._task:
            await self._task
            self._task = None

        await self.shutdown()
        self.state = EngineState.STOPPED
        self.logger.info(f"Engine {self.engine_id} stopped")

    async def _run_loop(self) -> None:
        """Internal main loop."""
        while not self._stop_event.is_set():
            try:
                await self.tick()
            except Exception as e:
                self.logger.error(f"Error in engine {self.engine_id} tick: {e}", exc_info=True)
                # Continue running despite errors
                await asyncio.sleep(1.0)

    @property
    def is_running(self) -> bool:
        """Check if engine is running."""
        return self.state == EngineState.RUNNING

    def get_status(self) -> dict[str, Any]:
        """Get engine status information."""
        return {
            "engine_id": self.engine_id,
            "state": self.state.value,
            "is_running": self.is_running,
        }
