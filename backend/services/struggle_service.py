"""
Intelligent Struggle Detection Service.
Analyzes ConceptStats to find patterns of struggle.
"""

from sqlalchemy.orm import Session, joinedload
import models


def detect_struggles(student_id: int, db: Session) -> list[dict]:
    struggles = []

    # SPEED FIX: Use joinedload to fetch concept and topic in a single query
    stats = (
        db.query(models.ConceptStat)
        .options(
            joinedload(models.ConceptStat.concept)
            .joinedload(models.Concept.topic)
        )
        .filter(models.ConceptStat.student_id == student_id)
        .all()
    )

    for s in stats:
        concept = s.concept
        if not concept or not concept.topic:
            continue
        topic = concept.topic

        reason = None

        if s.score < 40 and s.attempts >= 1:
            reason = f"Your score is {round(s.score)}%, below the passing threshold."
        elif s.attempts >= 3 and s.score < 60:
            reason = f"Tried {s.attempts} times but still at {round(s.score)}%. The current explanation may not be clicking."
        elif s.trend == "declining":
            reason = "Your recent performance on this concept has dropped."

        if reason:
            struggles.append({
                "concept_id": concept.id,
                "concept_name": concept.name,
                "topic_id": topic.id,
                "topic_name": topic.name,
                "score": round(s.score),
                "attempts": s.attempts,
                "reason": reason,
                "suggested_action": f"Would you like me to explain {concept.name} in a simpler way?",
            })

    struggles.sort(key=lambda x: x["score"])
    return struggles[:3]