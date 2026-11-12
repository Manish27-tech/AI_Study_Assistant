"""
Learner Context Builder for personalized AI tutoring.

Reads the student's profile, weak concepts, strong concepts, and recent
activity from the database, then produces a compact text block that can
be injected into the LLM system prompt.

The LLM uses this to tailor explanations — no new database tables needed.
"""

import models


def build_learner_context(db, student_id: int) -> str:
    """
    Build a personalized context block for the LLM.

    Returns an empty string if the student has no meaningful data yet
    (e.g. brand new user with no quiz attempts).
    """
    if not student_id:
        return ""

    student = (
        db.query(models.Student)
        .filter(models.Student.id == student_id)
        .first()
    )
    if not student:
        return ""

    sections = []

    # ---------- 1. Student profile ----------
    profile_bits = []
    if student.education_level:
        profile_bits.append(f"education level: {student.education_level}")
    if student.preferred_learning_style:
        profile_bits.append(f"learning style: {student.preferred_learning_style}")
    if student.preferred_language and student.preferred_language != "en":
        profile_bits.append(f"preferred language: {student.preferred_language}")
    if student.course:
        profile_bits.append(f"studying: {student.course}")

    if profile_bits:
        sections.append(
            "STUDENT PROFILE\n  " + "\n  ".join(profile_bits)
        )

    # ---------- 2. Weak areas ----------
    weak_stats = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score < 50,
            models.ConceptStat.attempts >= 1,
        )
        .order_by(models.ConceptStat.score.asc())
        .limit(5)
        .all()
    )

    if weak_stats:
        lines = []
        for s in weak_stats:
            concept = (
                db.query(models.Concept)
                .filter(models.Concept.id == s.concept_id)
                .first()
            )
            if not concept:
                continue
            topic = (
                db.query(models.Topic)
                .filter(models.Topic.id == concept.topic_id)
                .first()
            )
            topic_name = topic.name if topic else "General"
            lines.append(
                f"  - {concept.name} (in {topic_name}): "
                f"score {round(s.score)}%, {s.attempts} attempt(s), "
                f"trend: {s.trend or 'stable'}"
            )
        if lines:
            sections.append("WEAK AREAS (student scored below 50%)\n" + "\n".join(lines))

    # ---------- 3. Strong areas ----------
    strong_stats = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score >= 75,
            models.ConceptStat.attempts >= 2,
        )
        .order_by(models.ConceptStat.score.desc())
        .limit(3)
        .all()
    )

    if strong_stats:
        lines = []
        for s in strong_stats:
            concept = (
                db.query(models.Concept)
                .filter(models.Concept.id == s.concept_id)
                .first()
            )
            if not concept:
                continue
            lines.append(f"  - {concept.name}: score {round(s.score)}%")
        if lines:
            sections.append(
                "STRONG AREAS (student already knows these — skip basics)\n"
                + "\n".join(lines)
            )

    # ---------- 4. Recently explored topics ----------
    try:
        recent = (
            db.query(models.SearchHistory)
            .filter(models.SearchHistory.student_id == student_id)
            .order_by(models.SearchHistory.searched_at.desc())
            .limit(5)
            .all()
        )
        lines = []
        for h in recent:
            topic = (
                db.query(models.Topic)
                .filter(models.Topic.id == h.topic_id)
                .first()
            )
            if topic:
                lines.append(f"  - {topic.name}")
        if lines:
            sections.append("RECENTLY EXPLORED\n" + "\n".join(lines))
    except Exception:
        pass

    if not sections:
        return ""

    header = (
        "═══════════════════════════════════════════\n"
        "PERSONALIZED LEARNER CONTEXT\n"
        "═══════════════════════════════════════════\n"
        "\n"
        "Use this to tailor your response:\n"
        "  • For WEAK AREAS: be patient, use simple examples, "
        "connect to what they already know\n"
        "  • For STRONG AREAS: skip the basics, go straight to depth\n"
        "  • Match their preferred learning style and language\n"
        "  • If a topic is in WEAK AREAS and is relevant to the question, "
        "address the underlying confusion first\n"
        "\n"
        "WHEN THE STUDENT ASKS 'what should I focus on' or 'what am I weak at':\n"
        "  → Reply CONCISELY. List 2-4 weak concepts with their scores.\n"
        "  → Recommend the ONE that is the foundation for the others.\n"
        "  → Mention 1-2 strong areas they can skip.\n"
        "  → Keep it under 150 words. No long study plan unless asked.\n"
        "\n"
    )

    body = "\n\n".join(sections)

    footer = (
        "\n\n"
        "═══════════════════════════════════════════\n"
        "CRITICAL RULES FOR THIS CONTEXT\n"
        "═══════════════════════════════════════════\n"
        "1. You ALREADY HAVE the student's performance data above.\n"
        "2. NEVER ask the student for scores, grades, or weak areas — "
        "they are already provided.\n"
        "3. NEVER say 'I need more information' if the answer is above.\n"
        "4. When asked 'what should I focus on' or 'what am I weak at':\n"
        "     → Answer DIRECTLY from the WEAK AREAS section.\n"
        "     → List 2-4 concepts with their exact scores.\n"
        "     → Recommend the ONE that unlocks the others.\n"
        "     → Mention 1-2 strong areas they can skip.\n"
        "     → Keep it under 150 words. No study plan unless asked.\n"
        "5. Do NOT mention this context block exists. Just use it.\n"
        "═══════════════════════════════════════════"
    )

    return header + body + footer


def get_learner_summary(db, student_id: int) -> dict:
    """
    Optional helper for future features (dashboard cards, onboarding, etc.).
    Returns a small dict — no prompt formatting.
    """
    if not student_id:
        return {}

    weak_count = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score < 50,
        )
        .count()
    )
    strong_count = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score >= 75,
        )
        .count()
    )

    return {
        "student_id": student_id,
        "weak_concepts": weak_count,
        "strong_concepts": strong_count,
    }