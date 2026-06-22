"""
Gemini client for the ATLAS AI agent.

Wraps the google-genai SDK into a simple interface the ReAct loop
can call. Manages:
  - Model initialization with the schema-aware system prompt
  - Conversation history (per-request, not persisted)
  - Structured output parsing for tool calls
"""

from google import genai
from google.genai import types

from app.config import settings
from app.agent.system_prompt import build_system_prompt


def get_client() -> genai.Client:
    """create a fresh Gemini client using the API key from config."""
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to .env or environment variables."
        )
    return genai.Client(api_key=settings.gemini_api_key)


def chat_completion(
    client: genai.Client,
    messages: list[dict],
    temperature: float = 0.1,
) -> str:
    """
    Send a conversation to Gemini and get a text response back.

    Args:
        client: the genai.Client instance
        messages: list of {"role": "user"|"model", "content": str}
        temperature: lower = more deterministic (good for SQL generation)

    Returns:
        The model's text response as a string.
    """
    system_prompt = build_system_prompt()

    # convert our simple message format to genai Content objects
    contents = []
    for msg in messages:
        role = msg["role"]
        # genai uses "model" not "assistant"
        if role == "assistant":
            role = "model"
        contents.append(
            types.Content(
                role=role,
                parts=[types.Part.from_text(text=msg["content"])],
            )
        )

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=4096,
        ),
    )

    return response.text
