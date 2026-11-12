from sqlalchemy.orm import Session
import models


def calculate_priority(score: float, difficulty: str, attempts: int) -> float:
    """Compute a priority score for a topic. Higher = more urgent."""
    priority = 100.0 - score  # weak topics = higher priority

    # Difficulty bonus
    if difficulty == "hard":
        priority += 15
    elif difficulty == "medium":
        priority += 5

    # Attempts bonus (tried often but still weak → urgent)
    if attempts >= 3 and score < 60:
        priority += 10

    return round(priority, 2)


def get_recommendations(student_id: int, db: Session):
    """
    Return a ranked list of topics for the student, weakest first.
    Includes topics the student has no performance record for yet.
    """
    # Get all subjects of the student
    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    if not subjects:
        return []

    results = []

    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        for topic in topics:
            # Find latest performance record
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id
            ).first()

            score = perf.score if perf else 0.0
            attempts = perf.attempts if perf else 0

            priority = calculate_priority(score, topic.difficulty, attempts)

            results.append({
                "topic_id": topic.id,
                "topic_name": topic.name,
                "subject_name": subject.name,
                "difficulty": topic.difficulty,
                "score": score,
                "attempts": attempts,
                "priority": priority,
                "reason": build_reason(score, topic.difficulty, attempts)
            })

    # Sort by highest priority
    results.sort(key=lambda x: x["priority"], reverse=True)
    return results


def build_reason(score: float, difficulty: str, attempts: int) -> str:
    """Human-readable explanation for why this topic is recommended."""
    if attempts == 0:
        return "Not attempted yet — start here."
    if score < 40:
        return "Very low score. Needs immediate attention."
    if score < 60:
        return "Below average. Consistent practice needed."
    if difficulty == "hard" and score < 75:
        return "Hard topic, still below target."
    if score >= 80:
        return "Strong. Light revision is enough."
    return "Moderate. Keep practicing."


def generate_study_plan(student_id: int, db: Session, daily_minutes: int = 120):
    """
    Create today's study plan automatically from recommendations.
    Distributes the daily_minutes across the top topics.
    """
    from datetime import date

    today = str(date.today())
    recommendations = get_recommendations(student_id, db)

    if not recommendations:
        return []

    # Take top 3 topics (or fewer if not enough)
    top_topics = recommendations[:3]

    # Distribute time: 50% / 30% / 20%
    weights = [0.5, 0.3, 0.2]

    created_plans = []
    for topic, weight in zip(top_topics, weights):
        minutes = int(daily_minutes * weight)

        new_plan = models.StudyPlan(
            student_id=student_id,
            topic_id=topic["topic_id"],
            date=today,
            duration_minutes=minutes,
            completed=False
        )
        db.add(new_plan)
        created_plans.append(new_plan)

    db.commit()
    for p in created_plans:
        db.refresh(p)

    return created_plans