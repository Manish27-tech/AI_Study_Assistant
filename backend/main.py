from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from pydantic import BaseModel
from datetime import date as date_cls, timedelta, datetime
from typing import Optional, Dict
from collections import defaultdict
import json
import re as _re

from database import engine, Base, SessionLocal
import models
import schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Study Assistant")

# ==================================================
# CORS
# ==================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://*.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================================
# DB Dependency
# ==================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==================================================
# ROOT
# ==================================================
@app.get("/")
def home():
    return {"message": "AI Study Assistant Backend is Running!"}

# ==================================================
# AUTH
# ==================================================
class LoginRequest(BaseModel):
    email: str
    name: Optional[str] = None
    course: Optional[str] = None

@app.post("/auth/login")
def login_or_register(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    student = db.query(models.Student).filter(models.Student.email == email).first()

    created = False
    if not student:
        name = (payload.name or email.split("@")[0]).strip()
        course = (payload.course or "General").strip()
        student = models.Student(name=name, email=email, course=course)
        db.add(student)
        db.commit()
        db.refresh(student)
        created = True

    return {
        "student_id": student.id,
        "name": student.name,
        "email": student.email,
        "course": student.course,
        "bio": student.bio or "",
        "interests": student.interests or "",
        "avatar_url": student.avatar_url or "",
        "preferred_learning_style": student.preferred_learning_style or "",
        "education_level": student.education_level or "",
        "location": student.location or "",
        "website": student.website or "",
        "github": student.github or "",
        "linkedin": student.linkedin or "",
        "preferred_language": student.preferred_language or "en",
        "onboarding_completed": bool(student.onboarding_completed),
        "learning_goal": student.learning_goal or "",
        "daily_time_minutes": student.daily_time_minutes or 30,
        "current_level": student.current_level or "",
        "created": created,
    }

# ==================================================
# STUDENTS
# ==================================================
@app.post("/students", response_model=schemas.StudentResponse)
def create_student(student: schemas.StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Student).filter(models.Student.email == student.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_student = models.Student(**student.dict())
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

@app.get("/students", response_model=list[schemas.StudentResponse])
def get_all_students(db: Session = Depends(get_db)):
    return db.query(models.Student).all()

@app.get("/students/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "course": student.course,
        "bio": student.bio or "",
        "interests": student.interests or "",
        "avatar_url": student.avatar_url or "",
        "preferred_learning_style": student.preferred_learning_style or "",
        "education_level": student.education_level or "",
        "location": student.location or "",
        "website": student.website or "",
        "github": student.github or "",
        "linkedin": student.linkedin or "",
        "preferred_language": student.preferred_language or "en",
    }

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    course: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[str] = None
    avatar_url: Optional[str] = None
    preferred_learning_style: Optional[str] = None
    education_level: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    github: Optional[str] = None
    linkedin: Optional[str] = None
    preferred_language: Optional[str] = None

@app.put("/students/{student_id}")
def update_student(student_id: int, updates: StudentUpdate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if updates.email and updates.email != student.email:
        existing = db.query(models.Student).filter(models.Student.email == updates.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        student.email = updates.email

    for field in [
        "name", "course", "bio", "interests", "avatar_url",
        "preferred_learning_style", "education_level",
        "location", "website", "github", "linkedin",
        "preferred_language",
    ]:
        value = getattr(updates, field, None)
        if value is not None:
            setattr(student, field, value)

    db.commit()
    db.refresh(student)

    return {
        "id": student.id,
        "name": student.name,
        "email": student.email,
        "course": student.course,
        "bio": student.bio or "",
        "interests": student.interests or "",
        "avatar_url": student.avatar_url or "",
        "preferred_learning_style": student.preferred_learning_style or "",
        "education_level": student.education_level or "",
        "location": student.location or "",
        "website": student.website or "",
        "github": student.github or "",
        "linkedin": student.linkedin or "",
        "preferred_language": student.preferred_language or "en",
    }

@app.delete("/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    for subject in subjects:
        db.query(models.Topic).filter(models.Topic.subject_id == subject.id).delete()
    db.query(models.Subject).filter(models.Subject.student_id == student_id).delete()
    db.query(models.Performance).filter(models.Performance.student_id == student_id).delete()
    db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).delete()
    db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).delete()
    db.query(models.QuestionAttempt).filter(models.QuestionAttempt.student_id == student_id).delete()
    db.query(models.ConceptStat).filter(models.ConceptStat.student_id == student_id).delete()
    db.query(models.Recommendation).filter(models.Recommendation.student_id == student_id).delete()
    db.query(models.SearchHistory).filter(models.SearchHistory.student_id == student_id).delete()

    db.delete(student)
    db.commit()
    return {"message": "Student and all related data deleted", "id": student_id}

@app.get("/students/{student_id}/export")
def export_student_data(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    topics = []
    for subject in subjects:
        t = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        topics.extend(t)

    performances = db.query(models.Performance).filter(models.Performance.student_id == student_id).all()
    plans = db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).all()
    quizzes = db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).all()

    return {
        "student": {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "course": student.course,
            "bio": student.bio or "",
            "interests": student.interests or "",
            "location": student.location or "",
            "education_level": student.education_level or "",
            "preferred_language": student.preferred_language or "en",
        },
        "subjects": [{"id": s.id, "name": s.name} for s in subjects],
        "topics": [
            {"id": t.id, "name": t.name, "difficulty": t.difficulty, "subject_id": t.subject_id}
            for t in topics
        ],
        "performances": [
            {"topic_id": p.topic_id, "score": p.score, "attempts": p.attempts}
            for p in performances
        ],
        "study_plans": [
            {
                "topic_id": p.topic_id,
                "date": p.date,
                "duration_minutes": p.duration_minutes,
                "completed": p.completed,
            }
            for p in plans
        ],
        "quiz_results": [
            {
                "topic_id": q.topic_id,
                "score": q.score,
                "total_questions": q.total_questions,
                "date": q.date,
            }
            for q in quizzes
        ],
        "exported_at": str(date_cls.today()),
    }

@app.get("/students/{student_id}/profile-stats")
def get_profile_stats(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    concepts_tested = (
        db.query(models.ConceptStat)
        .filter(models.ConceptStat.student_id == student_id)
        .count()
    )

    attempts = (
        db.query(models.QuestionAttempt.session_id)
        .filter(models.QuestionAttempt.student_id == student_id)
        .all()
    )
    tests_taken = len({a[0] for a in attempts if a[0]})

    topics_explored = (
        db.query(models.Topic)
        .join(models.Subject, models.Topic.subject_id == models.Subject.id)
        .filter(models.Subject.student_id == student_id)
        .count()
    )

    joined_at = (
        db.query(models.QuestionAttempt.attempted_at)
        .filter(models.QuestionAttempt.student_id == student_id)
        .order_by(models.QuestionAttempt.attempted_at.asc())
        .first()
    )

    return {
        "concepts_tested": concepts_tested,
        "tests_taken": tests_taken,
        "topics_explored": topics_explored,
        "member_since": joined_at[0].isoformat() if joined_at and joined_at[0] else None,
    }

# ==================================================
# SUBJECTS
# ==================================================
@app.post("/subjects", response_model=schemas.SubjectResponse)
def create_subject(subject: schemas.SubjectCreate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == subject.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    new_subject = models.Subject(**subject.dict())
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject

@app.get("/subjects", response_model=list[schemas.SubjectResponse])
def get_all_subjects(db: Session = Depends(get_db)):
    return db.query(models.Subject).all()

@app.get("/students/{student_id}/subjects", response_model=list[schemas.SubjectResponse])
def get_student_subjects(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.Subject).filter(models.Subject.student_id == student_id).all()

@app.delete("/subjects/{subject_id}")
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(subject)
    db.commit()
    return {"message": "Subject deleted", "id": subject_id}

# ==================================================
# TOPICS
# ==================================================
@app.post("/topics", response_model=schemas.TopicResponse)
def create_topic(topic: schemas.TopicCreate, db: Session = Depends(get_db)):
    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    new_topic = models.Topic(**topic.dict())
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic

@app.get("/topics", response_model=list[schemas.TopicResponse])
def get_all_topics(db: Session = Depends(get_db)):
    return db.query(models.Topic).all()

@app.get("/subjects/{subject_id}/topics", response_model=list[schemas.TopicResponse])
def get_subject_topics(subject_id: int, db: Session = Depends(get_db)):
    return db.query(models.Topic).filter(models.Topic.subject_id == subject_id).all()

@app.delete("/topics/{topic_id}")
def delete_topic(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    return {"message": "Topic deleted", "id": topic_id}

@app.get("/students/{student_id}/topics/enriched")
def get_enriched_topics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    results = (
        db.query(models.Topic, models.Subject, models.Performance)
        .join(models.Subject, models.Topic.subject_id == models.Subject.id)
        .outerjoin(
            models.Performance,
            and_(
                models.Performance.topic_id == models.Topic.id,
                models.Performance.student_id == student_id,
            ),
        )
        .filter(models.Subject.student_id == student_id)
        .all()
    )

    result = []
    for topic, subject, perf in results:
        result.append({
            "id": topic.id,
            "name": topic.name,
            "difficulty": topic.difficulty,
            "subject_id": subject.id,
            "subject_name": subject.name,
            "score": perf.score if perf else 0.0,
            "attempts": perf.attempts if perf else 0,
        })
    return result

# ==================================================
# PERFORMANCE
# ==================================================
@app.post("/performance", response_model=schemas.PerformanceResponse)
def create_performance(perf: schemas.PerformanceCreate, db: Session = Depends(get_db)):
    new_perf = models.Performance(**perf.dict())
    db.add(new_perf)
    db.commit()
    db.refresh(new_perf)
    return new_perf

@app.get("/students/{student_id}/performance", response_model=list[schemas.PerformanceResponse])
def get_student_performance(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.Performance).filter(models.Performance.student_id == student_id).all()

@app.put("/performance/{performance_id}", response_model=schemas.PerformanceResponse)
def update_performance(performance_id: int, score: float, attempts: int = 1, db: Session = Depends(get_db)):
    perf = db.query(models.Performance).filter(models.Performance.id == performance_id).first()
    if not perf:
        raise HTTPException(status_code=404, detail="Performance record not found")
    perf.score = score
    perf.attempts = attempts
    db.commit()
    db.refresh(perf)
    return perf

# ==================================================
# STUDY PLAN (legacy)
# ==================================================
@app.post("/study-plan", response_model=schemas.StudyPlanResponse)
def create_study_plan(plan: schemas.StudyPlanCreate, db: Session = Depends(get_db)):
    new_plan = models.StudyPlan(**plan.dict())
    db.add(new_plan)
    db.commit()
    db.refresh(new_plan)
    return new_plan

@app.get("/students/{student_id}/study-plan", response_model=list[schemas.StudyPlanResponse])
def get_student_study_plan(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.StudyPlan).filter(models.StudyPlan.student_id == student_id).all()

@app.put("/study-plan/{plan_id}/complete", response_model=schemas.StudyPlanResponse)
def complete_study_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(models.StudyPlan).filter(models.StudyPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Study plan not found")
    plan.completed = True
    db.commit()
    db.refresh(plan)
    return plan

# ==================================================
# AI DAILY STUDY PLANNER
# ==================================================
from services.study_planner_service import generate_daily_plan

@app.get("/students/{student_id}/study-plan/daily")
def get_daily_study_plan(student_id: int, db: Session = Depends(get_db)):
    try:
        result = generate_daily_plan(student_id, db)
        return {
            "student_id": student_id, 
            "plan": result.get("plan", []), 
            "message": result.get("message", "")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================================================
# LEGACY QUIZ
# ==================================================
@app.post("/quiz/questions", response_model=schemas.QuizQuestionResponse)
def create_quiz_question(q: schemas.QuizQuestionCreate, db: Session = Depends(get_db)):
    new_q = models.QuizQuestion(**q.dict())
    db.add(new_q)
    db.commit()
    db.refresh(new_q)
    return new_q

@app.get("/topics/{topic_id}/questions", response_model=list[schemas.QuizQuestionResponse])
def get_topic_questions(topic_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizQuestion).filter(models.QuizQuestion.topic_id == topic_id).all()

class QuizQuestionBulk(BaseModel):
    questions: list[schemas.QuizQuestionCreate]

@app.post("/quiz/questions/bulk")
def bulk_create_questions(payload: QuizQuestionBulk, db: Session = Depends(get_db)):
    created = []
    for q in payload.questions:
        new_q = models.QuizQuestion(**q.dict())
        db.add(new_q)
        created.append(new_q)
    db.commit()
    for q in created:
        db.refresh(q)
    return {"created": len(created), "question_ids": [q.id for q in created]}

@app.post("/quiz/results", response_model=schemas.QuizResultResponse)
def create_quiz_result(r: schemas.QuizResultCreate, db: Session = Depends(get_db)):
    new_r = models.QuizResult(**r.dict())
    db.add(new_r)
    db.commit()
    db.refresh(new_r)
    return new_r

@app.get("/students/{student_id}/quiz-results", response_model=list[schemas.QuizResultResponse])
def get_student_quiz_results(student_id: int, db: Session = Depends(get_db)):
    return db.query(models.QuizResult).filter(models.QuizResult.student_id == student_id).all()

# ==================================================
# DASHBOARD ANALYTICS (OPTIMIZED)
# ==================================================
@app.get("/analytics/dashboard/{student_id}")
def dashboard_analytics(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    total_subjects = len(subjects)

    stats = db.query(models.ConceptStat).filter(models.ConceptStat.student_id == student_id).all()
    concepts_tested = len(stats)
    avg_score = round(sum(s.score for s in stats) / concepts_tested, 1) if concepts_tested else 0.0
    strong_concepts = sum(1 for s in stats if s.score >= 75)
    weak_concepts = sum(1 for s in stats if s.score < 50)

    subject_ids = [s.id for s in subjects]
    if subject_ids:
        total_concepts = (
            db.query(models.Concept)
            .join(models.Topic, models.Concept.topic_id == models.Topic.id)
            .filter(models.Topic.subject_id.in_(subject_ids))
            .count()
        )
    else:
        total_concepts = 0

    perf_query = (
        db.query(
            models.Subject.name.label("subject_name"),
            models.ConceptStat.score.label("score")
        )
        .join(models.Topic, models.Subject.id == models.Topic.subject_id)
        .join(models.Concept, models.Topic.id == models.Concept.topic_id)
        .join(models.ConceptStat, and_(
            models.Concept.id == models.ConceptStat.concept_id,
            models.ConceptStat.student_id == student_id
        ))
        .filter(models.Subject.student_id == student_id)
        .all()
    )
    
    subj_scores = defaultdict(list)
    for row in perf_query:
        subj_scores[row.subject_name].append(row.score)

    topic_counts_query = (
        db.query(models.Subject.name, func.count(models.Topic.id).label("count"))
        .join(models.Topic, models.Subject.id == models.Topic.subject_id)
        .filter(models.Subject.student_id == student_id)
        .group_by(models.Subject.name)
        .all()
    )
    topic_counts = {row.name: row.count for row in topic_counts_query}

    subject_performance = []
    for subject in subjects:
        scores = subj_scores.get(subject.name, [])
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        t_count = topic_counts.get(subject.name, 0)
        subject_performance.append({
            "subject_name": subject.name,
            "avg_score": avg,
            "topics_count": t_count,
        })

    attempts = db.query(models.QuestionAttempt).filter(models.QuestionAttempt.student_id == student_id).all()
    session_ids = {a.session_id for a in attempts if a.session_id}
    test_sessions = len(session_ids)

    attempt_dates = sorted({a.attempted_at.date() for a in attempts if a.attempted_at}, reverse=True)
    streak = 0
    if attempt_dates:
        today = date_cls.today()
        if attempt_dates[0] >= today - timedelta(days=1):
            cursor = attempt_dates[0]
            for d in attempt_dates:
                if d == cursor:
                    streak += 1
                    cursor = cursor - timedelta(days=1)
                elif d < cursor:
                    break

    top_rec = None
    try:
        from services.recommendation_service import get_pending_recommendations
        pending = get_pending_recommendations(student_id, db)
        top_rec = pending[0] if pending else None
    except Exception:
        pass

    ai_recommendation = (
        f"Focus on {top_rec['topic_name']} in {top_rec['subject_name']} today. {top_rec['reason']}"
        if top_rec else "Search for a topic to get started."
    )

    return {
        "student_id": student_id,
        "student_name": student.name,
        "concepts_tested": concepts_tested,
        "total_concepts": total_concepts,
        "avg_score": avg_score,
        "strong_concepts": strong_concepts,
        "weak_concepts": weak_concepts,
        "test_sessions": test_sessions,
        "streak_days": streak,
        "total_subjects": total_subjects,
        "subject_performance": subject_performance,
        "ai_recommendation": ai_recommendation,
    }

# ==================================================
# ANALYTICS TIMELINE
# ==================================================
@app.get("/analytics/timeline/{student_id}")
def analytics_timeline(student_id: int, days: int = 30, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    today = date_cls.today()
    start_date = today - timedelta(days=days - 1)

    attempts = (
        db.query(models.QuestionAttempt)
        .filter(
            models.QuestionAttempt.student_id == student_id,
            models.QuestionAttempt.attempted_at >= start_date,
        )
        .all()
    )

    daily_map = {}
    for a in attempts:
        if not a.attempted_at:
            continue
        day = a.attempted_at.date()
        key = str(day)
        if key not in daily_map:
            daily_map[key] = {"correct": 0, "total": 0, "sessions": set()}
        daily_map[key]["total"] += 1
        if a.is_correct:
            daily_map[key]["correct"] += 1
        if a.session_id:
            daily_map[key]["sessions"].add(a.session_id)

    daily_scores = []
    for i in range(days):
        d = start_date + timedelta(days=i)
        key = str(d)
        entry = daily_map.get(key)
        if entry and entry["total"] > 0:
            score = round((entry["correct"] / entry["total"]) * 100, 1)
        else:
            score = 0
        daily_scores.append({
            "date": key,
            "label": d.strftime("%b %d"),
            "score": score,
            "questions": entry["total"] if entry else 0,
            "tests": len(entry["sessions"]) if entry else 0,
        })

    stats = db.query(models.ConceptStat).filter(
        models.ConceptStat.student_id == student_id
    ).all()

    weekly_concepts = {}
    for s in stats:
        if not s.last_updated:
            continue
        week_start = s.last_updated.date() - timedelta(days=s.last_updated.date().weekday())
        key = str(week_start)
        weekly_concepts[key] = weekly_concepts.get(key, 0) + 1

    concepts_progress = []
    for i in range(5, -1, -1):
        week_start = today - timedelta(days=today.weekday() + 7 * i)
        key = str(week_start)
        concepts_progress.append({
            "week": key,
            "label": week_start.strftime("%b %d"),
            "concepts": weekly_concepts.get(key, 0),
        })

    subjects = db.query(models.Subject).filter(
        models.Subject.student_id == student_id
    ).all()

    topic_breakdown = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(
            models.Topic.subject_id == subject.id
        ).all()

        concept_scores = []
        for topic in topics:
            concepts = db.query(models.Concept).filter(
                models.Concept.topic_id == topic.id
            ).all()
            for c in concepts:
                stat = db.query(models.ConceptStat).filter(
                    models.ConceptStat.student_id == student_id,
                    models.ConceptStat.concept_id == c.id,
                ).first()
                if stat:
                    concept_scores.append(stat.score)

        avg = (
            round(sum(concept_scores) / len(concept_scores), 1)
            if concept_scores
            else 0
        )
        topic_breakdown.append({
            "subject_name": subject.name,
            "avg_score": avg,
            "concepts_count": len(concept_scores),
        })

    topic_breakdown.sort(key=lambda x: x["avg_score"], reverse=True)

    total_questions = sum(d["questions"] for d in daily_scores)
    total_tests = sum(d["tests"] for d in daily_scores)
    active_days = sum(1 for d in daily_scores if d["questions"] > 0)
    avg_score = (
        round(
            sum(d["score"] * d["questions"] for d in daily_scores) / total_questions,
            1,
        )
        if total_questions
        else 0
    )

    best_day = max(daily_scores, key=lambda d: d["score"]) if daily_scores else None
    best_day = best_day if best_day and best_day["score"] > 0 else None

    return {
        "student_id": student_id,
        "student_name": student.name,
        "period_days": days,
        "headline": {
            "total_questions": total_questions,
            "total_tests": total_tests,
            "active_days": active_days,
            "avg_score": avg_score,
            "best_day": best_day,
        },
        "daily_scores": daily_scores,
        "concepts_progress": concepts_progress,
        "topic_breakdown": topic_breakdown,
    }

# ==================================================
# ML RISK PREDICTION
# ==================================================
from ml_predictor import predict_risk

@app.get("/ml/predict/{student_id}")
def ml_predict(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    subjects = db.query(models.Subject).filter(models.Subject.student_id == student_id).all()
    predictions = []
    for subject in subjects:
        topics = db.query(models.Topic).filter(models.Topic.subject_id == subject.id).all()
        for topic in topics:
            perf = db.query(models.Performance).filter(
                models.Performance.student_id == student_id,
                models.Performance.topic_id == topic.id,
            ).first()

            score = perf.score if perf else 0.0
            attempts = perf.attempts if perf else 0
            risk = predict_risk(score, attempts, topic.difficulty)

            predictions.append({
                "topic_id": topic.id,
                "topic_name": topic.name,
                "subject_name": subject.name,
                "difficulty": topic.difficulty,
                "score": score,
                "attempts": attempts,
                "at_risk": risk["at_risk"],
                "risk_probability": risk["probability"],
                "confidence": risk["confidence"],
            })

    predictions.sort(key=lambda x: x["risk_probability"], reverse=True)
    at_risk_count = sum(1 for p in predictions if p["at_risk"])

    return {
        "student_id": student_id,
        "student_name": student.name,
        "total_topics": len(predictions),
        "at_risk_topics": at_risk_count,
        "predictions": predictions,
    }

# ==================================================
# AI TUTOR (legacy)
# ==================================================
from ai_tutor import ask_tutor, filter_weak_concepts, get_client
from services.language_service import get_student_language

class AIAskRequest(BaseModel):
    student_id: int
    question: str
    history: list[dict] = []

@app.post("/ai/ask")
def ai_ask(req: AIAskRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == req.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    stats = (
        db.query(models.ConceptStat)
        .filter(models.ConceptStat.student_id == req.student_id)
        .all()
    )

    weak = []
    for s in stats:
        concept = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue
        subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()

        weak.append({
            "concept_name": concept.name,
            "topic_name": topic.name,
            "subject_name": subject.name if subject else "General",
            "score": s.score,
            "trend": s.trend,
            "attempts": s.attempts,
        })

    weak = filter_weak_concepts(weak, max_n=3)
    language = get_student_language(req.student_id, db)

    try:
        result = ask_tutor(
            req.question, weak, history=req.history, language=language
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Tutor error: {str(e)}")

    return {
        "student_id": req.student_id,
        "question": req.question,
        "answer": result["answer"],
        "sources": result.get("sources", []),
        "context_concepts": [w["concept_name"] for w in weak],
    }

# ==================================================
# PHASE B — TOPIC SEARCH, CONTENT & CONCEPTS
# ==================================================
from services.content_service import (
    get_or_create_content,
    get_or_create_full,
    invalidate_content,
)
from services.concept_service import get_or_create_concepts

class TopicSearchRequest(BaseModel):
    topic_name: str
    student_id: int
    difficulty: str = "medium"

@app.post("/topics/search-or-create")
def search_or_create_topic(payload: TopicSearchRequest, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    name = payload.topic_name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Topic name cannot be empty")

    SUFFIXES = [
        " full course", " complete guide", " tutorial",
        " course", " guide", " notes",
    ]
    stripped = True
    while stripped and name:
        stripped = False
        lower = name.lower()
        for suffix in SUFFIXES:
            if lower.endswith(suffix):
                name = name[: -len(suffix)].strip()
                stripped = True
                break

    if not name:
        raise HTTPException(status_code=400, detail="Topic name cannot be empty")

    explored = (
        db.query(models.Subject)
        .filter(
            models.Subject.student_id == payload.student_id,
            models.Subject.name == "Explored Topics",
        )
        .first()
    )
    if not explored:
        explored = models.Subject(name="Explored Topics", student_id=payload.student_id)
        db.add(explored)
        db.commit()
        db.refresh(explored)

    existing = (
        db.query(models.Topic)
        .filter(models.Topic.subject_id == explored.id, models.Topic.name.ilike(name))
        .first()
    )

    if existing:
        topic = existing
        created = False
    else:
        topic = models.Topic(name=name, difficulty=payload.difficulty, subject_id=explored.id)
        db.add(topic)
        db.commit()
        db.refresh(topic)
        created = True

    try:
        db.query(models.SearchHistory).filter(
            models.SearchHistory.student_id == payload.student_id,
            models.SearchHistory.topic_id == topic.id,
        ).delete()

        history_entry = models.SearchHistory(
            student_id=payload.student_id,
            topic_id=topic.id,
            query=name,
        )
        db.add(history_entry)
        db.commit()
    except Exception as e:
        print(f"[search-or-create] History save failed: {e}")
        db.rollback()

    return {
        "topic_id": topic.id,
        "topic_name": topic.name,
        "subject_id": explored.id,
        "subject_name": explored.name,
        "difficulty": topic.difficulty,
        "created": created,
    }

@app.post("/topics/{topic_id}/generate-content")
def generate_topic_content(topic_id: int, force: bool = False, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    try:
        if force:
            invalidate_content(topic_id, db)
        content = get_or_create_content(topic_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Content generation failed: {e}")
    return {"topic_id": topic_id, "topic_name": topic.name, "content": content}

@app.get("/topics/{topic_id}/content")
def get_topic_content(topic_id: int, db: Session = Depends(get_db)):
    record = db.query(models.LearningContent).filter(models.LearningContent.topic_id == topic_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Content not generated yet")
    return {"topic_id": topic_id, "content": json.loads(record.content_json)}

@app.post("/topics/{topic_id}/extract-concepts")
def extract_topic_concepts(topic_id: int, force: bool = False, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    try:
        concepts = get_or_create_concepts(topic_id, db, force=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Concept extraction failed: {e}")
    return {
        "topic_id": topic_id,
        "topic_name": topic.name,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }

@app.get("/topics/{topic_id}/concepts")
def list_topic_concepts(topic_id: int, db: Session = Depends(get_db)):
    concepts = (
        db.query(models.Concept)
        .filter(models.Concept.topic_id == topic_id)
        .order_by(models.Concept.order_index)
        .all()
    )
    return {
        "topic_id": topic_id,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }

@app.get("/topics/{topic_id}/full")
def get_topic_full(topic_id: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()

    try:
        content, concepts = get_or_create_full(topic_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    return {
        "topic": {
            "id": topic.id,
            "name": topic.name,
            "difficulty": topic.difficulty,
            "subject_id": topic.subject_id,
            "subject_name": subject.name if subject else "General",
        },
        "content": content,
        "concepts": [
            {"id": c.id, "name": c.name, "description": c.description, "importance": c.importance, "order_index": c.order_index}
            for c in concepts
        ],
    }

# ==================================================
# CONCEPT DEEP-DIVE
# ==================================================
from services.concept_content_service import (
    get_or_create_concept_content,
    invalidate_concept_content,
)

@app.post("/concepts/{concept_id}/content")
def get_concept_content_endpoint(
    concept_id: int, force: bool = False, db: Session = Depends(get_db)
):
    concept = db.query(models.Concept).filter(models.Concept.id == concept_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    try:
        if force:
            invalidate_concept_content(concept_id, db)
        content = get_or_create_concept_content(concept_id, db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Concept generation failed: {e}")

    topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()

    return {
        "concept_id": concept_id,
        "concept_name": concept.name,
        "topic_name": topic.name if topic else "—",
        "content": content,
    }

# ==================================================
# PHASE C — CONCEPT-AWARE TESTING (ADAPTIVE)
# ==================================================
from services.question_service import generate_test, generate_smart_test, submit_test

class TestGenerateRequest(BaseModel):
    topic_id: int
    num_questions: int = 8
    student_id: Optional[int] = None
    force: bool = False

class SmartTestRequest(BaseModel):
    student_id: int
    num_questions: int = 6

class TestSubmitRequest(BaseModel):
    student_id: int
    answers: Dict[str, Optional[str]]
    session_id: Optional[str] = None

@app.post("/tests/generate")
def generate_test_endpoint(payload: TestGenerateRequest, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.id == payload.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    num = max(3, min(payload.num_questions, 15))
    try:
        result = generate_test(
            payload.topic_id, db, num, student_id=payload.student_id, force=payload.force
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test generation failed: {e}")
    return result

@app.post("/tests/generate-smart")
def generate_smart_test_endpoint(payload: SmartTestRequest, db: Session = Depends(get_db)):
    try:
        result = generate_smart_test(payload.student_id, db, payload.num_questions)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Smart test generation failed: {e}")
    return result

@app.post("/tests/submit")
def submit_test_endpoint(payload: TestSubmitRequest, db: Session = Depends(get_db)):
    try:
        result = submit_test(
            student_id=payload.student_id,
            answers=payload.answers,
            db=db,
            session_id=payload.session_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test submission failed: {e}")
    return result

@app.get("/students/{student_id}/concepts")
def get_student_concepts(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

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

    by_topic = defaultdict(list)

    for s in stats:
        concept = s.concept
        if not concept or not concept.topic:
            continue
        topic = concept.topic

        try:
            risk = predict_risk(
                score=s.score,
                attempts=s.attempts,
                difficulty=topic.difficulty or "medium",
            )
            at_risk = risk["at_risk"]
            risk_prob = risk["probability"]
            risk_conf = risk["confidence"]
        except Exception:
            at_risk = s.score < 50
            risk_prob = 0.5
            risk_conf = "low"

        by_topic[topic.id].append({
            "concept_id": s.concept_id,
            "concept_name": concept.name,
            "description": concept.description,
            "importance": concept.importance,
            "score": s.score,
            "attempts": s.attempts,
            "correct": s.correct,
            "confidence": s.confidence,
            "trend": s.trend,
            "at_risk": at_risk,
            "risk_probability": risk_prob,
            "risk_confidence": risk_conf,
        })

    topics_data = []
    for tid, concept_list in by_topic.items():
        topic_obj = next((s.concept.topic for s in stats if s.concept.topic_id == tid), None)
        
        if topic_obj:
            topics_data.append({
                "topic_id": tid,
                "topic_name": topic_obj.name,
                "subject_name": topic_obj.subject.name if topic_obj.subject else "General",
                "concepts": concept_list,
            })

    return {"student_id": student_id, "topics": topics_data}

# ==================================================
# PHASE D — RECOMMENDATION ENGINE
# ==================================================
from services.recommendation_service import (
    generate_recommendations,
    get_pending_recommendations,
    mark_completed,
)

@app.post("/students/{student_id}/generate-recommendations")
def generate_recs(student_id: int, force: bool = False, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    try:
        recs = generate_recommendations(student_id, db, force=force)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")
    return {
        "student_id": student_id,
        "student_name": student.name,
        "total": len(recs),
        "recommendations": recs,
    }

@app.get("/students/{student_id}/recommendations")
def list_recs(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    recs = get_pending_recommendations(student_id, db)
    total_minutes = sum(r["suggested_minutes"] for r in recs)
    return {
        "student_id": student_id,
        "student_name": student.name,
        "total": len(recs),
        "total_minutes": total_minutes,
        "recommendations": recs,
    }

@app.put("/recommendations/{rec_id}/complete")
def complete_rec(rec_id: int, student_id: int, db: Session = Depends(get_db)):
    try:
        rec = mark_completed(rec_id, student_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"message": "Marked as complete", "id": rec.id, "status": rec.status}

# ==================================================
# SEARCH HISTORY
# ==================================================
@app.get("/students/{student_id}/search-history")
def get_search_history(student_id: int, limit: int = 20, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    rows = (
        db.query(models.SearchHistory, models.Topic, models.Subject)
        .outerjoin(models.Topic, models.SearchHistory.topic_id == models.Topic.id)
        .outerjoin(models.Subject, models.Topic.subject_id == models.Subject.id)
        .filter(models.SearchHistory.student_id == student_id)
        .order_by(models.SearchHistory.searched_at.desc())
        .limit(max(1, min(limit, 50)))
        .all()
    )

    result = []
    for row, topic, subject in rows:
        result.append({
            "id": row.id,
            "topic_id": row.topic_id,
            "topic_name": topic.name if topic else row.query,
            "subject_name": subject.name if subject else "Explored Topics",
            "searched_at": row.searched_at.isoformat() if row.searched_at else None,
        })

    return {"student_id": student_id, "total": len(result), "history": result}

@app.delete("/search-history/{entry_id}")
def delete_search_history_entry(entry_id: int, student_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(models.SearchHistory)
        .filter(
            models.SearchHistory.id == entry_id,
            models.SearchHistory.student_id == student_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="History entry not found")
    db.delete(row)
    db.commit()
    return {"message": "Deleted", "id": entry_id}

@app.delete("/students/{student_id}/search-history")
def clear_search_history(student_id: int, db: Session = Depends(get_db)):
    deleted = (
        db.query(models.SearchHistory)
        .filter(models.SearchHistory.student_id == student_id)
        .delete()
    )
    db.commit()
    return {"message": "History cleared", "deleted": deleted}

# ==================================================
# FILE UPLOAD + LEARN FROM TEXT
# ==================================================
from services.file_service import extract_text

@app.post("/files/extract")
async def extract_file_content(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 10 MB.")
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file.")

    try:
        result = extract_text(contents, file.content_type or "", file.filename or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "source_type": result["source_type"],
        "pages": result["pages"],
        "method": result.get("method", "unknown"),
        "text": result["text"],
        "char_count": len(result["text"]),
    }

LEARN_SYSTEM_PROMPT = """You are a helpful AI Study Tutor.

The user has uploaded a file and given you an instruction.

═══════════════════════════════════════════════
CRITICAL: FOLLOW THE USER'S INSTRUCTION EXACTLY
═══════════════════════════════════════════════

- If the user says "give me applications" → return ONLY the applications.
- If the user says "summarize this" → return ONLY the summary.
- If the user says "explain in simple terms" → return ONLY the simple explanation.
- If the user says "give me 5 practice questions" → return ONLY 5 questions.
- If the user says "write a detailed tutorial" → produce a full structured tutorial.
- If the user says "answer this question" → return ONLY the answer.

NEVER pad the response with sections the user did NOT ask for.
Match the LENGTH of the response to what the instruction implies.

When the user asks for a full tutorial, use this structure:
# <Topic Title>
## What Is It?
## Why Does It Matter?
## Core Concepts / How It Works
## Types / Variants (if applicable)
## Real-World Examples
## Worked Example
## Advantages
## Disadvantages
## Common Mistakes
## Key Takeaways
## Practice / Further Study

FORMATTING RULES (STRICT):
1. NO HTML TAGS AT ALL. No <a name>, <div>, <span>, <br>, <p>.
2. MATH — use ONLY: `inline` or $$display$$ on its own line.
3. Write "AI" correctly — never "Al".
4. TABLES: max 6 rows × 4 columns.
5. No duplicated sections.
6. No HTML entities (&amp;amp;, &quot;, etc.).
"""

def _clean_learn_output(text: str) -> str:
    if not text:
        return text

    s = text
    s = _re.sub(r"<a\s+name=\"[^\"]*\"\s*>\s*</a>", "", s)
    s = _re.sub(r"<a\s+name='[^']*'\s*>\s*</a>", "", s)
    s = _re.sub(r"<[^>]+>", "", s)
    s = _re.sub(r"\\\((.+?)\\\)", r"`\1`", s)
    s = _re.sub(r"\\\[(.+?)\\\]", r"\n$$\1$$\n", s, flags=_re.DOTALL)
    s = s.replace("&amp;amp;", "&")
    s = s.replace("&amp;", "&")
    s = s.replace("&quot;", '"')
    s = s.replace("&#x27;", "'")
    s = s.replace("&#39;", "'")
    s = s.replace("&lt;", "<")
    s = s.replace("&gt;", ">")
    s = s.replace("&nbsp;", " ")
    s = _re.sub(r"\bAl\b", "AI", s)
    s = s.replace("\tAI_System", "AI_System")
    s = s.replace("\tInput Data", "Input Data")
    s = s.replace("\tModel Parameters", "Model Parameters")
    s = _re.sub(r"\n{4,}", "\n\n\n", s)
    return s.strip()

class LearnFromTextRequest(BaseModel):
    text: str
    instruction: str
    student_id: Optional[int] = None

@app.post("/ai/learn-from-text")
def learn_from_text(req: LearnFromTextRequest, db: Session = Depends(get_db)):
    text = (req.text or "").strip()
    instruction = (req.instruction or "").strip()

    if not instruction:
        raise HTTPException(status_code=400, detail="No instruction provided.")
    if not text:
        text = "(The uploaded file contained no readable text. Use the instruction as the topic.)"

    max_chars = 12000
    truncated = False
    if len(text) > max_chars:
        text = text[:max_chars]
        truncated = True

    user_message = (
        f"REFERENCE TEXT FROM UPLOADED FILE:\n\"\"\"\n{text}\n\"\"\"\n\n"
        f"USER'S INSTRUCTION: {instruction}\n\n"
        f"Follow the instruction exactly. Do not add extra sections the user "
        f"did not ask for."
    )

    if req.student_id:
        from services.language_service import language_instruction
        language = get_student_language(req.student_id, db)
        lang_note = language_instruction(language)
        if lang_note:
            user_message += lang_note

    try:
        client = get_client()
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": LEARN_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.6,
            max_tokens=8000,
        )
        raw_answer = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation failed: {e}")

    answer = _clean_learn_output(raw_answer)

    return {
        "instruction": instruction,
        "answer": answer,
        "truncated": truncated,
        "source_chars": len(text),
    }

# ==================================================
# NOTIFICATIONS + STRUGGLES
# ==================================================
@app.get("/notifications/{student_id}")
def get_notifications(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    notifications = []

    stats = (
        db.query(models.ConceptStat)
        .filter(
            models.ConceptStat.student_id == student_id,
            models.ConceptStat.score < 50,
            models.ConceptStat.attempts >= 1,
        )
        .order_by(models.ConceptStat.score.asc())
        .limit(3)
        .all()
    )
    for s in stats:
        concept = db.query(models.Concept).filter(models.Concept.id == s.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue
        notifications.append({
            "id": f"weak_{s.concept_id}",
            "type": "risk",
            "title": f"Weak: {concept.name}",
            "body": f"Score {round(s.score)}% — needs revision",
            "topic_id": topic.id,
            "action": "Review now",
            "priority": 100 - s.score,
        })

    recs = (
        db.query(models.Recommendation)
        .filter(
            models.Recommendation.student_id == student_id,
            models.Recommendation.status == "pending",
            models.Recommendation.priority >= 60,
        )
        .order_by(models.Recommendation.priority.desc())
        .limit(3)
        .all()
    )
    for r in recs:
        concept = db.query(models.Concept).filter(models.Concept.id == r.concept_id).first()
        if not concept:
            continue
        topic = db.query(models.Topic).filter(models.Topic.id == concept.topic_id).first()
        if not topic:
            continue
        notifications.append({
            "id": f"rec_{r.id}",
            "type": "recommendation",
            "title": f"Study: {concept.name}",
            "body": r.reason or "Recommended by your learning engine",
            "topic_id": topic.id,
            "action": "Open content",
            "priority": r.priority,
        })

    attempts = (
        db.query(models.QuestionAttempt.attempted_at)
        .filter(models.QuestionAttempt.student_id == student_id)
        .all()
    )
    dates = sorted({a[0].date() for a in attempts if a[0]}, reverse=True)

    streak = 0
    if dates:
        today = date_cls.today()
        if dates[0] >= today - timedelta(days=1):
            cursor = dates[0]
            for d in dates:
                if d == cursor:
                    streak += 1
                    cursor = cursor - timedelta(days=1)
                else:
                    break

    if streak == 0:
        notifications.append({
            "id": "streak_start",
            "type": "streak",
            "title": "Start your streak",
            "body": "Take a test to begin your daily learning streak.",
            "link": "/quiz",
            "action": "Go to tests",
            "priority": 30,
        })
    elif streak >= 3:
        notifications.append({
            "id": f"streak_{streak}",
            "type": "streak",
            "title": f"🔥 {streak}-day streak!",
            "body": "Keep going — consistency is key.",
            "link": "/quiz",
            "action": "Continue",
            "priority": 40,
        })

    if not notifications:
        notifications.append({
            "id": "welcome",
            "type": "info",
            "title": "Welcome to AI Study Assistant",
            "body": "Search any topic or upload notes to get started.",
            "link": "/search",
            "action": "Search a topic",
            "priority": 10,
        })

    notifications.sort(key=lambda x: -x.get("priority", 0))
    notifications = notifications[:6]

    return {
        "student_id": student_id,
        "total": len(notifications),
        "notifications": notifications,
    }

@app.get("/students/{student_id}/struggles")
def get_student_struggles(student_id: int, db: Session = Depends(get_db)):
    from services.struggle_service import detect_struggles

    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    struggles = detect_struggles(student_id, db)
    return {"student_id": student_id, "struggles": struggles}

# ==================================================
# FLASHCARDS
# ==================================================
FLASHCARD_SYSTEM_PROMPT = (
    "You are an expert educator creating revision flashcards. "
    "You always respond with valid JSON only. No markdown fences, no prose. "
    "CRITICAL: Front is a question that tests recall; back is a concise answer."
)

FLASHCARD_PROMPT_TEMPLATE = """Create {num} flashcards for the topic "{topic}" (subject: "{subject}", difficulty: {difficulty}).

The topic is broken into these concepts:
{concept_list}

FLASHCARD RULES:
Front: Short question testing recall/understanding. 1 sentence ending with "?".
Back: 1-2 sentence answer, direct and clear.
Cover the concepts above roughly evenly.

JSON Schema:
{{
  "cards": [
    {{
      "front": "Question ending with ?",
      "back": "Concise answer.",
      "concept_name": "Exact concept name from the list"
    }}
  ]
}}

Topic: {topic}
"""

class FlashcardGenerateRequest(BaseModel):
    topic_id: int
    num_cards: int = 10
    force: bool = False

def get_student_language_by_topic(topic_id: int, db: Session) -> str:
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

@app.post("/flashcards/generate")
def generate_flashcards_endpoint(
    payload: FlashcardGenerateRequest, db: Session = Depends(get_db)
):
    topic = db.query(models.Topic).filter(models.Topic.id == payload.topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if not payload.force:
        cached = (
            db.query(models.FlashcardSet)
            .filter(models.FlashcardSet.topic_id == payload.topic_id)
            .first()
        )
        if cached:
            try:
                cards = json.loads(cached.cards_json)
                return {
                    "topic_id": topic.id,
                    "topic_name": topic.name,
                    "total": len(cards),
                    "cards": cards,
                    "cached": True,
                }
            except json.JSONDecodeError:
                db.delete(cached)
                db.commit()

    if payload.force:
        existing = (
            db.query(models.FlashcardSet)
            .filter(models.FlashcardSet.topic_id == payload.topic_id)
            .first()
        )
        if existing:
            db.delete(existing)
            db.commit()

    concepts = get_or_create_concepts(payload.topic_id, db)
    if not concepts:
        raise HTTPException(status_code=400, detail="No concepts available for this topic")

    subject = db.query(models.Subject).filter(models.Subject.id == topic.subject_id).first()
    subject_name = subject.name if subject else "General"

    concept_list = "\n".join(
        f"{i + 1}. {c.name} — {c.description}" for i, c in enumerate(concepts)
    )

    prompt = FLASHCARD_PROMPT_TEMPLATE.format(
        num=max(5, min(payload.num_cards, 20)),
        topic=topic.name,
        subject=subject_name,
        difficulty=topic.difficulty or "medium",
        concept_list=concept_list,
    )

    from services.language_service import language_instruction
    language = get_student_language_by_topic(payload.topic_id, db)
    lang_note = language_instruction(language)
    if lang_note:
        prompt = prompt + lang_note

    try:
        from services.llm import call_llm_json, FAST_MODEL, DEFAULT_MODEL
        try:
            result = call_llm_json(
                prompt,
                system=FLASHCARD_SYSTEM_PROMPT,
                temperature=0.6,
                max_tokens=2500,
                model=FAST_MODEL,
            )
        except Exception:
            result = call_llm_json(
                prompt,
                system=FLASHCARD_SYSTEM_PROMPT,
                temperature=0.6,
                max_tokens=2500,
                model=DEFAULT_MODEL,
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {e}")

    if not isinstance(result, dict) or "cards" not in result:
        raise HTTPException(status_code=500, detail="LLM returned malformed flashcards")

    cards = []
    for c in result["cards"]:
        if not isinstance(c, dict):
            continue
        front = (c.get("front") or "").strip()
        back = (c.get("back") or "").strip()
        if not front or not back:
            continue
        cards.append({
            "front": front,
            "back": back,
            "concept_name": (c.get("concept_name") or "").strip(),
        })

    if not cards:
        raise HTTPException(status_code=500, detail="LLM produced no valid flashcards")

    record = models.FlashcardSet(
        topic_id=payload.topic_id,
        cards_json=json.dumps(cards),
        model_version="openai/gpt-oss-20b",
    )
    db.add(record)
    db.commit()

    return {
        "topic_id": topic.id,
        "topic_name": topic.name,
        "total": len(cards),
        "cards": cards,
        "cached": False,
    }

# ==================================================
# NOVAAI CHAT — Models
# ==================================================
from services import chat_service

class ConversationCreate(BaseModel):
    student_id: int
    title: str = "New chat"
    model: str = chat_service.DEFAULT_MODEL

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    pinned: Optional[bool] = None
    archived: Optional[bool] = None

class ChatSendRequest(BaseModel):
    student_id: int
    content: str
    model: Optional[str] = None
    web_search: bool = False

class MessageFeedback(BaseModel):
    student_id: int
    feedback: str

@app.get("/chat/models")
def chat_models():
    return {"models": chat_service.list_models(), "default": chat_service.DEFAULT_MODEL}

@app.get("/chat/conversations")
def list_conversations(student_id: int, q: str = "", db: Session = Depends(get_db)):
    query = db.query(models.Conversation).filter(
        models.Conversation.student_id == student_id,
        models.Conversation.archived == False,  # noqa: E712
    )

    if q.strip():
        like = f"%{q.strip()}%"
        query = query.outerjoin(
            models.ChatMessage,
            models.ChatMessage.conversation_id == models.Conversation.id,
        ).filter(
            or_(
                models.Conversation.title.ilike(like),
                models.ChatMessage.content.ilike(like),
            )
        ).distinct()

    convs = query.order_by(
        models.Conversation.pinned.desc(),
        models.Conversation.updated_at.desc(),
    ).limit(100).all()

    result = []
    for c in convs:
        last = (
            db.query(models.ChatMessage)
            .filter(models.ChatMessage.conversation_id == c.id)
            .order_by(models.ChatMessage.id.desc())
            .first()
        )
        preview = ""
        if last:
            preview = last.content[:80].replace("\n", " ")

        result.append({
            "id": c.id,
            "title": c.title,
            "model": c.model,
            "pinned": c.pinned,
            "preview": preview,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        })

    return {"conversations": result}

@app.post("/chat/conversations")
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == payload.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    conv = models.Conversation(
        student_id=payload.student_id,
        title=payload.title,
        model=payload.model,
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return {
        "id": conv.id,
        "title": conv.title,
        "model": conv.model,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
    }

@app.get("/chat/conversations/{conv_id}")
def get_conversation(conv_id: int, student_id: int, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.conversation_id == conv_id)
        .order_by(models.ChatMessage.id.asc())
        .all()
    )

    return {
        "id": conv.id,
        "title": conv.title,
        "model": conv.model,
        "pinned": conv.pinned,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "model": m.model,
                "feedback": m.feedback,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }

@app.patch("/chat/conversations/{conv_id}")
def update_conversation(
    conv_id: int,
    student_id: int,
    updates: ConversationUpdate,
    db: Session = Depends(get_db),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if updates.title is not None:
        conv.title = updates.title[:120]
    if updates.model is not None:
        conv.model = updates.model
    if updates.pinned is not None:
        conv.pinned = updates.pinned
    if updates.archived is not None:
        conv.archived = updates.archived

    db.commit()
    return {"ok": True}

@app.delete("/chat/conversations/{conv_id}")
def delete_conversation(conv_id: int, student_id: int, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return {"ok": True}

@app.patch("/chat/messages/{msg_id}/feedback")
def message_feedback(
    msg_id: int,
    payload: MessageFeedback,
    db: Session = Depends(get_db),
):
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == msg.conversation_id,
        models.Conversation.student_id == payload.student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=403, detail="Not allowed")

    if payload.feedback not in ("", "up", "down"):
        raise HTTPException(status_code=400, detail="Invalid feedback")

    msg.feedback = payload.feedback
    db.commit()
    return {"ok": True, "feedback": msg.feedback}

@app.delete("/chat/messages/{msg_id}")
def delete_message(msg_id: int, student_id: int, db: Session = Depends(get_db)):
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == msg.conversation_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=403, detail="Not allowed")

    db.delete(msg)
    db.commit()
    return {"ok": True}

# ==================================================
# RAG — ATTACHMENTS
# ==================================================
from services.rag_service import (
    store_document_chunks,
    retrieve_relevant_chunks,
    build_context_block,
)
from services.web_search_service import (
    search_web,
    build_web_context,
)
from services.learner_context import build_learner_context

@app.post("/chat/conversations/{conv_id}/attachments")
async def upload_attachment(
    conv_id: int,
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 10 MB.")
    if not contents:
        raise HTTPException(status_code=400, detail="Empty file.")

    try:
        extraction = extract_text(
            contents, file.content_type or "", file.filename or ""
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")

    text = (extraction.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="No readable text found in file.")

    attachment = models.ChatAttachment(
        conversation_id=conv_id,
        filename=file.filename or "document",
        mime_type=file.content_type or "",
        size_bytes=len(contents),
        source_type=extraction.get("source_type", "text"),
        text_content=text[:20000],
        chunk_count=0,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    try:
        count = store_document_chunks(attachment, text, db)
        attachment.chunk_count = count
        db.commit()
    except Exception as e:
        db.rollback()
        try:
            att = db.query(models.ChatAttachment).filter(
                models.ChatAttachment.id == attachment.id
            ).first()
            if att:
                db.delete(att)
                db.commit()
        except Exception:
            db.rollback()
        raise HTTPException(status_code=500, detail=f"Embedding failed: {e}")

    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "source_type": attachment.source_type,
        "size_bytes": attachment.size_bytes,
        "chunk_count": attachment.chunk_count,
        "method": extraction.get("method", "unknown"),
        "text_length": len(text),
        "created_at": attachment.created_at.isoformat() if attachment.created_at else None,
    }

@app.get("/chat/conversations/{conv_id}/attachments")
def list_attachments(conv_id: int, student_id: int, db: Session = Depends(get_db)):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    rows = (
        db.query(models.ChatAttachment)
        .filter(models.ChatAttachment.conversation_id == conv_id)
        .order_by(models.ChatAttachment.id.asc())
        .all()
    )

    return {
        "attachments": [
            {
                "id": a.id,
                "filename": a.filename,
                "source_type": a.source_type,
                "size_bytes": a.size_bytes,
                "chunk_count": a.chunk_count,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in rows
        ]
    }

@app.delete("/chat/attachments/{attachment_id}")
def delete_attachment(
    attachment_id: int, student_id: int, db: Session = Depends(get_db)
):
    att = (
        db.query(models.ChatAttachment)
        .filter(models.ChatAttachment.id == attachment_id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == att.conversation_id,
        models.Conversation.student_id == student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=403, detail="Not allowed")

    db.delete(att)
    db.commit()
    return {"ok": True}

# ==================================================
# DEBUG
# ==================================================
@app.get("/chat/attachments/{attachment_id}/debug")
def debug_attachment(attachment_id: int, db: Session = Depends(get_db)):
    att = (
        db.query(models.ChatAttachment)
        .filter(models.ChatAttachment.id == attachment_id)
        .first()
    )
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    chunks = (
        db.query(models.DocumentChunk)
        .filter(models.DocumentChunk.attachment_id == attachment_id)
        .order_by(models.DocumentChunk.chunk_index.asc())
        .all()
    )

    return {
        "attachment_id": att.id,
        "filename": att.filename,
        "source_type": att.source_type,
        "size_bytes": att.size_bytes,
        "chunk_count": att.chunk_count,
        "text_length": len(att.text_content or ""),
        "text_first_500": (att.text_content or "")[:500],
        "text_last_500": (att.text_content or "")[-500:],
        "chunks": [
            {
                "index": c.chunk_index,
                "length": len(c.content),
                "preview": c.content[:200],
            }
            for c in chunks[:10]
        ],
    }

@app.get("/chat/debug/learner-context/{student_id}")
def debug_learner_context(student_id: int, db: Session = Depends(get_db)):
    context = build_learner_context(db, student_id)
    return {
        "student_id": student_id,
        "char_count": len(context),
        "context": context,
    }

# ==================================================
# NOVAAI CHAT — Streaming
# ==================================================
def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"

_BR_RE = _re.compile(r"<br\s*/?>", _re.IGNORECASE)
_HTML_TAG_RE = _re.compile(
    r"</?(?:div|span|p|a|b|i|u|strong|em|ul|ol|li|table|tr|td|th|h[1-6]|font|section|article|header|footer|nav|main|aside)\b[^>]*>",
    _re.IGNORECASE,
)

def _strip_html_streaming(text: str) -> str:
    if not text:
        return text
    text = _BR_RE.sub(" ", text)
    text = _HTML_TAG_RE.sub("", text)
    text = text.replace("&nbsp;", " ")
    text = text.replace("&amp;", "&")
    text = text.replace("&lt;", "<")
    text = text.replace("&gt;", ">")
    text = text.replace("&quot;", '"')
    text = text.replace("&#39;", "'")
    return text

@app.post("/chat/conversations/{conv_id}/stream")
def stream_chat(
    conv_id: int,
    payload: ChatSendRequest,
    db: Session = Depends(get_db),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.student_id == payload.student_id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    user_text = (payload.content or "").strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty message")

    model_id = payload.model or conv.model or chat_service.DEFAULT_MODEL

    learner_context = ""
    try:
        learner_context = build_learner_context(db, payload.student_id)
    except Exception as e:
        print(f"[stream_chat] learner context failed: {e}")
        learner_context = ""

    web_results = []
    web_context = ""
    if getattr(payload, "web_search", False):
        try:
            web_results = search_web(user_text, max_results=5)
            web_context = build_web_context(web_results)
        except Exception as e:
            print(f"[stream_chat] web search failed: {e}")

    chunks = retrieve_relevant_chunks(conv_id, user_text, top_k=4, db=db)
    file_context = build_context_block(chunks)

    context_block = "\n\n".join(
        part for part in (web_context, file_context) if part
    )

    user_msg = models.ChatMessage(
        conversation_id=conv.id,
        role="user",
        content=user_text,
        model=model_id,
    )
    db.add(user_msg)

    existing_count = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.conversation_id == conv.id)
        .count()
    )
    if existing_count == 0:
        try:
            new_title = chat_service.generate_title(user_text)
            conv.title = new_title
        except Exception:
            pass

    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(user_msg)

    history = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.conversation_id == conv.id,
            models.ChatMessage.id < user_msg.id,
        )
        .order_by(models.ChatMessage.id.asc())
        .all()
    )

    llm_messages = chat_service.build_messages(
        conv,
        history,
        user_text,
        context_note=context_block,
        learner_context=learner_context,
    )

    def event_gen():
        full_response = ""
        assistant_msg_id = None

        try:
            yield _sse({"type": "user_message_id", "id": user_msg.id})
            yield _sse({"type": "title", "title": conv.title})

            if web_results:
                yield _sse({
                    "type": "web_sources",
                    "sources": [
                        {
                            "title": w["title"],
                            "url": w["url"],
                            "snippet": w["snippet"][:220],
                            "score": w["score"],
                        }
                        for w in web_results
                    ],
                })

            if chunks:
                yield _sse({
                    "type": "sources",
                    "sources": [
                        {
                            "filename": c["filename"],
                            "chunk_index": c["chunk_index"],
                            "score": c["score"],
                            "snippet": c["content"][:180],
                        }
                        for c in chunks
                    ],
                })

            stream_buffer = ""
            try:
                for delta in chat_service.stream_completion(model_id, llm_messages):
                    stream_buffer += delta

                    last_lt = stream_buffer.rfind("<")
                    last_gt = stream_buffer.rfind(">")

                    if last_lt > last_gt:
                        safe = stream_buffer[:last_lt]
                        stream_buffer = stream_buffer[last_lt:]
                    else:
                        safe = stream_buffer
                        stream_buffer = ""

                    if safe:
                        cleaned = _strip_html_streaming(safe)
                        if cleaned:
                            full_response += cleaned
                            yield _sse({"type": "delta", "content": cleaned})
            except Exception as stream_err:
                print(f"[stream_chat] LLM stream interrupted: {stream_err}")
                yield _sse({"type": "error", "message": str(stream_err)})

            if stream_buffer:
                cleaned = _strip_html_streaming(stream_buffer)
                if cleaned:
                    full_response += cleaned
                    yield _sse({"type": "delta", "content": cleaned})

            from database import SessionLocal as _SL
            fresh = _SL()
            try:
                assistant_msg = models.ChatMessage(
                    conversation_id=conv.id,
                    role="assistant",
                    content=full_response,
                    model=model_id,
                )
                fresh.add(assistant_msg)
                _conv = fresh.query(models.Conversation).filter(
                    models.Conversation.id == conv.id
                ).first()
                if _conv:
                    _conv.updated_at = datetime.utcnow()
                fresh.commit()
                fresh.refresh(assistant_msg)
                assistant_msg_id = assistant_msg.id
            finally:
                fresh.close()

            yield _sse({"type": "done", "message_id": assistant_msg_id})

        except GeneratorExit:
            print("[stream_chat] Client disconnected. Stopping stream.")
            return
        except Exception as e:
            yield _sse({"type": "error", "message": str(e)})

        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

# ==================================================
# PHASE 2 — ONBOARDING + DIAGNOSTIC QUIZ
# ==================================================
from services.onboarding_service import (
    start_onboarding,
    generate_diagnostic,
    submit_diagnostic,
)

class OnboardingStartRequest(BaseModel):
    student_id: int
    learning_goal: str
    daily_time_minutes: int = 30
    current_level: str = "beginner"

class DiagnosticGenerateRequest(BaseModel):
    student_id: int

class DiagnosticSubmitRequest(BaseModel):
    student_id: int
    topic_id: int
    answers: Dict[str, Optional[str]]
    session_id: Optional[str] = None

@app.post("/onboarding/start")
def onboarding_start(payload: OnboardingStartRequest, db: Session = Depends(get_db)):
    try:
        return start_onboarding(
            student_id=payload.student_id,
            learning_goal=payload.learning_goal,
            daily_time_minutes=payload.daily_time_minutes,
            current_level=payload.current_level,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/onboarding/diagnostic/generate")
def onboarding_generate(
    payload: DiagnosticGenerateRequest, db: Session = Depends(get_db)
):
    try:
        return generate_diagnostic(student_id=payload.student_id, db=db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/onboarding/diagnostic/submit")
def onboarding_submit(
    payload: DiagnosticSubmitRequest, db: Session = Depends(get_db)
):
    try:
        return submit_diagnostic(
            student_id=payload.student_id,
            topic_id=payload.topic_id,
            answers=payload.answers,
            session_id=payload.session_id,
            db=db,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/onboarding/status/{student_id}")
def onboarding_status(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return {
        "student_id": student.id,
        "onboarding_completed": bool(student.onboarding_completed),
        "learning_goal": student.learning_goal or "",
        "daily_time_minutes": student.daily_time_minutes or 30,
        "current_level": student.current_level or "",
    }

# ==================================================
# PHASE 5 — INTELLIGENT ROADMAPS
# ==================================================
from services.roadmap_service import generate_roadmap_for_topic

class TopicAnalyzeRequest(BaseModel):
    student_id: Optional[int] = None

@app.post("/topics/{topic_id}/analyze")
def analyze_topic(topic_id: int, payload: TopicAnalyzeRequest = None, db: Session = Depends(get_db)):
    try:
        student_id = payload.student_id if payload else None
        result = generate_roadmap_for_topic(topic_id, student_id, db)
        return {"topic_id": topic_id, "analysis": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))