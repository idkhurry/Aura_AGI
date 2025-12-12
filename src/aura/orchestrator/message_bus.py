"""Inter-engine message bus (Cognitive Architecture PRD Section 3.2)."""

import asyncio
import logging
from collections import defaultdict
from typing import Callable, Awaitable

from aura.models.messages import EngineMessage

logger = logging.getLogger(__name__)


MessageHandler = Callable[[EngineMessage], Awaitable[None]]


class MessageBus:
    """
    Async pub/sub message bus for inter-engine communication.

    Based on Cognitive Architecture PRD OR-005.
    """

    def __init__(self) -> None:
        """Initialize message bus."""
        self._subscribers: dict[str, list[MessageHandler]] = defaultdict(list)
        self._message_queue: asyncio.Queue[EngineMessage] = asyncio.Queue()
        self._processing_task: asyncio.Task[None] | None = None
        self._stop_event = asyncio.Event()
        self.logger = logging.getLogger("aura.message_bus")

    async def start(self) -> None:
        """Start message processing."""
        if self._processing_task is not None:
            self.logger.warning("Message bus already started")
            return

        self._stop_event.clear()
        self._processing_task = asyncio.create_task(self._process_messages())
        self.logger.info("Message bus started")

    async def stop(self) -> None:
        """Stop message processing."""
        if self._processing_task is None:
            return

        self._stop_event.set()
        await self._processing_task
        self._processing_task = None
        self.logger.info("Message bus stopped")

    def subscribe(self, engine_id: str, handler: MessageHandler) -> None:
        """
        Register an engine to receive messages.

        Args:
            engine_id: Unique identifier for the engine
            handler: Async function to handle incoming messages
        """
        self._subscribers[engine_id].append(handler)
        self.logger.info(f"Engine {engine_id} subscribed to message bus")

    def unsubscribe(self, engine_id: str, handler: MessageHandler) -> None:
        """
        Unregister an engine handler.

        Args:
            engine_id: Unique identifier for the engine
            handler: Handler to remove
        """
        if engine_id in self._subscribers:
            self._subscribers[engine_id].remove(handler)
            self.logger.info(f"Engine {engine_id} unsubscribed from message bus")

    async def publish(self, message: EngineMessage) -> None:
        """
        Publish a message to target engines.

        Args:
            message: Message to publish
        """
        await self._message_queue.put(message)

        # Log message
        self.logger.debug(
            f"Message published: {message.source} -> {message.targets} "
            f"({message.message_type})"  # Already a string (str, Enum)
        )

    async def _process_messages(self) -> None:
        """Internal message processing loop."""
        while not self._stop_event.is_set():
            try:
                # Wait for message with timeout to check stop event
                message = await asyncio.wait_for(
                    self._message_queue.get(), timeout=1.0
                )

                # Route to target engines
                await self._route_message(message)

            except asyncio.TimeoutError:
                # No message, continue loop
                continue
            except Exception as e:
                self.logger.error(f"Error processing message: {e}", exc_info=True)

    async def _route_message(self, message: EngineMessage) -> None:
        """Route message to target engines."""
        tasks = []

        for target in message.targets:
            if target in self._subscribers:
                for handler in self._subscribers[target]:
                    task = asyncio.create_task(self._deliver_message(handler, message))
                    tasks.append(task)
            else:
                self.logger.warning(f"No subscribers for target: {target}")

        # Wait for all deliveries (don't block on individual failures)
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _deliver_message(
        self, handler: MessageHandler, message: EngineMessage
    ) -> None:
        """Deliver message to a specific handler."""
        try:
            await handler(message)
        except Exception as e:
            self.logger.error(
                f"Error delivering message to handler: {e}", exc_info=True
            )

