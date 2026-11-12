"""
NovaAI Chat service.

Responsibilities:
- List available models (labels + descriptions)
- Build the message list for the LLM (with system prompt + RAG + learner context)
- Generate short conversation titles
- Stream completions via the LLM Router
"""

from typing import List, Dict, Any, Optional, Iterator

from services import llm_router


# ==================================================
# Model catalog (Delegated to Router)
# ==================================================
DEFAULT_MODEL = llm_router.DEFAULT_MODEL
TITLE_MODEL = llm_router.TITLE_MODEL

def list_models() -> List[Dict[str, Any]]:
    return llm_router.list_models()

def resolve_model(model_id: Optional[str]) -> str:
    """Kept for backward compatibility. Returns the UI ID."""
    if not model_id:
        return DEFAULT_MODEL
    return model_id


# ==================================================
# System prompt
# ==================================================
SYSTEM_PROMPT = """You are NovaAI, a helpful, accurate, and concise AI assistant.

You help with study, coding, writing, research, planning, and general questions.

═══════════════════════════════════════════════
STRICT OUTPUT RULES
═══════════════════════════════════════════════
1. Use Markdown. Never emit raw HTML.
   FORBIDDEN tags: <br>, <div>, <span>, <p>, <b>, <i>, <u>, <ul>, <ol>, <li>, <table>, <tr>, <td>, <th>, <h1>-<h6>, <a>, <font>.
2. For line breaks inside a Markdown table cell, use " · " (middle dot) or a semicolon — never <br>.
3. For lists in normal text, use "-" or "*" at the start of each line, with a blank line before and after the list.
4. For paragraphs, separate them with a blank line. Do not use <br> to force line breaks.
5. Write "AI" correctly — never "Al".
6. MATH: use `inline` for short formulas and $$display$$ on its own line for long ones.
   Never use \\( ... \\) or \\[ ... \\].
7. Tables: Markdown pipe syntax only. Keep them small (max 6 rows × 4 columns).
8. No HTML entities (&amp;, &quot;, &#39;, &nbsp;, etc.) — write the actual character.
9. If you don't know something, say so honestly. Don't invent facts or citations.
10. When context from uploaded files is provided, ground your answer in it and cite as [Source N].
11. PERSONALIZED LEARNER CONTEXT:
    When a "PERSONALIZED LEARNER CONTEXT" block appears in this conversation,
    you MUST use it to answer. You already have the student's weak areas,
    strong areas, and profile — do NOT ask them to provide this again.
    Answer directly, confidently, and use their data. Never mention that
    the context exists — just behave as if you already know the student.
"""


# ==================================================
# Message builder
# ==================================================
def build_messages(
    conversation,
    history: List[Any],
    user_text: str,
    context_note: str = "",
    learner_context: str = "",
) -> List[Dict[str, str]]:
    """
    Build the LLM message list.
    """
    messages: List[Dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Inject learner context as a silent system message
    if learner_context and learner_context.strip():
        messages.append({"role": "system", "content": learner_context})

    # Inject RAG context as a system note
    if context_note and context_note.strip():
        messages.append({
            "role": "system",
            "content": "The user has uploaded files. Here is relevant context:\n\n" + context_note
        })

    # History — most recent N messages
    MAX_HISTORY = 20
    trimmed = list(history)[-MAX_HISTORY:] if history else []

    for msg in trimmed:
        role = getattr(msg, "role", None)
        content = getattr(msg, "content", None) or ""
        if role not in ("user", "assistant"):
            continue
        if not content.strip():
            continue
        messages.append({"role": role, "content": content})

    # Current user message (if not already in history)
    if not trimmed or getattr(trimmed[-1], "content", "") != user_text:
        messages.append({"role": "user", "content": user_text})

    return messages


# ==================================================
# Streaming
# ==================================================
def stream_completion(
    model_id: str,
    messages: List[Dict[str, str]],
) -> Iterator[str]:
    """
    Yield text chunks from the LLM Router.
    """
    yield from llm_router.stream_completion(model_id, messages)


# ==================================================
# Title generation
# ==================================================
def generate_title(user_text: str) -> str:
    """
    Generate a short conversation title.
    """
    text = (user_text or "").strip()
    if not text:
        return "New chat"

    fallback = text[:60].strip()
    if fallback and len(text) > 60:
        fallback = fallback.rsplit(" ", 1)[0] + "…"

    prompt = (
        "Generate a short, descriptive title for a chat that starts with the "
        "user message below. Rules:\n"
        "- 3 to 6 words\n"
        "- Title Case\n"
        "- No quotes, no trailing punctuation, no prefixes like 'Title:'\n"
        "- Output ONLY the title on a single line\n\n"
        f"User message:\n{text[:400]}"
    )

    try:
        title = llm_router.generate_completion(
            TITLE_MODEL,
            [{"role": "user", "content": prompt}],
            max_tokens=20
        )
        title = title.strip("\"'`. ").replace("\n", " ")
        if title:
            return title[:80]
    except Exception:
        pass

    return fallback or "New chat"