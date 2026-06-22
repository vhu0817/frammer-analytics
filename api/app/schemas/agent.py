"""
Pydantic schemas for the ATLAS agent API.

Validates the request body and documents the response shape so
FastAPI auto-generates correct OpenAPI/Swagger docs.
"""

from typing import Optional

from pydantic import BaseModel, Field


# ── Request ────────────────────────────────────────────────

class AgentQueryRequest(BaseModel):
    """Body for POST /api/agent/query"""

    query: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The natural language question to ask ATLAS.",
        examples=["How many videos were uploaded last week?"],
    )

    conversation_history: Optional[list[dict]] = Field(
        default=None,
        description=(
            "Optional prior messages for multi-turn context. "
            "Each item: {\"role\": \"user\"|\"model\", \"content\": \"...\"}"
        ),
    )


# ── Response ───────────────────────────────────────────────

class ChartConfig(BaseModel):
    """Shape of the chart config returned by the build_chart tool."""

    chart_type: str
    title: str
    data: list[dict]
    x_key: str
    y_keys: list[str]
    colors: list[str]


class AgentQueryResponse(BaseModel):
    """Response from POST /api/agent/query"""

    answer: str = Field(
        description="The agent's natural language answer in markdown format."
    )

    chart: Optional[ChartConfig] = Field(
        default=None,
        description="Chart config for the frontend to render. None if no chart was generated."
    )

    iterations: int = Field(
        description="Number of ReAct loop iterations used."
    )

    error: Optional[str] = Field(
        default=None,
        description="Error message if something went wrong. None on success."
    )
