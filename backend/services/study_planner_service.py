"""
AI Study Planner Service.
Generates a personalized daily schedule based on weak concepts and time limits.
"""

import json
from sqlalchemy.orm import Session, joinedload
import models
from services.llm import call_llm_json

STUDY_PLAN_SYSTEM_PROMPT = """You are an expert AI Study Mentor.
Your task is to generate a personalized daily study schedule for a student based on their weak areas and daily time limit.

CRITICAL: Return ONLY valid JSON. No markdown fences, no prose.

JSON Schema:
{
  "plan": [
    {
      "activity": "Read" | "Practice" | "Quiz",
      "concept_name": "String",
      "topic_id": Integer,
      "duration_minutes": Integer,
      "reason": "String"
    }
  ]
}

Rules:
- The sum of duration_minutes MUST exactly equal the student's daily time limit.
- Prioritize the concepts with the lowest scores.
- Alternate between different activities (e.g., Read then Quiz).
"""

def generate_daily_plan(student_id: int, db: Session) -> dict:
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise ValueError("Student not found")

    time_limit = student.daily_time_minutes or 30
    goal = student.learning_goal or "General Learning"

    # Get weakest concepts
    stats = (
        db.query(models.ConceptStat)
        .options(
            joinedload(models.ConceptStat.concept).joinedload(models.Concept.topic)
        )
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score < 75
        )
        .order_by(models.ConceptStat.score.asc())
        .limit(6)
        .all()
    )

    if not stats:
        return {
            "plan": [],
            "message": "You are doing great! No weak concepts found. Try taking a Smart Test to find new areas to improve."
        }

    concept_list = "\n".join(
        f"- {s.concept.name} (Topic ID: {s.concept.topic.id}, Score: {round(s.score)}%)"
        for s in stats
    )

    prompt = f"""Student Goal: {goal}
Daily Time Limit: {time_limit} minutes

Weak Concepts to study today:
{concept_list}

Generate a study schedule for today. Total time MUST be exactly {time_limit} minutes.
"""

    try:
        result = call_llm_json(
            prompt,
            system=STUDY_PLAN_SYSTEM_PROMPT,
            temperature=0.4,
            max_tokens=1000
        )
        if not result or "plan" not in result or not isinstance(result["plan"], list):
            raise ValueError("LLM returned malformed plan")
        
        # Fix durations to exactly match the time limit (LLMs often round poorly)
        plan = result["plan"]
        if plan:
            current_total = sum(p.get("duration_minutes", 0) for p in plan)
            if current_total != time_limit:
                # Scale the durations
                factor = time_limit / current_total if current_total > 0 else 1
                for p in plan:
                    p["duration_minutes"] = max(5, round(p.get("duration_minutes", 10) * factor))
                
                # Adjust the last item to make the sum exactly time_limit
                new_total = sum(p["duration_minutes"] for p in plan)
                diff = time_limit - new_total
                plan[-1]["duration_minutes"] += diff
                if plan[-1]["duration_minutes"] < 5:
                    plan[-1]["duration_minutes"] = 5

        return {"plan": plan}

    except Exception as e:
        print(f"[study_planner] LLM Error: {e}")
        # Fallback deterministic plan so the UI never breaks
        mid = time_limit // 2
        fallback_plan = [
            {
                "activity": "Read",
                "concept_name": stats[0].concept.name,
                "topic_id": stats[0].concept.topic.id,
                "duration_minutes": mid,
                "reason": "Lowest score, needs review"
            }
        ]
        if len(stats) > 1:
            fallback_plan.append({
                "activity": "Quiz",
                "concept_name": stats[1].concept.name,
                "topic_id": stats[1].concept.topic.id,
                "duration_minutes": time_limit - mid,
                "reason": "Needs active recall practice"
            })
        else:
            fallback_plan[0]["duration_minutes"] = time_limit
            
        return {"plan": fallback_plan}