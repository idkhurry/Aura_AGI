"""Goal models (Goal Engine)."""

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import Field

from aura.models.base import BaseModel


class Goal(BaseModel):
    """
    Goal node with hierarchical structure.

    Based on PRD Section 5.1.
    """

    goal_id: str
    name: str
    description: str
    goal_type: Literal[
        "curiosity_driven",
        "user_requested",
        "maintenance",
        "learning_gap",
        "creative",
    ]
    status: Literal["active", "completed", "cancelled", "paused"] = "active"
    priority: float = Field(default=0.5, ge=0.0, le=1.0)

    created: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed: datetime | None = None

    # Hierarchy
    parent_goal_id: str | None = None
    sub_goal_ids: list[str] = Field(default_factory=list)

    # Progress
    progress: float = Field(default=0.0, ge=0.0, le=1.0)

    # Emotional alignment
    emotional_alignment: dict[str, float] = Field(
        default_factory=dict, description="Which emotions drive this goal"
    )

    # Origin
    origin: str = Field(..., description="How this goal was formed")

    # Metadata
    metadata: dict[str, Any] = Field(default_factory=dict)


class Task(BaseModel):
    """Concrete action for a goal."""

    task_id: str
    goal_id: str
    description: str
    status: Literal["pending", "in_progress", "completed", "failed"] = "pending"
    created: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed: datetime | None = None
    result: str | None = None


class GoalContext(BaseModel):
    """Goal context for LLM injection."""

    active_goals: list[Goal] = Field(default_factory=list)
    current_focus: Goal | None = None
    pending_proposals: list[dict[str, Any]] = Field(default_factory=list)
    pursuit_suggestions: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Goals that would benefit from autonomous pursuit"
    )

