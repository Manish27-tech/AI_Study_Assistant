"""
Rule-based recommendation engine. Optimized (no N+1 queries).
"""

from sqlalchemy.orm import Session, joinedload
import models

W_WEAKNESS = 0.50
W_IMPORTANCE = 0.20
W_DIFFICULTY = 0.15
W_TREND = 0.15

DIFFICULTY_WEIGHT = {"easy": 0.0, "medium": 50.0, "hard": 100.0}
TREND_WEIGHT = {"improving": 0.0, "stable": 50.0, "declining": 100.0}


def compute_priority(score: float, importance: int, difficulty: str, trend: str) -> float:
    weakness = max(0.0, 100.0 - score)
    importance_score = (importance or 3) * 20.0
    difficulty_score = DIFFICULTY_WEIGHT.get((difficulty or "medium").lower(), 50.0)
    trend_score = TREND_WEIGHT.get(trend or "stable", 50.0)
    priority = (
        W_WEAKNESS * weakness
        + W_IMPORTANCE * importance_score
        + W_DIFFICULTY * difficulty_score
        + W_TREND * trend_score
    )
    return round(min(100.0, max(0.0, priority)), 1)


def pick_activity(priority: float, attempts: int, score: float) -> tuple:
    if attempts == 0:
        return ("read", 45)
    if score < 30:
        return ("read", 60)
    if score < 50:
        return ("practice", 45)
    if score < 70:
        return ("quiz", 30)
    if score < 85:
        return ("revise", 20)
    return ("revise", 15)


def build_reason(concept_name: str, score: float, trend: str, attempts: int, importance: int) -> str:
    if attempts == 0:
        return f"You haven't tested '{concept_name}' yet. Start with a read-through."
    if trend == "declining":
        return f"Your performance on '{concept_name}' is declining ({score:.0f}%). Needs immediate attention."
    if score < 30:
        return f"Your score on '{concept_name}' is very low ({score:.0f}%). Re-read and retest."
    if score < 50:
        return f"'{concept_name}' is a weak area ({score:.0f}%). Practice questions will help."
    if importance >= 4 and score < 70:
        return f"'{concept_name}' is critical for this topic and you're at {score:.0f}%. Focus here."
    if score < 70:
        return f"'{concept_name}' is developing ({score:.0f}%). A short quiz will reinforce it."
    return f"'{concept_name}' at {score:.0f}%. Light revision to lock it in."


def generate_recommendations(student_id: int, db: Session, max_recs: int = 8, force: bool = False) -> list:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    existing = (
        db.query(models.Recommendation)
        .filter(models.Recommendation.student_id == student_id)
    )
    if force:
        existing.delete()
    else:
        existing.filter(models.Recommendation.status == "pending").delete()
    db.flush()

    # Eager-load concept -> topic -> subject (fixes N+1)
    stats = (
        db.query(models.ConceptStat)
        .options(
            joinedload(models.ConceptStat.concept)
            .joinedload(models.Concept.topic)
            .joinedload(models.Topic.subject)
        )
        .filter(models.ConceptStat.student_id == student_id)
        .all()
    )

    candidates = []
    for stat in stats:
        concept = stat.concept
        if not concept or not concept.topic:
            continue
        topic = concept.topic

        if stat.score >= 90 and stat.confidence >= 0.6:
            continue

        priority = compute_priority(
            score=stat.score,
            importance=concept.importance,
            difficulty=topic.difficulty,
            trend=stat.trend,
        )
        activity, minutes = pick_activity(priority, stat.attempts, stat.score)
        reason = build_reason(
            concept.name, stat.score, stat.trend, stat.attempts, concept.importance
        )

        candidates.append({
            "concept_id": concept.id,
            "concept_name": concept.name,
            "topic_id": topic.id,
            "topic_name": topic.name,
            "subject_name": topic.subject.name if topic.subject else "—",
            "importance": concept.importance,
            "score": stat.score,
            "trend": stat.trend,
            "attempts": stat.attempts,
            "confidence": stat.confidence,
            "priority": priority,
            "activity_type": activity,
            "suggested_minutes": minutes,
            "reason": reason,
        })

    candidates.sort(key=lambda x: (-x["priority"], x["score"]))
    top = candidates[:max_recs]

    saved = []
    for c in top:
        rec = models.Recommendation(
            student_id=student_id,
            concept_id=c["concept_id"],
            priority=c["priority"],
            reason=c["reason"],
            suggested_minutes=c["suggested_minutes"],
            activity_type=c["activity_type"],
            status="pending",
        )
        db.add(rec)
        saved.append((rec, c))
    db.commit()

    result = []
    for rec, c in saved:
        db.refresh(rec)
        result.append({
            "id": rec.id,
            "concept_id": c["concept_id"],
            "concept_name": c["concept_name"],
            "topic_id": c["topic_id"],
            "topic_name": c["topic_name"],
            "subject_name": c["subject_name"],
            "priority": c["priority"],
            "reason": c["reason"],
            "suggested_minutes": c["suggested_minutes"],
            "activity_type": c["activity_type"],
            "status": rec.status,
            "score": c["score"],
            "trend": c["trend"],
            "attempts": c["attempts"],
            "importance": c["importance"],
        })
    return result


def get_pending_recommendations(student_id: int, db: Session) -> list:
    recs = (
        db.query(models.Recommendation)
        .options(
            joinedload(models.Recommendation.concept)
            .joinedload(models.Concept.topic)
            .joinedload(models.Topic.subject)
        )
        .filter(
            models.Recommendation.student_id == student_id,
            models.Recommendation.status == "pending",
        )
        .order_by(models.Recommendation.priority.desc())
        .all()
    )

    result = []
    for r in recs:
        concept = r.concept
        if not concept:
            continue
        topic = concept.topic
        subject_name = topic.subject.name if topic and topic.subject else "—"

        stat = (
            db.query(models.ConceptStat)
            .filter(
                models.ConceptStat.student_id == student_id,
                models.ConceptStat.concept_id == r.concept_id,
            )
            .first()
        )

        result.append({
            "id": r.id,
            "concept_id": r.concept_id,
            "concept_name": concept.name,
            "topic_id": topic.id if topic else None,
            "topic_name": topic.name if topic else "—",
            "subject_name": subject_name,
            "priority": r.priority,
            "reason": r.reason,
            "suggested_minutes": r.suggested_minutes,
            "activity_type": r.activity_type,
            "status": r.status,
            "score": stat.score if stat else 0.0,
            "trend": stat.trend if stat else "stable",
            "attempts": stat.attempts if stat else 0,
            "importance": concept.importance,
        })
    return result


def mark_completed(rec_id: int, student_id: int, db: Session):
    rec = (
        db.query(models.Recommendation)
        .filter(
            models.Recommendation.id == rec_id,
            models.Recommendation.student_id == student_id,
        )
        .first()
    )
    if not rec:
        raise ValueError("Recommendation not found")
    rec.status = "done"
    db.commit()
    db.refresh(rec)
    return rec