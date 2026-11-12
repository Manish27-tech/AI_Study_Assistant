"""
Shared LLM helper: calls Groq and returns parsed JSON or raw text.
"""

import json
import re
from ai_tutor import get_client

DEFAULT_MODEL = "openai/gpt-oss-120b"
FAST_MODEL = "openai/gpt-oss-20b"


def _extract_json(text: str):
    """Robust JSON extractor."""
    if not text:
        raise ValueError("Empty LLM response")

    text = text.strip()

    # Remove markdown code fences
    if text.startswith("```"):
        text = re.sub(r"^```(?:json|JSON)?\s*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
        text = text.strip()

    # Find first { or [
    start_brace = text.find("{")
    start_bracket = text.find("[")
    candidates = [i for i in (start_brace, start_bracket) if i != -1]
    if not candidates:
        raise ValueError(f"No JSON found in response:\n{text[:500]}")
    start = min(candidates)

    # Find last } or ]
    end_brace = text.rfind("}")
    end_bracket = text.rfind("]")
    end = max(end_brace, end_bracket)
    if end <= start:
        raise ValueError(f"Unmatched JSON braces:\n{text[:500]}")

    text = text[start : end + 1]

    # Attempt 1: as-is
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Attempt 2: fix common issues
    fixed = re.sub(r",(\s*[}\]])", r"\1", text)
    if fixed.count('"') < 4 and "'" in fixed:
        fixed = fixed.replace("'", '"')

    try:
        return json.loads(fixed)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"Could not parse LLM JSON: {e}\n---RAW---\n{text[:800]}"
        )


def call_llm_json(
    prompt: str,
    system: str = "",
    temperature: float = 0.7,
    max_tokens: int = 4000,  # Increased back to 4000 to allow broad fields
    model: str | None = None,
):
    """Call Groq and return parsed JSON."""
    client = get_client()

    system_msg = system or ""
    if "json" not in system_msg.lower():
        system_msg = (
            system_msg + " " if system_msg else ""
        ) + "You return ONLY valid JSON. No markdown fences, no prose, no explanation."

    messages = [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": prompt},
    ]

    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )

    content = response.choices[0].message.content
    return _extract_json(content)


def call_llm_text(
    prompt: str,
    system: str = "",
    temperature: float = 0.7,
    max_tokens: int = 1000,
    model: str | None = None,
) -> str:
    """Call Groq and return raw text."""
    client = get_client()

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content.strip()