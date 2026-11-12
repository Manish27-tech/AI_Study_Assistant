"""
AI Tutor: concise, app-aware, memory-enabled, web-aware, language-aware.
"""

import os
import re
from dotenv import load_dotenv
from groq import Groq

from services.web_search_service import needs_web_search, search_web
from services.language_service import language_instruction

load_dotenv()

_client = None


def get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY not found. Create backend/.env with GROQ_API_KEY=..."
            )
        _client = Groq(api_key=api_key)
    return _client


SYSTEM_PROMPT = """You are a friendly, concise AI Study Tutor inside the "AI Study Assistant" app.

═══════════════════════════════════════════════
PRIMARY RULE — ANSWER THE USER'S ACTUAL QUESTION
═══════════════════════════════════════════════

The user is talking about a specific topic. Your job is to help with THAT topic.

Background notes about weak concepts are BACKGROUND ONLY. NEVER switch the
conversation to those concepts unless the user explicitly asks.

If the user says "it", "that", "more info", "in points" — refer to what they
were just discussing (see conversation history).

═══════════════════════════════════════════════
RESPONSE STYLE
═══════════════════════════════════════════════

Match length to the question:
- Casual ("hi", "ok", "thanks") → 1 SHORT sentence
- Simple question → 2-4 sentences
- Concept explanation → up to 200 words
- "Give me more info" / "in points" → expand on the PREVIOUS topic

═══════════════════════════════════════════════
FORMATTING — NO MARKDOWN SPAM
═══════════════════════════════════════════════

- NEVER use ** for bold.
- NEVER use * for italic.
- NEVER use ## or ### headers.
- NEVER use emojis.
- Bullet lists: use only "- " at line start.
- Numbered lists: only when user asked for steps.
- For emphasis, just write the word normally.

═══════════════════════════════════════════════
USING WEB RESULTS (when provided)
═══════════════════════════════════════════════

If you see a "LIVE WEB RESULTS" section below, you may use those results to
answer. Guidelines:
- Prefer web results over your training knowledge for recent events.
- Cite sources inline as [1], [2], etc.
- If web results contradict your knowledge, trust the web results.
- If web results are irrelevant, ignore them.
- If you genuinely don't know, say so.

═══════════════════════════════════════════════
APP KNOWLEDGE
═══════════════════════════════════════════════

Sidebar pages: Dashboard, Search, Upload & Learn, Test, Knowledge Gaps,
Recommendations, AI Tutor, Settings.

Never invent buttons or features not in this list.
"""


# ==================================================
# DEDUPE / FILTER WEAK CONCEPTS
# ==================================================
_STOP_WORDS = {
    "and", "or", "the", "of", "for", "in", "to", "with",
    "a", "an", "on", "at", "by",
}


def _normalize_key(name: str) -> str:
    key = name.lower()
    key = re.sub(r"[^a-z0-9 ]", " ", key)
    words = sorted(set(w for w in key.split() if w and w not in _STOP_WORDS))
    return " ".join(words)


def _is_duplicate(key: str, seen_keys: set) -> bool:
    if key in seen_keys:
        return True
    kw = set(key.split())
    if not kw:
        return True
    for s in seen_keys:
        sw = set(s.split())
        if not sw:
            continue
        overlap = len(kw & sw) / max(len(kw), len(sw))
        if overlap >= 0.7:
            return True
    return False


def filter_weak_concepts(weak: list[dict], max_n: int = 3) -> list[dict]:
    filtered = []
    for c in weak:
        if c.get("attempts", 0) < 1:
            continue
        if c.get("score", 100) >= 65:
            continue
        filtered.append(c)

    filtered.sort(key=lambda x: x.get("score", 100))

    result = []
    seen = set()
    for c in filtered:
        key = _normalize_key(c["concept_name"])
        if not key:
            continue
        if _is_duplicate(key, seen):
            continue
        seen.add(key)
        result.append(c)
        if len(result) >= max_n:
            break

    return result


# ==================================================
# MAIN ENTRY
# ==================================================
def ask_tutor(
    question: str,
    weak_concepts: list[dict],
    history: list[dict] | None = None,
    language: str = "en",
) -> dict:
    """
    Returns:
        {
            "answer": str,
            "sources": [ {title, url, snippet}, ... ]
        }
    """
    client = get_client()

    system_prompt = SYSTEM_PROMPT
    lang_note = language_instruction(language)
    if lang_note:
        system_prompt = system_prompt + lang_note

    messages = [{"role": "system", "content": system_prompt}]

    # ---------- Weak concepts (soft background) ----------
    if weak_concepts:
        lines = [
            f"- {c['concept_name']} ({c.get('score', 0)}%)"
            for c in weak_concepts[:3]
        ]
        context = (
            "BACKGROUND ONLY (do not treat as the topic):\n"
            + "\n".join(lines)
            + "\n\nOnly mention these if the user directly asks. Otherwise ignore."
        )
        messages.append({"role": "system", "content": context})

    # ---------- Web search (if needed) ----------
    sources = []
    if needs_web_search(question):
        results = search_web(question, max_results=4)
        if results:
            sources = results
            lines = []
            for i, r in enumerate(results, start=1):
                lines.append(f"[{i}] {r['title']}\nURL: {r['url']}\n{r['snippet']}")
            web_block = (
                "LIVE WEB RESULTS (use these for recent info; cite as [1], [2], ...):\n\n"
                + "\n\n".join(lines)
            )
            messages.append({"role": "system", "content": web_block})

    # ---------- Conversation history ----------
    if history:
        for h in history[-6:]:
            role = h.get("role")
            content = h.get("content")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

    # ---------- Current question ----------
    messages.append({"role": "user", "content": question})

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0.6,
        max_tokens=700,
    )

    raw = response.choices[0].message.content.strip()
    cleaned = _strip_markdown_spam(raw)

    return {"answer": cleaned, "sources": sources}


def _strip_markdown_spam(text: str) -> str:
    if not text:
        return text
    s = text
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    s = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"\1", s)
    s = re.sub(r"__(.+?)__", r"\1", s)
    s = re.sub(r"^#{1,6}\s+", "", s, flags=re.MULTILINE)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    return s.strip()


# ==================================================
# LEGACY QUIZ GENERATOR
# ==================================================
QUIZ_GEN_PROMPT = """You are an expert educator creating multiple-choice questions to test CONCEPTUAL understanding.

Generate {num} multiple-choice questions on the topic "{topic}" (subject: "{subject}") at {difficulty} difficulty level.

Requirements:
- Test CONCEPTUAL understanding, not rote memorization
- Include application-based, reasoning, and "why/how" questions
- Avoid trivial "what is X" definition-only questions
- Each question must have exactly 4 options labeled A, B, C, D
- Only ONE option must be correct
- Distractors must be plausible but wrong

Return ONLY a valid JSON array (no prose, no markdown) in this exact format:
[
  {{
    "question": "Full question text here?",
    "option_a": "First option",
    "option_b": "Second option",
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_option": "A"
  }}
]

The "correct_option" must be exactly one of: "A", "B", "C", "D".
Output nothing else before or after the JSON array.
"""


def generate_quiz_questions(
    topic_name: str,
    subject_name: str,
    difficulty: str,
    num_questions: int = 5,
) -> list[dict]:
    """Legacy helper — kept for compatibility."""
    client = get_client()

    prompt = QUIZ_GEN_PROMPT.format(
        num=num_questions,
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )

    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=[
            {
                "role": "system",
                "content": "You are a JSON-only quiz generator. Always respond with a valid JSON array. Never include markdown fences or prose.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.85,
        max_tokens=3500,
    )

    import json
    content = response.choices[0].message.content.strip()

    if content.startswith("```"):
        content = content.split("```")[1]
        if content.lower().startswith("json"):
            content = content[4:]
        content = content.strip()

    start = content.find("[")
    end = content.rfind("]")
    if start != -1 and end != -1:
        content = content[start : end + 1]

    try:
        questions = json.loads(content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse quiz JSON: {e}")

    if not isinstance(questions, list) or len(questions) == 0:
        raise RuntimeError("Groq returned no questions")

    cleaned = []
    for q in questions:
        if not all(k in q for k in ["question", "option_a", "option_b", "option_c", "option_d", "correct_option"]):
            continue
        if q["correct_option"] not in ("A", "B", "C", "D"):
            continue
        cleaned.append(q)

    if not cleaned:
        raise RuntimeError("Groq returned malformed questions")

    return cleaned