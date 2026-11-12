"""
Updates concept_stats (per-student, per-concept performance snapshots)
after each test session.
"""

from sqlalchemy.orm import Session
import models


def update_concept_stats(
    student_id: int,
    concept_id: int,
    session_correct: int,
    session_total: int,
    db: Session,
) -> models.ConceptStat:
    """
    Update (or create) the ConceptStat for one student+concept pair,
    using this session's results.

    Uses a rolling average so recent performance matters more.
    """
    stat = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.concept_id == concept_id,
        )
        .first()
    )

    session_score = (
        (session_correct / session_total) * 100 if session_total else 0.0
    )

    # First time we see this concept for this student
    if stat is None:
        stat = models.ConceptStat(
            student_id=student_id,
            concept_id=concept_id,
            attempts=session_total,
            correct=session_correct,
            score=round(session_score, 2),
            confidence=min(session_total / 5.0, 1.0),
            trend="stable",
        )
        db.add(stat)
        db.flush()
        return stat

    # Update existing stat — rolling average (70% old, 30% new)
    old_score = stat.score
    stat.score = round(0.7 * old_score + 0.3 * session_score, 2)
    stat.attempts += session_total
    stat.correct += session_correct
    stat.confidence = min(stat.attempts / 5.0, 1.0)

    # Trend based on direction of change
    diff = session_score - old_score
    if diff > 8:
        stat.trend = "improving"
    elif diff < -8:
        stat.trend = "declining"
    else:
        stat.trend = "stable"

    db.flush()
    return stat