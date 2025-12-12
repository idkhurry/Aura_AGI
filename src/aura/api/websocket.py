"""WebSocket handlers for real-time streaming."""

import asyncio
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manage WebSocket connections for real-time updates."""

    def __init__(self) -> None:
        """Initialize connection manager."""
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        """Broadcast message to all connected clients."""
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to WebSocket: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def send_to_client(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        """Send message to specific client."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending to WebSocket: {e}")
            self.disconnect(websocket)


# Global connection manager
emotion_manager = ConnectionManager()
chat_manager = ConnectionManager()


async def emotion_stream_endpoint(
    websocket: WebSocket, emotion_engine: Any
) -> None:
    """
    WebSocket endpoint for real-time emotion state streaming.

    Sends emotion updates when significant changes occur (>0.3 change threshold).
    """
    await emotion_manager.connect(websocket)

    try:
        # Send initial state
        state = await emotion_engine.get_current_state()
        vector_data = state.vector.model_dump()
        
        # Compute valence (positive - negative emotions) and arousal
        positive_emotions = vector_data.get('joy', 0) + vector_data.get('love', 0) + vector_data.get('trust', 0) + vector_data.get('interest', 0)
        negative_emotions = vector_data.get('fear', 0) + vector_data.get('sadness', 0) + vector_data.get('anger', 0) + vector_data.get('disgust', 0)
        valence = (positive_emotions - negative_emotions) / 4.0  # Normalize to [-1, 1]
        
        # Arousal is intensity of high-arousal emotions
        arousal = (vector_data.get('surprise', 0) + vector_data.get('fear', 0) + vector_data.get('anger', 0) + vector_data.get('joy', 0)) / 4.0
        
        # Flatten structure to match frontend EmotionState interface
        emotion_data = {
            **vector_data,  # Spread all emotion dimensions (joy, trust, fear, etc.)
            "current_state": state.description,  # Map description to current_state
            "dominant": state.dominant[0],  # Most prominent emotion name
            "timestamp": state.timestamp.isoformat(),
            "volatility": state.volatility,
            "valence": valence,  # Overall positivity [-1, 1]
            "arousal": arousal,  # Activation level [0, 1]
            "entropy": state.volatility,  # Use volatility as entropy proxy
        }
        
        await emotion_manager.send_to_client(
            websocket,
            {
                "type": "emotion_update",
                "data": emotion_data
            },
        )

        # Keep connection alive and listen for commands
        while True:
            try:
                # Wait for messages with timeout
                data = await asyncio.wait_for(
                    websocket.receive_json(), timeout=30.0
                )

                # Handle client commands (e.g., request current state)
                if data.get("command") == "get_state":
                    state = await emotion_engine.get_current_state()
                    await emotion_manager.send_to_client(
                        websocket,
                        {
                            "type": "emotion_state",
                            "timestamp": state.timestamp.isoformat(),
                            "vector": state.vector.model_dump(),
                            "dominant": {
                                "emotion": state.dominant[0],
                                "intensity": state.dominant[1],
                            },
                            "description": state.description,
                            "volatility": state.volatility,
                        },
                    )

            except asyncio.TimeoutError:
                # Send heartbeat
                await emotion_manager.send_to_client(
                    websocket, {"type": "heartbeat"}
                )
                continue

    except WebSocketDisconnect:
        emotion_manager.disconnect(websocket)
        logger.info("Client disconnected from emotion stream")
    except Exception as e:
        logger.error(f"Error in emotion WebSocket: {e}")
        emotion_manager.disconnect(websocket)


async def broadcast_emotion_update(state_data: dict[str, Any]) -> None:
    """
    Broadcast emotion state update to all connected clients.

    Called by emotion engine when significant changes occur.
    """
    await emotion_manager.broadcast(
        {"type": "emotion_update", **state_data}
    )

