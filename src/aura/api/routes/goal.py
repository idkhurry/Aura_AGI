"""Goal API routes for retrieval and generation."""

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from aura.models.goal import Goal, GoalContext


router = APIRouter()

# Global goal engine reference (set by main.py)
_goal_engine: Any = None


def set_goal_engine(engine: Any) -> None:
    """Set the goal engine instance."""
    global _goal_engine
    _goal_engine = engine


def get_goal_engine() -> Any:
    """Get the goal engine or raise error."""
    if _goal_engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Goal engine not initialized",
        )
    return _goal_engine


class GoalListResponse(BaseModel):
    """Response model for goal list endpoints."""

    success: bool
    goals: list[Goal]
    count: int


class GoalResponse(BaseModel):
    """Response model for single goal endpoint."""

    success: bool
    goal: Goal | None = None
    message: str = ""


class GoalContextResponse(BaseModel):
    """Response model for goal context."""

    success: bool
    context: GoalContext


class GenerateGoalRequest(BaseModel):
    """Request model for generating a new goal."""

    trigger: str = Field(
        default="user_requested",
        description="What triggered goal generation (user_requested, emotion_driven, learning_gap, etc.)",
    )
    context: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context for goal generation",
    )


@router.get("/context", response_model=GoalContextResponse)
async def get_goal_context() -> GoalContextResponse:
    """
    Get current goal context (active goals, focus, etc.).

    Returns:
        Goal context for LLM injection
    """
    try:
        goal_engine = get_goal_engine()
        context = await goal_engine.get_goal_context()

        return GoalContextResponse(success=True, context=context)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get goal context: {str(e)}",
        )


@router.get("/active", response_model=GoalListResponse)
async def get_active_goals() -> GoalListResponse:
    """
    Get all active goals.

    Returns:
        List of active goals
    """
    try:
        goal_engine = get_goal_engine()
        active_goals = [
            goal for goal in goal_engine.active_goals if goal.status == "active"
        ]

        return GoalListResponse(success=True, goals=active_goals, count=len(active_goals))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve active goals: {str(e)}",
        )


@router.get("/all", response_model=GoalListResponse)
async def get_all_goals(limit: int = 20) -> GoalListResponse:
    """
    Get all goals (active, completed, etc.).

    Args:
        limit: Maximum number of goals to return

    Returns:
        List of goals
    """
    try:
        goal_engine = get_goal_engine()
        all_goals = goal_engine.active_goals[:limit]

        return GoalListResponse(success=True, goals=all_goals, count=len(all_goals))

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve goals: {str(e)}",
        )


@router.post("/generate", response_model=GoalResponse)
async def generate_goal(request: GenerateGoalRequest) -> GoalResponse:
    """
    Generate a new goal on demand.

    Uses LLM to analyze current emotional state and learning context
    to propose a meaningful goal.

    Args:
        request: Goal generation request with trigger and context

    Returns:
        Newly generated goal
    """
    try:
        goal_engine = get_goal_engine()
        
        # Generate goal using LLM-based formulation
        goal = await goal_engine.generate_goal_on_demand(
            trigger=request.trigger,
            additional_context=request.context,
        )

        if goal:
            return GoalResponse(success=True, goal=goal, message=f"Goal generated: {goal.name}")
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to generate goal",
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate goal: {str(e)}",
        )


@router.get("/{goal_id}", response_model=GoalResponse)
async def get_goal_by_id(goal_id: str) -> GoalResponse:
    """
    Get a specific goal by ID.

    Args:
        goal_id: Goal identifier

    Returns:
        Goal details
    """
    try:
        goal_engine = get_goal_engine()
        
        goal = next(
            (g for g in goal_engine.active_goals if g.goal_id == goal_id),
            None
        )

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Goal {goal_id} not found",
            )

        return GoalResponse(success=True, goal=goal, message="Goal retrieved successfully")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve goal: {str(e)}",
        )


@router.delete("/{goal_id}", response_model=GoalResponse)
async def delete_goal(goal_id: str) -> GoalResponse:
    """
    Delete a goal by ID.

    Args:
        goal_id: Goal identifier

    Returns:
        Success response
    """
    try:
        goal_engine = get_goal_engine()
        
        # Find the goal
        goal = next(
            (g for g in goal_engine.active_goals if g.goal_id == goal_id),
            None
        )

        if not goal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Goal {goal_id} not found",
            )

        # Delete from database
        try:
            await goal_engine.db.delete(goal_id)
        except Exception as db_error:
            # If delete fails, log but continue
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to delete goal from database: {db_error}")

        # Remove from active goals list
        goal_engine.active_goals = [
            g for g in goal_engine.active_goals if g.goal_id != goal_id
        ]

        # Update goal status to cancelled
        goal.status = "cancelled"
        
        return GoalResponse(
            success=True,
            goal=goal,
            message=f"Goal '{goal.name}' deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete goal: {str(e)}",
        )


class PursueGoalRequest(BaseModel):
    """Request model for autonomous goal pursuit."""
    
    goal_id: str = Field(..., description="Goal ID to pursue")
    loop_count: int = Field(..., ge=1, le=100, description="Number of L2/L3 iterations (1-100)")
    tool_permissions: list[str] = Field(
        default_factory=list,
        description="List of tool IDs Aura is allowed to use (web_search, image_analysis, etc.)"
    )
    allow_interruption: bool = Field(
        default=True,
        description="If True, Aura will pause and respond to user messages. If False, complete uninterrupted."
    )


class PursueGoalResponse(BaseModel):
    """Response model for autonomous goal pursuit."""
    
    success: bool
    goal_id: str
    goal_name: str
    iterations: list[dict[str, Any]]
    progress_updates: list[dict[str, Any]]
    initial_progress: float
    final_progress: float
    progress_delta: float
    loop_count: int
    message: str = ""


@router.post("/pursue", response_model=PursueGoalResponse)
async def pursue_goal_autonomously(request: PursueGoalRequest) -> PursueGoalResponse:
    """
    Pursue a goal autonomously through multiple L2/L3 iterations.
    
    This allows Aura to work on a goal independently by running
    multiple reasoning cycles (L2 analysis + L3 synthesis) focused
    on the goal.
    
    Args:
        request: Goal pursuit request with goal_id and loop_count
        
    Returns:
        Results of autonomous pursuit including progress updates
    """
    try:
        from aura.main import orchestrator
        
        if orchestrator is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Orchestrator not initialized",
            )
        
        goal_engine = get_goal_engine()
        
        result = await goal_engine.pursue_goal_autonomously(
            goal_id=request.goal_id,
            loop_count=request.loop_count,
            orchestrator=orchestrator,
        )
        
        return PursueGoalResponse(
            success=True,
            goal_id=result["goal_id"],
            goal_name=result["goal_name"],
            iterations=result["iterations"],
            progress_updates=result["progress_updates"],
            initial_progress=result["initial_progress"],
            final_progress=result["final_progress"],
            progress_delta=result["progress_delta"],
            loop_count=result["loop_count"],
            message=f"Autonomous pursuit complete: {result['goal_name']}",
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pursue goal: {str(e)}",
        )

