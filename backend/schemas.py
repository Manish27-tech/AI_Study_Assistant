from typing import Optional, Dict
from pydantic import BaseModel


# ==================================================
# STUDENT
# ==================================================
class StudentCreate(BaseModel):
    name: str
    email: str
    course: str


class StudentResponse(BaseModel):
    id: int
    name: str
    email: str
    course: str
    class Config:
        from_attributes = True


# ==================================================
# SUBJECT
# ==================================================
class SubjectCreate(BaseModel):
    name: str
    student_id: int


class SubjectResponse(BaseModel):
    id: int
    name: str
    student_id: int
    class Config:
        from_attributes = True


# ==================================================
# TOPIC
# ==================================================
class TopicCreate(BaseModel):
    name: str
    difficulty: str = "medium"
    subject_id: int


class TopicResponse(BaseModel):
    id: int
    name: str
    difficulty: str
    subject_id: int
    class Config:
        from_attributes = True


# ==================================================
# PERFORMANCE
# ==================================================
class PerformanceCreate(BaseModel):
    student_id: int
    topic_id: int
    score: float = 0.0
    attempts: int = 0


class PerformanceResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    score: float
    attempts: int
    class Config:
        from_attributes = True


# ==================================================
# STUDY PLAN
# ==================================================
class StudyPlanCreate(BaseModel):
    student_id: int
    topic_id: int
    date: str
    duration_minutes: int = 30
    completed: bool = False


class StudyPlanResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    date: str
    duration_minutes: int
    completed: bool
    class Config:
        from_attributes = True


# ==================================================
# QUIZ QUESTION (legacy)
# ==================================================
class QuizQuestionCreate(BaseModel):
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str


class QuizQuestionResponse(BaseModel):
    id: int
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    class Config:
        from_attributes = True


# ==================================================
# QUIZ RESULT (legacy)
# ==================================================
class QuizResultCreate(BaseModel):
    student_id: int
    topic_id: int
    score: float = 0.0
    total_questions: int = 0
    date: str


class QuizResultResponse(BaseModel):
    id: int
    student_id: int
    topic_id: int
    score: float
    total_questions: int
    date: str
    class Config:
        from_attributes = True


# ==================================================
# PHASE A — CONCEPT-LEVEL SCHEMAS
# ==================================================
class ConceptCreate(BaseModel):
    topic_id: int
    name: str
    description: str = ""
    importance: int = 3
    order_index: int = 0


class ConceptResponse(BaseModel):
    id: int
    topic_id: int
    name: str
    description: str
    importance: int
    order_index: int
    class Config:
        from_attributes = True


class LearningContentCreate(BaseModel):
    topic_id: int
    content_json: str
    sources: str = "[]"
    model_version: str = ""


class LearningContentResponse(BaseModel):
    id: int
    topic_id: int
    content_json: str
    sources: str
    model_version: str
    class Config:
        from_attributes = True


class QuestionCreate(BaseModel):
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str = ""
    difficulty: str = "medium"
    question_type: str = "conceptual"


class QuestionResponse(BaseModel):
    id: int
    topic_id: int
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    explanation: str
    difficulty: str
    question_type: str
    class Config:
        from_attributes = True


class QuestionConceptCreate(BaseModel):
    question_id: int
    concept_id: int
    weight: float = 1.0


class QuestionConceptResponse(BaseModel):
    id: int
    question_id: int
    concept_id: int
    weight: float
    class Config:
        from_attributes = True


class QuestionAttemptCreate(BaseModel):
    student_id: int
    question_id: int
    selected_option: Optional[str] = None
    is_correct: bool = False
    time_spent_secs: int = 0
    session_id: Optional[str] = None


class QuestionAttemptResponse(BaseModel):
    id: int
    student_id: int
    question_id: int
    selected_option: Optional[str]
    is_correct: bool
    time_spent_secs: int
    session_id: Optional[str]
    class Config:
        from_attributes = True


class ConceptStatResponse(BaseModel):
    id: int
    student_id: int
    concept_id: int
    attempts: int
    correct: int
    score: float
    confidence: float
    trend: str
    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    id: int
    student_id: int
    concept_id: int
    priority: float
    reason: str
    suggested_minutes: int
    activity_type: str
    status: str
    class Config:
        from_attributes = True


# ==================================================
# PHASE B — SEARCH / CONTENT / CONCEPT
# ==================================================
class TopicSearchRequest(BaseModel):
    topic_name: str
    student_id: int
    difficulty: str = "medium"


class TopicSearchResponse(BaseModel):
    topic_id: int
    topic_name: str
    subject_id: int
    subject_name: str
    difficulty: str
    created: bool


# ==================================================
# PHASE C — CONCEPT-AWARE TESTING
# ==================================================
class TestGenerateRequest(BaseModel):
    topic_id: int
    num_questions: int = 8


class TestSubmitRequest(BaseModel):
    student_id: int
    answers: Dict[str, Optional[str]]   # { "question_id": "A" | "B" | null }
    session_id: Optional[str] = None