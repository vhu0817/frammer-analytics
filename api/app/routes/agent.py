"""
ATLAS AI agent route — POST /api/agent/query

Accepts a natural language question, runs it through the intent
classifier and ReAct reasoning loop, and returns a structured
response with an answer and optional chart config.

This is the single endpoint the frontend chat UI calls.
"""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.rbac import CurrentUser, get_current_user
from app.schemas.agent import AgentQueryRequest, AgentQueryResponse
from app.agent.react_loop import run_agent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/query", response_model=AgentQueryResponse)
def query_agent(
    body: AgentQueryRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ask ATLAS a question in natural language.

    The agent will:
    1. Classify the query as conversational or analytics
    2. For analytics: run up to 5 ReAct iterations (think → SQL → chart → answer)
    3. Return a structured response with markdown text + optional chart config

    Requires authentication (JWT token in Authorization header).
    """
    start = time.time()
    logger.info(
        f"Agent query from user={user.user_id} role={user.role}: "
        f"{body.query[:80]}"
    )

    try:
        result = run_agent(
            user_query=body.query,
            db=db,
            conversation_history=body.conversation_history,
        )
    except Exception as e:
        logger.error(f"Agent error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Agent encountered an unexpected error: {str(e)}",
        )

    elapsed = round(time.time() - start, 2)
    logger.info(
        f"Agent responded in {elapsed}s "
        f"(iterations={result.iterations}, has_chart={result.chart is not None})"
    )

    return result.to_dict()
