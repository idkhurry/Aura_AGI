"""Application configuration using Pydantic Settings."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # SurrealDB Configuration
    surreal_url: str = Field(
        default="ws://localhost:8000/rpc",
        validation_alias="SURREAL_URL"
    )
    surreal_user: str = Field(
        default="root",
        validation_alias="SURREAL_USER"
    )
    surreal_pass: str = Field(
        default="root",
        validation_alias="SURREAL_PASS"
    )
    surreal_ns: str = Field(
        default="aura",
        validation_alias="SURREAL_NS"
    )
    surreal_db: str = Field(
        default="main",
        validation_alias="SURREAL_DB"
    )

    # OpenRouter API Configuration
    openrouter_api_key: str = Field(default="")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1")

    # LLM Model Configuration (Hot-Swappable via Environment Variables)
    l1_model: str = Field(
        default="mistralai/mistral-7b-instruct",
        validation_alias="AURA_L1_MODEL",
        description="L1 Instinct Layer - Fast responses (<500ms)",
    )
    l2_model: str = Field(
        default="anthropic/claude-3.5-sonnet",
        validation_alias="AURA_L2_MODEL",
        description="L2 Reasoning Layer - Deep analysis (async)",
    )
    l3_model: str = Field(
        default="deepseek/deepseek-chat",
        validation_alias="AURA_L3_MODEL",
        description="L3 Synthesis Layer - Primary response generation",
    )
    l4_model: str = Field(
        default="qwen/qwen-2.5-72b-instruct",  # Excellent at structured JSON output, good balance of cost/quality
        validation_alias="AURA_L4_MODEL",
        description="L4 Emotion Analysis Layer - Emotion detection from conversation (async). Recommended: Qwen2.5 72B (best JSON), Claude Haiku (fast), or DeepSeek-V3.2 (premium).",
    )
    l5_model: str = Field(
        default="google/gemini-flash-1.5",
        validation_alias="AURA_L5_MODEL",
        description="L5 Structure Layer - Specialized for JSON extraction, summarization, and structural tasks.",
    )

    # Embeddings Configuration (for semantic search)
    embeddings_model: str = Field(
        default="openai/text-embedding-3-small",
        validation_alias="AURA_EMBEDDING_MODEL",
        description="Embedding model (1536 dimensions for OpenAI compatibility)",
    )
    embeddings_dimension: int = Field(
        default=1536,
        validation_alias="AURA_EMBEDDING_DIMENSION",
        description="Embedding vector dimension",
    )

    # Application Configuration
    environment: str = Field(default="development")
    log_level: str = Field(default="INFO")
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8080)
    app_timezone: str = Field(
        default="UTC",
        validation_alias="APP_TIMEZONE",
        description="Timezone for the application (e.g., UTC, Europe/Paris, US/Pacific)",
    )

    # Emotion Engine Configuration
    emotion_tick_rate: float = Field(default=1.0, description="Seconds between emotion ticks")
    emotion_persistence_interval: float = Field(
        default=60.0, description="Seconds between emotion state saves"
    )

    # CORS Configuration
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:3001",
        description="Comma-separated list of allowed origins",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins string into list."""
        return [origin.strip() for origin in self.cors_origins.split(",")]


# Global settings instance
settings = Settings()

# Debug: Log database config at startup
import logging
logger = logging.getLogger(__name__)
logger.info(f"Database config loaded: url={settings.surreal_url}, user={settings.surreal_user}, ns={settings.surreal_ns}, db={settings.surreal_db}")

