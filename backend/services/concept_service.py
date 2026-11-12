"""
Extracts key concepts from a topic using Groq (fast model).
Handles concurrent inserts safely.
"""

from sqlalchemy.orm import Session
import models
from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL


CONCEPT_SYSTEM_PROMPT = (
    "You extract conceptual building blocks from educational topics. "
    "Return ONLY valid JSON."
)


CONCEPT_PROMPT_TEMPLATE = """Extract the 6-8 most important CONCEPTS from "{topic}" ({subject}, {difficulty}).

A concept is a specific testable idea (not vague like "Introduction" or "Basics").

Return ONLY:
{{
  "concepts": [
    {{"name": "2-6 word name", "description": "one clear sentence", "importance": 3}}
  ]
}}

importance is 1-5 (5 = essential).

Topic: {topic}
"""


def extract_concepts(topic_name: str, subject_name: str, difficulty: str) -> list[dict]:
    prompt = CONCEPT_PROMPT_TEMPLATE.format(
        topic=topic_name, subject=subject_name, difficulty=difficulty
    )

    try:
        result = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=1200,
            model=FAST_MODEL,
        )
    except Exception:
        result = call_llm_json(
            prompt,
            system=CONCEPT_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=1200,
            model=DEFAULT_MODEL,
        )

    if isinstance(result, dict) and "concepts" in result:
        concepts = result["concepts"]
    elif isinstance(result, list):
        concepts = result
    else:
        raise RuntimeError("LLM returned unexpected structure for concepts")

    cleaned = []
    for i, c in enumerate(concepts):
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        if not name or len(name) < 3:
            continue
        description = (c.get("description") or "").strip()
        try:
            importance = int(c.get("importance", 3))
        except Exception:
            importance = 3
        importance = max(1, min(5, importance))
        cleaned.append({
            "name": name,
            "description": description,
            "importance": importance,
            "order_index": i,
        })

    if len(cleaned) < 3:
        raise RuntimeError("LLM returned too few concepts")
    return cleaned


def get_or_create_concepts(topic_id: int, db: Session, force: bool = False) -> list[models.Concept]:
    """Return existing concepts; if none exist (or force=True), extract and save."""
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    existing = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )

    if existing and not force:
        return existing

    if existing and force:
        for c in existing:
            db.delete(c)
        db.commit()

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    concepts_data = extract_concepts(
        topic.name, subject_name, topic.difficulty or "medium"
    )

    # Re-check right before insert (in case another thread got here first)
    db.expire_all()
    already = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )
    if already:
        return already

    created = []
    for c in concepts_data:
        record = models.Concept(
            topic_id=topic_id,
            name=c["name"],
            description=c["description"],
            importance=c["importance"],
            order_index=c["order_index"],
        )
        db.add(record)
        created.append(record)

    db.commit()
    for c in created:
        db.refresh(c)
    return created