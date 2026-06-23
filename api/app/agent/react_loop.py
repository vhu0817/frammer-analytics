"""
ReAct reasoning loop for the ATLAS AI agent.

Implements the Think → Act → Observe cycle:
  1. Send the user's question (plus conversation history) to Gemini
  2. Parse the response for a tool_call block
  3. If found: execute the tool, inject the result as an Observation, repeat
  4. If the tool is "answer": return the final response to the user
  5. If no tool_call found: treat the entire response as the final answer
  6. Hard cap at MAX_ITERATIONS to prevent infinite loops

The loop maintains a conversation history so the LLM can reason across
multiple steps (e.g., query → look at results → build chart → answer).
"""

import json
import re
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.agent.gemini_client import get_client, chat_completion
from app.agent.intent_classifier import classify_intent, Intent
from app.agent.tools import TOOL_REGISTRY, DB_TOOLS

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────

MAX_ITERATIONS = 5          # prevent runaway loops
TOOL_CALL_PATTERN = re.compile(
    r"```tool_call\s*\n(.*?)\n\s*```",
    re.DOTALL,
)


# ── Response Types ─────────────────────────────────────────

class AgentResponse:
    """Structured response from the agent back to the API layer."""

    def __init__(
        self,
        answer: str,
        chart: Optional[dict] = None,
        iterations: int = 0,
        error: Optional[str] = None,
    ):
        self.answer = answer
        self.chart = chart          # chart config dict, if the agent built one
        self.iterations = iterations
        self.error = error          # set if something went wrong

    def to_dict(self) -> dict:
        result = {
            "answer": self.answer,
            "iterations": self.iterations,
        }
        if self.chart:
            result["chart"] = self.chart
        if self.error:
            result["error"] = self.error
        return result


# ── Tool Call Parsing ──────────────────────────────────────

def _parse_tool_call(text: str) -> Optional[dict]:
    """
    Extract a tool call from the LLM's response.

    Looks for a fenced code block tagged with "tool_call" containing
    a JSON object with "tool" and "args" keys.

    Returns:
        {"tool": "tool_name", "args": {...}} or None if no tool call found.
    """
    match = TOOL_CALL_PATTERN.search(text)
    if not match:
        return None

    raw_json = match.group(1).strip()
    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse tool call JSON: {e}\nRaw: {raw_json}")
        return None

    # validate structure
    if not isinstance(parsed, dict):
        return None
    if "tool" not in parsed:
        return None

    return {
        "tool": parsed["tool"],
        "args": parsed.get("args", {}),
    }


def _extract_text_before_tool_call(text: str) -> str:
    """
    Extract the Thought/reasoning text that appears before the tool call block.
    This is the LLM's "thinking out loud" that we'll preserve in the conversation.
    """
    match = TOOL_CALL_PATTERN.search(text)
    if match:
        return text[:match.start()].strip()
    return text.strip()


# ── The Main Loop ──────────────────────────────────────────

def run_agent(
    user_query: str,
    db: Session,
    conversation_history: Optional[list[dict]] = None,
) -> AgentResponse:
    """
    Execute the full ReAct loop for a user query.

    Args:
        user_query: The user's natural language question.
        db: SQLAlchemy session for executing SQL queries.
        conversation_history: Optional prior messages for multi-turn context.

    Returns:
        AgentResponse with the answer text and optional chart config.

    Flow:
        1. Classify intent (conversational vs analytics)
        2. If conversational → single LLM call, no tools
        3. If analytics → enter ReAct loop (up to MAX_ITERATIONS)
    """
    # ── Step 1: Classify intent ──
    intent = classify_intent(user_query)
    logger.info(f"Intent: {intent} | Query: {user_query[:80]}")

    # ── Step 2: Build initial conversation ──
    messages = list(conversation_history or [])
    messages.append({"role": "user", "content": user_query})

    client = get_client()

    # ── Step 3: Handle conversational queries (no tools needed) ──
    if intent == Intent.CONVERSATIONAL:
        try:
            response_text = chat_completion(client, messages, temperature=0.7)
            # Gemini may still wrap conversational responses in a tool_call block
            # (because the system prompt instructs it to use tools).
            # Try to extract the answer from a tool_call first.
            tool_call = _parse_tool_call(response_text)
            if tool_call and tool_call["tool"] == "answer":
                clean_text = tool_call["args"].get("text", response_text)
            else:
                clean_text = _extract_text_before_tool_call(response_text)
                if not clean_text:
                    clean_text = response_text
            return AgentResponse(answer=clean_text, iterations=0)
        except Exception as e:
            logger.error(f"Gemini error (conversational): {e}")
            return AgentResponse(
                answer="I'm having trouble connecting right now. Please try again.",
                error=str(e),
            )

    # ── Step 4: ReAct loop for analytics queries ──
    chart_config = None  # will be set if the agent calls build_chart
    iteration = 0

    for iteration in range(1, MAX_ITERATIONS + 1):
        logger.info(f"ReAct iteration {iteration}/{MAX_ITERATIONS}")

        # call Gemini
        try:
            response_text = chat_completion(client, messages, temperature=0.1)
        except Exception as e:
            logger.error(f"Gemini error (iteration {iteration}): {e}")
            return AgentResponse(
                answer="I encountered an error while reasoning. Please try again.",
                iterations=iteration,
                error=str(e),
            )

        # parse for a tool call
        tool_call = _parse_tool_call(response_text)

        # ── No tool call found → treat entire response as the answer ──
        if tool_call is None:
            logger.info("No tool call found — returning response as-is")
            return AgentResponse(
                answer=response_text.strip(),
                chart=chart_config,
                iterations=iteration,
            )

        tool_name = tool_call["tool"]
        tool_args = tool_call["args"]
        logger.info(f"Tool call: {tool_name}({list(tool_args.keys())})")

        # ── Validate tool exists ──
        if tool_name not in TOOL_REGISTRY:
            observation = (
                f"Error: Unknown tool '{tool_name}'. "
                f"Available tools: {', '.join(TOOL_REGISTRY.keys())}"
            )
            # add the model's response + error observation to history
            messages.append({"role": "model", "content": response_text})
            messages.append({"role": "user", "content": f"**Observation:** {observation}"})
            continue

        # ── Execute the tool ──
        tool_fn = TOOL_REGISTRY[tool_name]
        try:
            if tool_name in DB_TOOLS:
                result = tool_fn(db, tool_args)
            else:
                result = tool_fn(tool_args)
        except Exception as e:
            logger.error(f"Tool error ({tool_name}): {e}")
            result = {"success": False, "error": f"Tool execution failed: {str(e)}"}

        # ── Handle the "answer" tool → terminates the loop ──
        if tool_name == "answer":
            final_text = result.get("answer", "")
            return AgentResponse(
                answer=final_text,
                chart=chart_config,
                iterations=iteration,
            )

        # ── Handle the "build_chart" tool → stash config, continue ──
        if tool_name == "build_chart" and result.get("success"):
            chart_config = result.get("chart")

        # ── Inject the result as an Observation for the next iteration ──
        # truncate large results so we don't blow up the context window
        result_str = json.dumps(result, default=str)
        if len(result_str) > 8000:
            result_str = result_str[:8000] + "... (truncated)"

        # add the model's response (with its thinking + tool call)
        messages.append({"role": "model", "content": response_text})
        # add the tool result as a user message (Observation)
        messages.append({
            "role": "user",
            "content": f"**Observation:** {result_str}",
        })

    # ── Exhausted all iterations without a final answer ──
    logger.warning(f"ReAct loop exhausted {MAX_ITERATIONS} iterations")
    return AgentResponse(
        answer=(
            "I wasn't able to fully answer your question within the "
            f"allowed {MAX_ITERATIONS} reasoning steps. Here's what I found so far:\n\n"
            + _extract_text_before_tool_call(response_text)
        ),
        chart=chart_config,
        iterations=MAX_ITERATIONS,
        error="max_iterations_reached",
    )
