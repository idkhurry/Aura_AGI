"""FastAPI application entry point."""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from aura.api.routes import chat as chat_routes
from aura.api.routes import conversations as conversations_routes
from aura.api.routes import emotion as emotion_routes
from aura.api.routes import goal as goal_routes
from aura.api.routes import learning as learning_routes
from aura.api.routes import memory as memory_routes
from aura.logging_config import setup_logging_filters
from aura.api.websocket import emotion_stream_endpoint
from aura.config import settings
from aura.db.client import get_db_client
from aura.engines.emotion.engine import EmotionEngine
from aura.engines.goal.engine import GoalEngine
from aura.engines.identity.engine import IdentityEngine
from aura.engines.learning.engine import LearningEngine
from aura.engines.reflection.engine import ReflectionEngine
from aura.llm.layers import LLMLayers
from aura.orchestrator.coordinator import Orchestrator
from aura.orchestrator.message_bus import MessageBus

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global engine references
emotion_engine: EmotionEngine | None = None
learning_engine: LearningEngine | None = None
identity_engine: IdentityEngine | None = None
goal_engine: GoalEngine | None = None
reflection_engine: ReflectionEngine | None = None
message_bus: MessageBus | None = None
orchestrator: Orchestrator | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager."""
    global emotion_engine, learning_engine, identity_engine, goal_engine, reflection_engine, message_bus, orchestrator

    logger.info("Starting Aura Backend v0.3.0 - PHASE 2+ (Higher Cognition)...")
    
    # Set up logging filters (silence health check spam)
    setup_logging_filters()

    # Initialize database connection with retry logic
    db = get_db_client()
    max_retries = 5
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting database connection (attempt {attempt + 1}/{max_retries})...")
            await db.connect()
            logger.info("Database connection established")
            break
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database connection failed: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to database after {max_retries} attempts")
                raise

    # Initialize message bus
    message_bus = MessageBus()
    await message_bus.start()
    logger.info("Message bus started")

    # Initialize and start Emotion Engine
    emotion_engine = EmotionEngine()
    emotion_engine.set_message_bus(message_bus)
    await emotion_engine.start()
    logger.info("✓ Emotion Engine started")

    # Initialize and start Learning Engine
    learning_engine = LearningEngine()
    learning_engine.set_message_bus(message_bus)
    await learning_engine.start()
    logger.info("✓ Learning Engine started")

    # Initialize and start Identity Engine
    identity_engine = IdentityEngine()
    identity_engine.set_message_bus(message_bus)
    await identity_engine.start()
    logger.info("✓ Identity Engine started")

    # Initialize and start Goal Engine
    goal_engine = GoalEngine()
    goal_engine.set_message_bus(message_bus)
    await goal_engine.start()
    logger.info("✓ Goal Engine started")

    # Initialize and start Reflection Engine
    reflection_engine = ReflectionEngine()
    reflection_engine.set_message_bus(message_bus)
    await reflection_engine.start()
    logger.info("✓ Reflection Engine started")

    # Initialize LLM Layers and Orchestrator
    llm_layers = LLMLayers()
    
    # Set LLM layers for Learning Engine (for background analysis)
    learning_engine.set_llm_layers(llm_layers)
    
    # Set Identity Engine dependencies
    identity_engine.set_dependencies(llm_layers)
    
    # Set Reflection Engine dependencies
    reflection_engine.set_dependencies(llm_layers)
    
    # Set goal engine dependencies for LLM-based goal generation
    goal_engine.set_dependencies(
        llm_layers=llm_layers,
        emotion_engine=emotion_engine,
        learning_engine=learning_engine,
        identity_engine=identity_engine,
    )
    
    orchestrator = Orchestrator(
        emotion_engine=emotion_engine,
        learning_engine=learning_engine,
        identity_engine=identity_engine,
        goal_engine=goal_engine,
        reflection_engine=reflection_engine,
        message_bus=message_bus,
        llm_layers=llm_layers,
    )
    logger.info("✓ Orchestrator initialized")

    # Set engine references in routes
    emotion_routes.set_emotion_engine(emotion_engine)
    learning_routes.set_learning_engine(learning_engine)
    goal_routes.set_goal_engine(goal_engine)
    chat_routes.set_orchestrator(orchestrator)

    logger.info("=" * 60)
    logger.info("🧠 AURA v0.3.0 - HIGHER COGNITION FULLY OPERATIONAL")
    logger.info("=" * 60)
    logger.info("Engines Active:")
    logger.info("  • Emotion (27D Physics + Translation)")
    logger.info("  • Learning (Experience Capture + Skill Trees)")
    logger.info("  • Identity (Narrative Self + Values)")
    logger.info("  • Goal (Autonomous Formation + Boredom Detection)")
    logger.info("  • Reflection (Nightly Analysis + Pattern Detection)")
    logger.info("  • Orchestrator (Meta-Cognitive Coordination)")
    logger.info("=" * 60)

    yield

    # Shutdown
    logger.info("Shutting down Aura Backend...")

    # Close LLM client
    await llm_layers.close()

    # Stop engines (in reverse order)
    if reflection_engine:
        await reflection_engine.stop()
        logger.info("Reflection Engine stopped")

    if goal_engine:
        await goal_engine.stop()
        logger.info("Goal Engine stopped")

    if identity_engine:
        await identity_engine.stop()
        logger.info("Identity Engine stopped")

    if learning_engine:
        await learning_engine.stop()
        logger.info("Learning Engine stopped")

    if emotion_engine:
        await emotion_engine.stop()
        logger.info("Emotion Engine stopped")

    # Stop message bus
    if message_bus:
        await message_bus.stop()
        logger.info("Message bus stopped")

    # Close database
    await db.close()
    logger.info("Database connection closed")


# Create FastAPI app
app = FastAPI(
    title="Aura AGI Backend",
    description="Local AGI Companion with Emotional Intelligence",
    version="0.3.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root endpoint
@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint."""
    return {
        "name": "Aura AGI Backend",
        "version": "0.3.0",
        "status": "operational",
        "documentation": "/docs",
    }


# Health check
@app.get("/health")
async def health_check() -> JSONResponse:
    """Health check endpoint."""
    db = get_db_client()
    db_healthy = db.is_connected

    status = "healthy" if db_healthy else "unhealthy"
    status_code = 200 if db_healthy else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": status,
            "database": "connected" if db_healthy else "disconnected",
            "version": "0.3.0",
        },
    )


# Register route modules
app.include_router(emotion_routes.router, prefix="/emotion", tags=["emotion"])
app.include_router(learning_routes.router, prefix="/learning", tags=["learning"])
app.include_router(goal_routes.router, prefix="/goal", tags=["goal"])
app.include_router(chat_routes.router, prefix="/chat", tags=["chat"])
app.include_router(memory_routes.router, prefix="/memory", tags=["memory"])
app.include_router(conversations_routes.router, prefix="/api/conversations", tags=["conversations"])

# WebSocket endpoints
@app.websocket("/ws/emotion")
async def websocket_emotion_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for real-time emotion streaming."""
    await emotion_stream_endpoint(websocket, emotion_engine)

logger.info("Aura Backend routes registered")

