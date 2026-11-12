"""
Language helpers — maps ISO codes to names and builds the prompt instruction.
"""

LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "it": "Italian",
    "ja": "Japanese",
    "ko": "Korean",
    "zh": "Chinese (Simplified)",
    "ar": "Arabic",
    "ru": "Russian",
}


def get_language_name(code: str) -> str:
    """Return full language name from ISO code. Defaults to English."""
    if not code:
        return "English"
    return LANGUAGES.get(code.lower(), "English")


def language_instruction(code: str) -> str:
    """
    Return a prompt instruction telling the LLM to respond in the language.
    Returns empty string for English (no instruction needed).
    """
    if not code or code.lower() == "en":
        return ""

    name = get_language_name(code)
    return (
        f"\n\n═══════════════════════════════════════════════\n"
        f"LANGUAGE INSTRUCTION\n"
        f"═══════════════════════════════════════════════\n"
        f"Write the ENTIRE response in {name}.\n"
        f"- All prose, explanations, examples, and bullet points MUST be in {name}.\n"
        f"- Keep universally-known technical terms (e.g., 'Machine Learning', "
        f"'gradient descent', 'neural network') in English, but you may add the "
        f"{name} translation in parentheses if it helps understanding.\n"
        f"- Do NOT translate JSON keys, only the string values.\n"
        f"- Code snippets stay in their original language (Python, etc.) with "
        f"English identifiers.\n"
    )


def get_student_language(student_id: int, db) -> str:
    """
    Look up a student's preferred language. Falls back to 'en'.
    """
    import models
    try:
        student = db.query(models.Student).filter(models.Student.id == student_id).first()
        if student and student.preferred_language:
            return student.preferred_language
    except Exception:
        pass
    return "en"


def get_topic_owner_language(topic_id: int, db) -> str:
    """
    Look up the language preference of the student who owns a topic.
    Chain: Topic → Subject → Student.
    """
    import models
    try:
        topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
        if not topic:
            return "en"
        subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
        if not subject:
            return "en"
        student = db.query(models.Student).filter(models.Student.id == subject.student_id).first()
        if student and student.preferred_language:
            return student.preferred_language
    except Exception:
        pass
    return "en"


def get_concept_owner_language(concept_id: int, db) -> str:
    """
    Look up the language of the student who owns a concept.
    Chain: Concept → Topic → Subject → Student.
    """
    import models
    try:
        concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
        if not concept:
            return "en"
        return get_topic_owner_language(concept.topic_id, db)
    except Exception:
        return "en"