"""
Generates focused, deep-dive content for a single concept.
Uses fast model + per-concept lock + text normalizer + language support.
"""

import json
import threading
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
import models
from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL
from services.language_service import get_concept_owner_language, language_instruction


_concept_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_concept_lock(concept_id: int) -> threading.Lock:
    with _locks_guard:
        if concept_id not in _concept_locks:
            _concept_locks[concept_id] = threading.Lock()
        return _concept_locks[concept_id]


def _normalize_text(value):
    if isinstance(value, str):
        s = value.replace("\\\\n", "\n")
        s = s.replace("\\n", "\n")
        s = s.replace("\\\\t", "\t")
        s = s.replace("\\t", "\t")
        s = s.replace("\\\\r", "")
        s = s.replace("\\r", "")
        return s
    if isinstance(value, list):
        return [_normalize_text(v) for v in value]
    if isinstance(value, dict):
        return {k: _normalize_text(v) for k, v in value.items()}
    return value


CONCEPT_SYSTEM_PROMPT = (
    "You are an expert educator producing focused, deep-dive explanations "
    "of individual concepts. You adapt your examples to the nature of the "
    "concept — code only when the concept is programming-related; otherwise "
    "use real-world scenarios, analogies, or step-by-step reasoning. "
    "You always respond with valid JSON only. No markdown fences, no prose. "
    "CRITICAL: Use REAL newline characters in markdown text — never escape them as \\\\n."
)


CONCEPT_CONTENT_PROMPT = """Write a focused, deep-dive explanation of the concept "{concept}" from the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

Context: {description}

Rules:
- Dive deep into THIS concept only
- Beginner-friendly but technically accurate
- Return ONLY valid JSON
- Use REAL newline characters in markdown text, not \\\\n escapes

CONCRETE EXAMPLE — MATCH THE TOPIC:
- Programming concepts → use fenced code blocks (```python, ```cpp, etc.)
- Mathematical/ML theory → use a NUMERICAL worked example with simple numbers
- Abstract/conceptual ideas → use a real-world analogy or scenario
- Process/workflow concepts → use a step-by-step narrated walkthrough

RULES:
- If the concept is NOT clearly programming-related, DO NOT use code.
- A numerical example with 5 concrete numbers is often better than 20 lines of code.
- Match the learner's level ({difficulty}) — beginners need analogies and simple numbers.

MARKDOWN FORMATTING:
For concrete_example, use rich markdown:
- ## <short descriptive title>
- 1-2 sentence intro
- ### Step 1, ### Step 2, ... OR ### Case 1, ### Case 2
- **bold** for key terms, `code` for inline formulas
- $$...$$ on its own line for display math
- Only use fenced code blocks when the concept is genuinely programming-related

Do NOT include a summary table.

SCHEMA:
{{
  "summary": "1-2 sentence essence",
  "why_it_matters": "2-3 sentences",
  "deep_explanation": "6-8 sentence explanation",
  "how_it_works": ["step 1", "step 2", "step 3"],
  "intuition": "an analogy that makes it click",
  "concrete_example": "markdown example (see above — match the topic)",
  "common_pitfalls": ["pitfall 1", "pitfall 2", "pitfall 3"],
  "connections": ["related concept 1", "related concept 2"],
  "quick_check": "one short question"
}}

Keep it concise: 400-600 words total.
"""


def generate_concept_content(
    concept_name: str,
    description: str,
    topic_name: str,
    subject_name: str,
    difficulty: str,
    language: str = "en",
) -> dict:
    prompt = CONCEPT_CONTENT_PROMPT.format(
        concept=concept_name,
        description=description or "No additional description.",
        topic=topic_name,
        subject=subject_name,
        difficulty=difficulty,
    )

    lang_note = language_instruction(language)
    if lang_note:
        prompt = prompt + lang_note

    try:
        content = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=2500,
            model=FAST_MODEL,
        )
    except Exception:
        content = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.7,
            max_tokens=2500,
            model=DEFAULT_MODEL,
        )

    if not isinstance(content, dict) or "summary" not in content:
        raise RuntimeError("LLM returned malformed concept content")

    content = _normalize_text(content)
    return content


def get_or_create_concept_content(concept_id: int, db: Session, force: bool = False) -> dict:
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise ValueError(f"Concept {concept_id} not found")

    if not force:
        cached = (
            db.query(models.ConceptContent)
            .filter(models.ConceptContent.concept_id == concept_id)
            .first()
        )
        if cached:
            try:
                return _normalize_text(json.loads(cached.content_json))
            except json.JSONDecodeError:
                db.delete(cached)
                db.commit()

    lock = _get_concept_lock(concept_id)
    with lock:
        db.expire_all()

        if not force:
            cached = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if cached:
                try:
                    return _normalize_text(json.loads(cached.content_json))
                except json.JSONDecodeError:
                    db.delete(cached)
                    db.commit()

        if force:
            existing = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if existing:
                db.delete(existing)
                db.commit()

        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            raise ValueError("Topic missing for concept")
        subject = (
            db.query(models.Subject)
            .filter(models.Subject.id == topic.subject_id)
            .first()
        )
        subject_name = subject.name if subject else "General"

        language = get_concept_owner_language(concept_id, db)

        content = generate_concept_content(
            concept_name=concept.name,
            description=concept.description or "",
            topic_name=topic.name,
            subject_name=subject_name,
            difficulty=topic.difficulty or "medium",
            language=language,
        )

        record = models.ConceptContent(
            concept_id=concept_id,
            content_json=json.dumps(content),
            model_version=f"{FAST_MODEL} (with {DEFAULT_MODEL} fallback)",
        )
        db.add(record)

        try:
            db.commit()
            db.refresh(record)
        except IntegrityError:
            db.rollback()
            existing = (
                db.query(models.ConceptContent)
                .filter(models.ConceptContent.concept_id == concept_id)
                .first()
            )
            if existing:
                try:
                    return _normalize_text(json.loads(existing.content_json))
                except json.JSONDecodeError:
                    pass
            raise

        return content


def invalidate_concept_content(concept_id: int, db: Session) -> bool:
    record = (
        db.query(models.ConceptContent)
        .filter(models.ConceptContent.concept_id == concept_id)
        .first()
    )
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True