"""
Dynamic Content Generator.
The AI acts as a curriculum strategist, deciding how much content to generate
based on the complexity of the topic.
"""

import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models
from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL
from services.language_service import get_topic_owner_language, language_instruction


_topic_locks: dict[int, threading.Lock] = {}
_locks_guard = threading.Lock()


def _get_topic_lock(topic_id: int) -> threading.Lock:
    with _locks_guard:
        if topic_id not in _topic_locks:
            _topic_locks[topic_id] = threading.Lock()
        return _topic_locks[topic_id]


def _repair_latex(text: str) -> str:
    if not isinstance(text, str):
        return text
    s = text
    s = s.replace("\t" + "ext", r"\text")
    s = s.replace("\t" + "imes", r"\times")
    s = s.replace("\t" + "heta", r"\theta")
    s = s.replace("\t" + "anh", r"\tanh")
    s = s.replace("\t" + "an", r"\tan")
    s = s.replace("\t" + "op", r"\top")
    s = s.replace("\t" + "o", r"\to")
    s = s.replace("\t" + "ag", r"\tag")
    s = s.replace("\t" + "au", r"\tau")
    s = s.replace("\t" + "ilde", r"\tilde")
    s = s.replace("\r" + "ight", r"\right")
    s = s.replace("\r" + "angle", r"\rangle")
    s = s.replace("\r" + "floor", r"\rfloor")
    s = s.replace("\r" + "ceil", r"\rceil")
    s = s.replace("\r" + "ho", r"\rho")
    s = s.replace("\n" + "u", r"\nu")
    s = s.replace("\n" + "abla", r"\nabla")
    s = s.replace("\n" + "ewline", r"\newline")
    s = re.sub(r"exts\.t\.", r"\\text{ s.t. }", s)
    s = re.sub(r"extfor([a-z]+)", r"\\text{ for \1}", s)
    s = s.replace(r"\\text", r"\text")
    s = s.replace(r"\\times", r"\times")
    s = s.replace(r"\\theta", r"\theta")
    return s


def _normalize_text(value):
    if isinstance(value, str):
        s = value.replace("\\\\n", "\n")
        s = s.replace("\\n", "\n")
        s = s.replace("\\\\t", "\t")
        s = s.replace("\\t", "\t")
        s = s.replace("\\\\r", "")
        s = s.replace("\\r", "")
        s = _repair_latex(s)
        return s
    if isinstance(value, list):
        return [_normalize_text(v) for v in value]
    if isinstance(value, dict):
        return {k: _normalize_text(v) for k, v in value.items()}
    return value


CONTENT_SYSTEM_PROMPT = (
    "You are an expert AI Curriculum Designer and Teacher. "
    "Your goal is to provide exactly the right amount of educational content for a given topic. "
    "Do not pad your response with fluff. Do not invent unrelated information. "
    "Return ONLY valid JSON. No markdown fences, no prose outside JSON.\n\n"
    "CRITICAL LaTeX RULES:\n"
    "- When writing LaTeX in JSON strings, ALWAYS double-escape backslashes.\n"
    "- Avoid complex LaTeX entirely. Prefer inline code like `y = mx + b`."
)


DYNAMIC_PROMPT_TEMPLATE = """Analyze the topic "{topic}" (Subject: "{subject}", Difficulty: {difficulty}).

STEP 1: Classify the topic into ONE of these categories:
1. "focused_concept" (e.g., Overfitting, Python List comprehension, Hash Collision)
2. "standard_topic" (e.g., Binary Search, Support Vector Machine, SQL Joins)
3. "broad_field" (e.g., Data Structures, Machine Learning, Web Development)

STEP 2: Generate the JSON based on the classification.

═══════════════════════════════════════════════
GENERATION RULES
═══════════════════════════════════════════════
- If "focused_concept":
  Keep it extremely concise. Intro (1 paragraph), Real-world example (1 paragraph).
  Only 2-3 bullet points for "why needed", "applications", "challenges".
  `types_md` should be an empty string "".
  Total word count: 200-300 words.

- If "standard_topic":
  Standard depth. Intro (1-2 paragraphs), Real-world example (1 paragraph).
  3-4 bullet points per section.
  `types_md` should only list well-known subtypes (e.g., SVM -> SVC, SVR).
  Total word count: 400-600 words.

- If "broad_field":
  Comprehensive roadmap. Intro (2-3 paragraphs explaining the whole field).
  4-6 bullet points per section.
  `types_md` must list the major sub-fields (e.g., ML -> Supervised, Unsupervised, RL).
  `diagram_mermaid` must be a clear learning roadmap flowchart.
  Total word count: 800-1200 words.

FORMATTING RULES:
- Bullet lists: Each item on its OWN line starting with "- ".
- Use Markdown for headers in sections (e.g., ### Step 1: Name).
- Use real newline characters (\\n), not string escapes.
- NO HTML tags.

Return ONLY this JSON structure:
{{
  "topic_classification": "focused_concept" | "standard_topic" | "broad_field",
  "title": "string",
  "tagline": "one-line subtitle",
  "intro_md": "string",
  "real_world_example_md": "string",
  "why_needed_md": "string",
  "how_it_works_md": "string",
  "types_md": "string",
  "applications_md": "string",
  "challenges_md": "string",
  "best_practices_md": "string",
  "related_topics_md": "string",
  "diagram_mermaid": "string",
  "diagram_caption": "string"
}}

Topic: {topic}
"""


def _try_generate(model: str, topic: str, subject: str, difficulty: str, language: str = "en") -> dict:
    prompt = DYNAMIC_PROMPT_TEMPLATE.format(topic=topic, subject=subject, difficulty=difficulty)

    lang_note = language_instruction(language)
    if lang_note:
        prompt = prompt + lang_note

    # We allow max_tokens=4000 so "broad_field" has room to breathe.
    # Groq will stop generating early for "focused_concept" because the prompt tells it to.
    content = call_llm_json(
        prompt,
        system=CONTENT_SYSTEM_PROMPT,
        temperature=0.6,
        max_tokens=4000,
        model=model,
    )
    
    if not isinstance(content, dict) or "title" not in content:
        raise RuntimeError("LLM returned malformed content")

    for field in [
        "tagline", "intro_md", "real_world_example_md", "why_needed_md",
        "how_it_works_md", "types_md", "applications_md", "challenges_md",
        "best_practices_md", "related_topics_md", "diagram_mermaid",
        "diagram_caption",
    ]:
        content.setdefault(field, "")

    content = _normalize_text(content)
    return content


def generate_content(topic_name: str, subject_name: str, difficulty: str, language: str = "en") -> dict:
    try:
        # Use the FAST_MODEL (20B) first for high speed. 
        # The 20B model is more than capable of following these structured rules.
        return _try_generate(FAST_MODEL, topic_name, subject_name, difficulty, language)
    except Exception as e:
        print(f"[content_service] Fast model failed ({e}), retrying with fallback...")
        return _try_generate(DEFAULT_MODEL, topic_name, subject_name, difficulty, language)


def get_or_create_content(topic_id: int, db: Session) -> dict:
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    cached = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if cached:
        try:
            return _normalize_text(json.loads(cached.content_json))
        except json.JSONDecodeError:
            db.delete(cached)
            db.commit()

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    language = get_topic_owner_language(topic_id, db)

    content = generate_content(topic.name, subject_name, topic.difficulty or "medium", language)

    record = models.LearningContent(
        topic_id=topic_id,
        content_json=json.dumps(content),
        sources="[]",
        model_version=f"{FAST_MODEL} (Dynamic Content Strategist)",
    )
    db.add(record)

    try:
        db.commit()
        db.refresh(record)
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        if existing:
            try:
                return _normalize_text(json.loads(existing.content_json))
            except json.JSONDecodeError:
                pass
        raise

    return content


def invalidate_content(topic_id: int, db: Session) -> bool:
    record = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True


def _gen_content_thread(topic_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_or_create_content(topic_id, db)
    finally:
        db.close()


def _gen_concepts_thread(topic_id: int):
    from services.concept_service import get_or_create_concepts
    from database import SessionLocal
    db = SessionLocal()
    try:
        return get_or_create_concepts(topic_id, db)
    finally:
        db.close()


def get_or_create_full(topic_id: int, db: Session) -> tuple[dict, list]:
    db.expire_all()
    cached_content = (
        db.query(models.LearningContent)
        .filter(models.LearningContent.topic_id == topic_id)
        .first()
    )
    cached_concepts = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )

    if cached_content and cached_concepts:
        try:
            return _normalize_text(json.loads(cached_content.content_json)), cached_concepts
        except json.JSONDecodeError:
            db.delete(cached_content)
            db.commit()

    lock = _get_topic_lock(topic_id)
    with lock:
        db.expire_all()
        cached_content = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        cached_concepts = (
            db.query(models.Concept)
            .filter(models.Concept.topic_id == topic_id)
            .order_by(models.Concept.order_index)
            .all()
        )

        if cached_content and cached_concepts:
            try:
                return _normalize_text(json.loads(cached_content.content_json)), cached_concepts
            except json.JSONDecodeError:
                pass

        with ThreadPoolExecutor(max_workers=2) as ex:
            f_content = ex.submit(_gen_content_thread, topic_id)
            f_concepts = ex.submit(_gen_concepts_thread, topic_id)

            content = f_content.result()
            f_concepts.result()

        db.expire_all()
        content_record = (
            db.query(models.LearningContent)
            .filter(models.LearningContent.topic_id == topic_id)
            .first()
        )
        concepts = (
            db.query(models.Concept)
            .filter(models.Concept.topic_id == topic_id)
            .order_by(models.Concept.order_index)
            .all()
        )

        if content_record:
            try:
                content = _normalize_text(json.loads(content_record.content_json))
            except json.JSONDecodeError:
                pass

        return content, concepts