"""
Intent classifier for the ATLAS AI agent.

Determines whether a user query is:
  - "conversational" → greeting, meta-question, or general chat
  - "analytics"      → needs SQL / data analysis via the ReAct loop

Design decision: We use a hybrid approach — fast keyword rules catch
obvious cases (greetings, identity questions), and everything else
defaults to "analytics". This avoids an extra LLM round-trip just to
classify intent, keeping response time low.

Why not use the LLM for classification?
  1. Adds 1-2 seconds latency before we even start answering
  2. The ReAct loop already handles conversational queries gracefully
     (the system prompt tells Gemini to use the "answer" tool directly
     for non-data questions), so misclassification is harmless
  3. Keyword matching is 100% deterministic and testable
"""

import re


class Intent:
    CONVERSATIONAL = "conversational"
    ANALYTICS = "analytics"


# ── greeting patterns ──
# matches: hi, hello, hey, yo, sup, good morning, good evening, etc.
GREETING_PATTERNS = [
    r"^(hi|hello|hey|yo|sup|howdy|greetings|hola|namaste)\b",
    r"^good\s+(morning|afternoon|evening|night|day)\b",
    r"^(what'?s?\s+up|how\s+are\s+you|how'?s?\s+it\s+going)",
]

# ── identity / meta patterns ──
# matches: "who are you", "what can you do", "help", "what is atlas"
META_PATTERNS = [
    r"\bwho\s+are\s+you\b",
    r"\bwhat\s+are\s+you\b",
    r"\bwhat\s+can\s+you\s+do\b",
    r"\bwhat\s+is\s+atlas\b",
    r"\bwhat'?s?\s+atlas\b",
    r"\bintroduce\s+yourself\b",
    r"\btell\s+me\s+about\s+yourself\b",
    r"^help$",
    r"^help\s+me$",
    r"^\?\s*$",
]

# ── gratitude / farewell patterns ──
# matches: thanks, thank you, bye, goodbye, see you, etc.
FAREWELL_PATTERNS = [
    r"^(thanks|thank\s+you|thx|ty)\b",
    r"^(bye|goodbye|see\s+you|later|cheers|take\s+care)\b",
    r"^(great|awesome|perfect|cool|nice|got\s+it|ok|okay)\s*[!.]?\s*$",
]

# compile all patterns once at import time for performance
_CONVERSATIONAL_PATTERNS = []
for pattern_group in [GREETING_PATTERNS, META_PATTERNS, FAREWELL_PATTERNS]:
    for pattern in pattern_group:
        _CONVERSATIONAL_PATTERNS.append(re.compile(pattern, re.IGNORECASE))


def classify_intent(query: str) -> str:
    """
    Classify a user query as conversational or analytics.

    Args:
        query: The raw user input string.

    Returns:
        Intent.CONVERSATIONAL or Intent.ANALYTICS

    Examples:
        >>> classify_intent("hello!")
        'conversational'
        >>> classify_intent("How many videos were uploaded last week?")
        'analytics'
        >>> classify_intent("who are you?")
        'conversational'
        >>> classify_intent("show me the top 5 clients by upload count")
        'analytics'
        >>> classify_intent("thanks!")
        'conversational'
    """
    cleaned = query.strip()

    # empty or very short non-data queries
    if len(cleaned) < 2:
        return Intent.CONVERSATIONAL

    # check against all conversational patterns
    for pattern in _CONVERSATIONAL_PATTERNS:
        if pattern.search(cleaned):
            return Intent.CONVERSATIONAL

    # everything else is analytics — the ReAct loop will handle it.
    # even if this is wrong, Gemini's system prompt tells it to use
    # the "answer" tool directly for non-data questions, so the worst
    # case is a slightly longer response time (one extra LLM call).
    return Intent.ANALYTICS
