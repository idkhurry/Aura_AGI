"""Reflection models (Reflection Engine)."""

from datetime import datetime
from pydantic import Field
from aura.models.base import BaseModel
from aura.models.identity import IdentityChange


class ReflectionInsight(BaseModel):
    """A specific insight from reflection."""

    type: str = Field(..., description="emotional_pattern, learning_opportunity, etc.")
    description: str
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)
    actionable: bool = False
    priority: float = Field(default=0.5, ge=0.0, le=1.0)


class ReflectionPattern(BaseModel):
    """A learned pattern detected during reflection."""
    
    description: str
    confidence: float


class EmotionalSummary(BaseModel):
    """Summary of emotional state over the period."""
    
    states_count: int
    dominant_emotion: str | None
    emotion_distribution: dict[str, int]


class GoalProgress(BaseModel):
    """Summary of goal progress."""
    
    goals_updated: int
    goals_completed: int


class Reflection(BaseModel):
    """
    Reflection session analyzing a period of time.

    Based on PRD Section 5.5.
    """

    reflection_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    # Period covered
    period_start: datetime
    period_end: datetime
    reflection_type: str = Field(..., description="daily, weekly, session")

    # Insights
    insights: list[ReflectionInsight] = Field(
        default_factory=list, description="Key learnings from period"
    )

    patterns_found: list[ReflectionPattern] = Field(
        default_factory=list, description="Behavioral patterns detected"
    )

    # Summaries
    emotional_summary: EmotionalSummary = Field(
        ..., description="Emotional trajectory"
    )

    goal_progress: GoalProgress = Field(
        ..., description="Progress on active goals"
    )

    identity_shifts: list[IdentityChange] = Field(
        default_factory=list, description="Changes in self-concept"
    )

    # Proposals
    proposals: list[str] = Field(
        default_factory=list, description="Suggested improvements"
    )
