import json
from sqlalchemy.orm import Session
import models
from services.llm_router import generate_completion

ROADMAP_SYSTEM_PROMPT = """You are an expert curriculum designer and AI mentor.
Your task is to analyze a given topic and decide the best learning approach for a student.

CRITICAL: Output ONLY valid JSON. No markdown fences, no prose.

If the topic is a BROAD SUBJECT (e.g., Data Structures, Machine Learning, Web Development), you must generate a full roadmap with prerequisites, core, advanced, and next steps.
If the topic is a FOCUSED CONCEPT (e.g., Overfitting, Gradient Descent, Python List Methods), you should NOT generate a full roadmap. Instead, provide a simple explanation and list related foundational concepts.

JSON Schema:
{
  "topic_type": "broad_subject" | "focused_concept",
  "requires_roadmap": true | false,
  "prerequisites": ["Concept 1", "Concept 2"], 
  "roadmap": {
    "prerequisites": [{"name": "String", "why": "String"}],
    "core": [{"name": "String", "why": "String"}],
    "advanced": [{"name": "String", "why": "String"}],
    "next_steps": [{"name": "String", "why": "String"}]
  },
  "related_fundamentals": ["Concept 1", "Concept 2"]
}

Rules:
- If requires_roadmap is false, the "roadmap" object should be empty {}.
- If requires_roadmap is true, the roadmap object must be populated.
"""

def generate_roadmap_for_topic(topic_id: int, student_id: int, db: Session) -> dict:
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise ValueError("Topic not found")

    # Check cache first
    cached = db.query(models.TopicRoadmap).filter(models.TopicRoadmap.topic_id == topic_id).first()
    if cached:
        return json.loads(cached.roadmap_json)

    # GET STUDENT'S KNOWN CONCEPTS (Adaptation)
    known_concepts = []
    if student_id:
        stats = db.query(models.ConceptStat).filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score >= 75  # They know it if score > 75%
        ).all()
        for s in stats:
            c = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
            if c:
                known_concepts.append(c.name)

    known_str = ", ".join(known_concepts) if known_concepts else "None"
    
    prompt = f"""Analyze the topic: '{topic.name}'
    
    IMPORTANT: The student ALREADY KNOWS these concepts: {known_str}. 
    Do NOT include these in the prerequisites or core roadmap. Skip them entirely."""

    try:
        raw_response = generate_completion(
            "groq-oss-120b", 
            [
                {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1500
        )
        
        raw_response = raw_response.strip()
        if raw_response.startswith("```json"):
            raw_response = raw_response[7:]
        if raw_response.endswith("```"):
            raw_response = raw_response[:-3]
            
        data = json.loads(raw_response)
        
        record = models.TopicRoadmap(
            topic_id=topic_id,
            roadmap_json=json.dumps(data)
        )
        db.add(record)
        db.commit()
        
        return data

    except Exception as e:
        print(f"[roadmap_service] Error generating roadmap: {e}")
        return {
            "topic_type": "focused_concept",
            "requires_roadmap": False,
            "prerequisites": [],
            "roadmap": {},
            "related_fundamentals": []
        }