"""Protocols for orchestrator components to avoid circular dependencies."""

from typing import Protocol, Callable, Awaitable
from aura.models.messages import EngineMessage

MessageHandler = Callable[[EngineMessage], Awaitable[None]]


class MessageBusProtocol(Protocol):
    """Protocol defining the interface for the MessageBus."""

    def subscribe(self, engine_id: str, handler: MessageHandler) -> None:
        """
        Register an engine to receive messages.

        Args:
            engine_id: Unique identifier for the engine
            handler: Async function to handle incoming messages
        """
        ...

    def unsubscribe(self, engine_id: str, handler: MessageHandler) -> None:
        """
        Unregister an engine handler.

        Args:
            engine_id: Unique identifier for the engine
            handler: Handler to remove
        """
        ...

    async def publish(self, message: EngineMessage) -> None:
        """
        Publish a message to target engines.

        Args:
            message: Message to publish
        """
        ...

