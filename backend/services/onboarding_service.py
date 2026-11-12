"""
Phase 2 — Onboarding service.

Handles the flow:
  1. Student sets their learning goal + daily time + level
  2. System generates a 5-question diagnostic quiz for their goal
  3. Student answers → ConceptStats are created/updated
  4. onboarding_completed = True
"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

import models


# ==================================================
# Start — save goal + profile
# ==================================================
def start_onboarding(
    student_id: int,
    learning_goal: str,
    daily_time_minutes: int,
    current_level: str,
    db: Session,
) -> dict:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    student.learning_goal = (learning_goal or "").strip()[:200]
    student.daily_time_minutes = max(5, min(int(daily_time_minutes or 30), 480))
    student.current_level = (current_level or "beginner").strip().lower()
    student.onboarding_completed = False  # will be True after diagnostic
    db.commit()
    db.refresh(student)

    return {
        "student_id": student.id,
        "learning_goal": student.learning_goal,
        "daily_time_minutes": student.daily_time_minutes,
        "current_level": student.current_level,
        "onboarding_completed": bool(student.onboarding_completed),
    }


# ==================================================
# Generate — 5 diagnostic questions
# ==================================================
def generate_diagnostic(student_id: int, db: Session) -> dict:
    """
    Generate a 5-question diagnostic for the student's learning goal.

    Steps:
      1. Get/create a topic for the goal under "Explored Topics"
      2. Extract concepts for that topic
      3. Generate questions using the existing question_service
      4. Strip correct answers before returning
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    goal = (student.learning_goal or "").strip()
    if not goal:
        raise ValueError("No learning goal set — call /onboarding/start first")

    level = student.current_level or "beginner"

    # ---------- 1. Get / create "Explored Topics" subject ----------
    explored = (
        db.query(models.Subject)
        .filter(
            models.Subject.student_id == student_id,
            models.Subject.name == "Explored Topics",
        )
        .first()
    )
    if not explored:
        explored = models.Subject(name="Explored Topics", student_id=student_id)
        db.add(explored)
        db.commit()
        db.refresh(explored)

    # ---------- 2. Get / create the topic ----------
    topic = (
        db.query(models.Topic)
        .filter(
            models.Topic.subject_id == explored.id,
            models.Topic.name.ilike(goal),
        )
        .first()
    )
    if not topic:
        topic = models.Topic(
            name=goal,
            difficulty="medium",
            subject_id=explored.id,
        )
        db.add(topic)
        db.commit()
        db.refresh(topic)

    # ---------- 3. Extract concepts ----------
    try:
        from services.concept_service import get_or_create_concepts
        concepts = get_or_create_concepts(topic.id, db)
    except Exception as e:
        raise ValueError(f"Could not extract concepts: {e}")

    if not concepts:
        raise ValueError("No concepts could be extracted for this goal")

    # ---------- 4. Generate questions ----------
    try:
        from services.question_service import generate_test
        test_result = generate_test(topic.id, db, num_questions=5)
    except Exception as e:
        raise ValueError(f"Could not generate questions: {e}")

    questions_raw = test_result.get("questions", [])
    if not questions_raw:
        raise ValueError("No questions were generated")

    # ---------- 5. Strip correct answers ----------
    questions = []
    for q in questions_raw:
        questions.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "option_a": q.get("option_a"),
            "option_b": q.get("option_b"),
            "option_c": q.get("option_c"),
            "option_d": q.get("option_d"),
            "difficulty": q.get("difficulty", "medium"),
            "question_type": q.get("question_type", "conceptual"),
        })

    return {
        "student_id": student_id,
        "topic_id": topic.id,
        "topic_name": topic.name,
        "session_id": test_result.get("session_id"),
        "total_questions": len(questions),
        "questions": questions,
    }


# ==================================================
# Submit — process results + mark complete
# ==================================================
def submit_diagnostic(
    student_id: int,
    topic_id: int,
    answers: Dict[str, Optional[str]],
    session_id: Optional[str],
    db: Session,
) -> dict:
    """
    Submit answers → updates ConceptStats, marks onboarding complete.
    Delegates to existing question_service.submit_test.
    """
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    try:
        from services.question_service import submit_test
        result = submit_test(
            student_id=student_id,
            answers=answers,
            db=db,
            session_id=session_id,
        )
    except Exception as e:
        raise ValueError(f"Could not process diagnostic: {e}")

    # Mark onboarding complete
    student.onboarding_completed = True
    db.commit()

    # Add a friendly summary on top of the raw result
    total = result.get("total_questions") or len(answers)
    correct = result.get("correct_count") or result.get("score_count") or 0
    try:
        correct = int(correct)
    except Exception:
        correct = 0
    percent = round((correct / total) * 100, 1) if total else 0

    return {
        "student_id": student_id,
        "onboarding_completed": True,
        "total_questions": total,
        "correct": correct,
        "percent": percent,
        "raw": result,
    }