"""
Generates concept-aware test questions.
OPTIMIZED: No verification loop, retry logic, FAST_MODEL, adaptive difficulty, caching.
"""

import json
import uuid
from typing import Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from services.llm import call_llm_json
from services.concept_service import get_or_create_concepts
from services.analysis_service import update_concept_stats
from services.language_service import get_topic_owner_language, language_instruction

try:
    from services.llm import FAST_MODEL, DEFAULT_MODEL
except ImportError:
    FAST_MODEL = None
    DEFAULT_MODEL = None

TEST_SYSTEM_PROMPT = (
    "You are an expert educator producing conceptual multiple-choice questions. "
    "You always respond with valid JSON only. No markdown fences, no prose. "
    "CRITICAL: Ensure 'correct_option' letter truly matches the intended correct answer."
)

TEST_PROMPT_TEMPLATE = """Create {num} conceptual multiple-choice questions about "{topic}" (subject: {subject}, difficulty: {difficulty}).

Concepts to cover:
{concept_list}

═══════════════════════════════════════
ADAPTIVE DIFFICULTY
═══════════════════════════════════════
Student's past performance: {past_performance}
Adjust difficulty accordingly.

═══════════════════════════════════════
QUESTION TYPE MIX
═══════════════════════════════════════
Spread across: scenario, application, comparison, prediction, error-spotting, conceptual.
Do NOT produce 2+ definition-only questions.

═══════════════════════════════════════
CRITICAL: JSON FORMATTING
═══════════════════════════════════════
- DO NOT use double quotes (") inside your code snippets. Use single quotes (') instead.
- If you must use double quotes, escape them like this: \\"
- Keep explanations concise to avoid cutting off the JSON.
- Vary correct_option across A, B, C, D. Double-check the letter matches the correct option.

Return ONLY this JSON:
{{
  "questions": [
    {{
      "question": "Question ending with ?",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "correct_option": "A",
      "explanation": "1-2 sentence explanation",
      "question_type": "scenario",
      "difficulty": "{difficulty}",
      "concept_names": ["Exact Concept Name"]
    }}
  ]
}}

Topic: {topic}
"""


def _find_concept(name: str, concept_map: dict) -> Optional[models.Concept]:
    if not name:
        return None
    key = name.strip().lower()
    if key in concept_map:
        return concept_map[key]
    for cname, c in concept_map.items():
        if key in cname or cname in key:
            return c
    return None


def _call_llm_with_retry(prompt: str, system: str, max_attempts: int = 3) -> dict:
    last_error = None
    for attempt in range(max_attempts):
        try:
            kwargs = {
                "system": system,
                "temperature": 0.4 + (0.1 * attempt),
                "max_tokens": 8192,
            }
            if FAST_MODEL and attempt == 0:
                kwargs["model"] = FAST_MODEL
            elif DEFAULT_MODEL and attempt >= 1:
                kwargs["model"] = DEFAULT_MODEL

            try:
                result = call_llm_json(prompt, **kwargs)
            except TypeError:
                kwargs.pop("model", None)
                result = call_llm_json(prompt, **kwargs)

            if isinstance(result, dict) and isinstance(result.get("questions"), list):
                if len(result["questions"]) > 0:
                    return result
            last_error = ValueError("LLM returned malformed response")
        except Exception as e:
            last_error = e
            print(f"[question_service] attempt {attempt + 1} failed: {e}")
            continue

    raise RuntimeError(f"LLM failed after {max_attempts} attempts: {last_error}")


def generate_test(
    topic_id: int,
    db: Session,
    num_questions: int = 6,
    student_id: Optional[int] = None,
    force: bool = False,
) -> dict:
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError(f"Topic {topic_id} not found")

    if not force:
        existing_questions = (
            db.query(models.Question)
            .filter(models.Question.topic_id == topic_id)
            .order_by(models.Question.id.desc())
            .limit(num_questions)
            .all()
        )
        
        if len(existing_questions) >= num_questions:
            saved_payload = []
            for q in reversed(existing_questions):
                linked_concepts = []
                for link in q.concept_links:
                    if link.concept:
                        linked_concepts.append({"id": link.concept.id, "name": link.concept.name})
                
                saved_payload.append({
                    "id": q.id,
                    "question": q.question,
                    "option_a": q.option_a,
                    "option_b": q.option_b,
                    "option_c": q.option_c,
                    "option_d": q.option_d,
                    "question_type": q.question_type,
                    "difficulty": q.difficulty,
                    "concepts": linked_concepts,
                })
            
            subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
            return {
                "topic_id": topic_id,
                "topic_name": topic.name,
                "subject_name": subject.name if subject else "General",
                "difficulty": topic.difficulty,
                "total_questions": len(saved_payload),
                "questions": saved_payload,
                "cached": True
            }

    concepts = get_or_create_concepts(topic_id, db)
    if not concepts:
        raise RuntimeError("No concepts available for this topic")

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    concept_list = "\n".join(
        f"{i + 1}. {c.name} — {c.description}" for i, c in enumerate(concepts)
    )

    past_performance = "New topic (no past data)."
    if student_id:
        stats = (
            db.query(models.ConceptStat)
            .join(models.Concept, models.Concept.id == models.ConceptStat.concept_id)
            .filter(
                models.Concept.topic_id == topic_id,
                models.ConceptStat.student_id == student_id,
            )
            .all()
        )
        if stats:
            avg = sum(s.score for s in stats) / len(stats)
            if avg < 40:
                past_performance = f"Struggling (avg {round(avg)}%). Focus on basic scenarios."
            elif avg < 70:
                past_performance = f"Developing (avg {round(avg)}%). Mix application + comparison."
            else:
                past_performance = f"Advanced (avg {round(avg)}%). Focus on edge cases and error-spotting."

    prompt = TEST_PROMPT_TEMPLATE.format(
        num=num_questions,
        topic=topic.name,
        subject=subject_name,
        difficulty=topic.difficulty or "medium",
        concept_list=concept_list,
        past_performance=past_performance,
    )

    language = get_topic_owner_language(topic_id, db)
    lang_note = language_instruction(language)
    if lang_note:
        prompt = prompt + lang_note

    result = _call_llm_with_retry(prompt, TEST_SYSTEM_PROMPT, max_attempts=3)

    concept_map = {c.name.lower(): c for c in concepts}
    saved_payload = []

    for q_data in result["questions"]:
        required = ["question", "option_a", "option_b", "option_c", "option_d", "correct_option"]
        if not all(k in q_data for k in required):
            continue
        if q_data["correct_option"] not in ("A", "B", "C", "D"):
            continue

        q = models.Question(
            topic_id=topic_id,
            question=q_data["question"].strip(),
            option_a=q_data["option_a"].strip(),
            option_b=q_data["option_b"].strip(),
            option_c=q_data["option_c"].strip(),
            option_d=q_data["option_d"].strip(),
            correct_option=q_data["correct_option"],
            explanation=q_data.get("explanation", "").strip(),
            difficulty=q_data.get("difficulty", topic.difficulty or "medium"),
            question_type=q_data.get("question_type", "conceptual"),
        )
        db.add(q)
        db.flush()

        linked_concepts = []
        for cname in q_data.get("concept_names", []):
            concept = _find_concept(cname, concept_map)
            if concept:
                db.add(models.QuestionConcept(
                    question_id=q.id, concept_id=concept.id, weight=1.0,
                ))
                linked_concepts.append({"id": concept.id, "name": concept.name})

        saved_payload.append({
            "id": q.id,
            "question": q.question,
            "option_a": q.option_a,
            "option_b": q.option_b,
            "option_c": q.option_c,
            "option_d": q.option_d,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "concepts": linked_concepts,
        })

    if not saved_payload:
        raise RuntimeError("No valid questions could be saved")

    db.commit()

    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "subject_name": subject_name,
        "difficulty": topic.difficulty,
        "total_questions": len(saved_payload),
        "questions": saved_payload,
        "cached": False
    }

def generate_smart_test(student_id: int, db: Session, num_questions: int = 6) -> dict:
    topic_avg = (
        db.query(
            models.Concept.topic_id,
            func.avg(models.ConceptStat.score).label("avg_score")
        )
        .join(models.ConceptStat, models.Concept.id == models.ConceptStat.concept_id)
        .filter(models.ConceptStat.student_id == student_id)
        .group_by(models.Concept.topic_id)
        .order_by(func.avg(models.ConceptStat.score).asc())
        .first()
    )

    if topic_avg:
        topic_id = topic_avg.topic_id
    else:
        recent = db.query(models.SearchHistory).filter(
            models.SearchHistory.student_id == student_id
        ).order_by(models.SearchHistory.searched_at.desc()).first()
        
        if recent:
            topic_id = recent.topic_id
        else:
            raise ValueError("You need to study at least one topic before taking a Smart Test.")

    return generate_test(topic_id, db, num_questions, student_id=student_id, force=True)


def submit_test(
    student_id: int,
    answers: Dict[str, Optional[str]],
    db: Session,
    session_id: Optional[str] = None,
) -> dict:
    if not session_id:
        session_id = str(uuid.uuid4())

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    question_ids = []
    for k in answers.keys():
        try:
            question_ids.append(int(k))
        except (ValueError, TypeError):
            continue

    questions = db.query(models.Question).filter(models.Question.id.in_(question_ids)).all()
    q_map = {q.id: q for q in questions}

    if not questions:
        raise ValueError("No valid questions found for the given answers")

    correct_count = 0
    total = len(questions)
    details = []
    session_concept_acc: dict = {}
    concept_objs: dict = {}

    for qid_str, selected in answers.items():
        try:
            qid = int(qid_str)
        except (ValueError, TypeError):
            continue
        q = q_map.get(qid)
        if not q:
            continue

        selected_clean = (selected or "").strip().upper() or None
        is_correct = selected_clean == q.correct_option
        if is_correct:
            correct_count += 1

        db.add(models.QuestionAttempt(
            student_id=student_id,
            question_id=qid,
            selected_option=selected_clean,
            is_correct=is_correct,
            session_id=session_id,
        ))

        concept_names = []
        for link in q.concept_links:
            cid = link.concept_id
            session_concept_acc.setdefault(cid, {"correct": 0, "total": 0})
            session_concept_acc[cid]["total"] += 1
            if is_correct:
                session_concept_acc[cid]["correct"] += 1
            concept_objs[cid] = link.concept
            concept_names.append(link.concept.name)

        details.append({
            "question_id": qid,
            "question": q.question,
            "your_answer": selected_clean,
            "correct_answer": q.correct_option,
            "is_correct": is_correct,
            "explanation": q.explanation,
            "concepts": concept_names,
        })

    db.flush()

    concept_updates = []
    for cid, acc in session_concept_acc.items():
        stat = update_concept_stats(
            student_id=student_id,
            concept_id=cid,
            session_correct=acc["correct"],
            session_total=acc["total"],
            db=db,
        )
        session_score = (
            round((acc["correct"] / acc["total"]) * 100, 1) if acc["total"] else 0.0
        )
        concept_updates.append({
            "concept_id": cid,
            "concept_name": concept_objs[cid].name,
            "session_correct": acc["correct"],
            "session_total": acc["total"],
            "session_score": session_score,
            "overall_score": stat.score,
            "overall_attempts": stat.attempts,
            "confidence": stat.confidence,
            "trend": stat.trend,
        })

    score_percent = round((correct_count / total) * 100, 2) if total else 0.0
    topic_id = questions[0].topic_id

    perf = (
        db.query(models.Performance)
        .filter(
            models.Performance.student_id == student_id,
            models.Performance.topic_id == topic_id,
        )
        .first()
    )
    if perf:
        perf.score = round((perf.score + score_percent) / 2, 2)
        perf.attempts += 1
    else:
        db.add(models.Performance(
            student_id=student_id,
            topic_id=topic_id,
            score=score_percent,
            attempts=1,
        ))

    db.commit()
    concept_updates.sort(key=lambda x: x["session_score"])

    return {
        "session_id": session_id,
        "score_percent": score_percent,
        "correct": correct_count,
        "total": total,
        "concepts": concept_updates,
        "details": details,
    }

# ==================================================
# IN-TEST AI HELPER (Hint & Explain Simpler)
# ==================================================
HELP_SYSTEM_PROMPT = """You are an empathetic, expert AI Tutor.
The student just got a question wrong and needs help. 
Depending on the mode:
- If mode is "hint": Give a subtle clue without revealing the answer. Encourage them to try again.
- If mode is "simpler": Explain the concept in the simplest possible terms using a real-world analogy.

Return ONLY the text of your response. No markdown fences, no formatting.
"""

def get_question_help(question_text: str, correct_answer: str, wrong_answer: str, mode: str) -> str:
    prompt = f"""The student got this question wrong:
Question: {question_text}
Student's Answer: {wrong_answer}
Correct Answer: {correct_answer}

Mode: {mode}
Please provide the help."""
    
    try:
        from services.llm import get_client
        client = get_client()
        response = client.chat.completions.create(
            model="openai/gpt-oss-20b", # Fast model for quick help
            messages=[
                {"role": "system", "content": HELP_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            max_tokens=400,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"[question_service] help error: {e}")
        if mode == "hint":
            return "Think about the core definition we discussed earlier. What is the primary difference between the options?"
        else:
            return "Let's break this down. The correct answer focuses on the underlying mechanism, whereas your answer focuses on the outcome. Try re-reading the section on this concept."