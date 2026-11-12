import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  startOnboarding,
  generateDiagnostic,
  submitDiagnostic,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Target,
  Clock,
  BarChart3,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Trophy,
} from "lucide-react";
import "./Onboarding.css";

const LEVELS = [
  {
    id: "beginner",
    label: "Beginner",
    desc: "I'm just starting out",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    desc: "I know the basics",
  },
  {
    id: "advanced",
    label: "Advanced",
    desc: "I want deep concepts",
  },
];

const TIME_PRESETS = [15, 30, 45, 60, 90];

export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // Steps: 1 = goal form, 2 = diagnostic quiz, 3 = results
  const [step, setStep] = useState(1);

  // Step 1 state
  const [goal, setGoal] = useState("");
  const [timeMinutes, setTimeMinutes] = useState(30);
  const [level, setLevel] = useState("beginner");
  const [step1Error, setStep1Error] = useState("");
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2 state
  const [topicId, setTopicId] = useState(null);
  const [topicName, setTopicName] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [step2Loading, setStep2Loading] = useState(false);
  const [step2Error, setStep2Error] = useState("");

  // Step 3 state
  const [result, setResult] = useState(null);
  const [step3Loading, setStep3Loading] = useState(false);

  // ==================================================
  // Step 1 → Start onboarding + generate diagnostic
  // ==================================================
  const handleStart = async (e) => {
    e.preventDefault();
    setStep1Error("");

    const trimmedGoal = goal.trim();
    if (trimmedGoal.length < 3) {
      setStep1Error("Please enter what you want to learn (3+ characters).");
      return;
    }

    setStep1Loading(true);
    try {
      // Save goal
      await startOnboarding({
        student_id: user.student_id,
        learning_goal: trimmedGoal,
        daily_time_minutes: timeMinutes,
        current_level: level,
      });

      // Generate diagnostic
      setStep1Loading(false);
      setStep2Loading(true);
      setStep(2);

      const res = await generateDiagnostic(user.student_id);
      setTopicId(res.data.topic_id);
      setTopicName(res.data.topic_name);
      setSessionId(res.data.session_id);
      setQuestions(res.data.questions || []);
      setCurrentQ(0);
      setAnswers({});
    } catch (err) {
      setStep(1);
      setStep1Error(
        err.response?.data?.detail ||
          err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setStep1Loading(false);
      setStep2Loading(false);
    }
  };

  // ==================================================
  // Step 2 → Answer questions
  // ==================================================
  const handleSelectAnswer = (questionId, option) => {
    setAnswers((prev) => ({ ...prev, [String(questionId)]: option }));
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentQ > 0) {
      setCurrentQ((i) => i - 1);
    }
  };

  const handleSubmitDiagnostic = async () => {
    setStep2Error("");

    // Ensure all questions answered
    const missing = questions.filter(
      (q) => !answers[String(q.id)]
    );
    if (missing.length > 0) {
      setStep2Error(
        `Please answer all questions (${missing.length} remaining).`
      );
      return;
    }

    setStep3Loading(true);
    try {
      const res = await submitDiagnostic({
        student_id: user.student_id,
        topic_id: topicId,
        answers,
        session_id: sessionId,
      });
      setResult(res.data);
      setStep(3);

      // Update local user state so the app knows onboarding is done
      updateUser({ onboarding_completed: true, learning_goal: topicName });
    } catch (err) {
      setStep2Error(
        err.response?.data?.detail ||
          err.message ||
          "Could not submit diagnostic. Please try again."
      );
    } finally {
      setStep3Loading(false);
    }
  };

  const handleFinish = () => {
    navigate("/", { replace: true });
  };

  const currentQuestion = questions[currentQ];
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const progressPct =
    totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  return (
    <div className="onboarding-page">
      {/* ---------- Progress indicator ---------- */}
      <div className="ob-steps">
        <div className={`ob-step ${step >= 1 ? "active" : ""}`}>
          <span className="ob-step-num">1</span>
          <span>Your Goal</span>
        </div>
        <div className="ob-step-line" />
        <div className={`ob-step ${step >= 2 ? "active" : ""}`}>
          <span className="ob-step-num">2</span>
          <span>Quick Diagnostic</span>
        </div>
        <div className="ob-step-line" />
        <div className={`ob-step ${step >= 3 ? "active" : ""}`}>
          <span className="ob-step-num">3</span>
          <span>Your Profile</span>
        </div>
      </div>

      {/* ==================================================
          STEP 1 — Goal Form
          ================================================== */}
      {step === 1 && (
        <div className="ob-card">
          <div className="ob-icon">
            <Sparkles size={28} />
          </div>
          <h1 className="ob-title">Let's personalize your learning</h1>
          <p className="ob-subtitle">
            Answer three quick questions. This takes 20 seconds.
          </p>

          {step1Error && <div className="ob-error">{step1Error}</div>}

          <form onSubmit={handleStart} className="ob-form">
            <label className="ob-field">
              <div className="ob-field-label">
                <Target size={16} /> What do you want to learn?
              </div>
              <input
                type="text"
                placeholder="e.g., Python Basics, Machine Learning, DBMS"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                autoFocus
                disabled={step1Loading}
              />
            </label>

            <label className="ob-field">
              <div className="ob-field-label">
                <Clock size={16} /> How much time per day?
              </div>
              <div className="ob-time-row">
                {TIME_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`ob-time-chip ${timeMinutes === t ? "selected" : ""}`}
                    onClick={() => setTimeMinutes(t)}
                    disabled={step1Loading}
                  >
                    {t}m
                  </button>
                ))}
              </div>
            </label>

            <div className="ob-field">
              <div className="ob-field-label">
                <BarChart3 size={16} /> Current level
              </div>
              <div className="ob-level-row">
                {LEVELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={`ob-level-card ${level === l.id ? "selected" : ""}`}
                    onClick={() => setLevel(l.id)}
                    disabled={step1Loading}
                  >
                    <div className="ob-level-title">{l.label}</div>
                    <div className="ob-level-desc">{l.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="ob-btn-primary"
              disabled={step1Loading}
            >
              {step1Loading ? (
                <>
                  <Loader2 size={16} className="spin" /> Setting up...
                </>
              ) : (
                <>
                  Continue <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ==================================================
          STEP 2 — Diagnostic Quiz
          ================================================== */}
      {step === 2 && (
        <div className="ob-card ob-card-wide">
          {step2Loading ? (
            <div className="ob-loading">
              <Loader2 size={36} className="spin" />
              <h2>Preparing your diagnostic...</h2>
              <p>Generating a few questions to measure your starting point.</p>
              <p className="ob-loading-hint">This takes 15-30 seconds.</p>
            </div>
          ) : (
            <>
              <div className="ob-quiz-header">
                <div>
                  <h2 className="ob-quiz-title">Quick diagnostic</h2>
                  <p className="ob-quiz-subtitle">
                    About <strong>{topicName}</strong> — don't worry about
                    getting these wrong.
                  </p>
                </div>
                <div className="ob-quiz-counter">
                  {currentQ + 1} / {totalQuestions}
                </div>
              </div>

              <div className="ob-progress-bar">
                <div
                  className="ob-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {step2Error && <div className="ob-error">{step2Error}</div>}

              {currentQuestion && (
                <div className="ob-question">
                  <div className="ob-question-text">
                    {currentQuestion.question}
                  </div>

                  <div className="ob-options">
                    {["a", "b", "c", "d"].map((letter) => {
                      const text = currentQuestion[`option_${letter}`];
                      if (!text) return null;
                      const selected =
                        answers[String(currentQuestion.id)] === letter;
                      return (
                        <button
                          key={letter}
                          type="button"
                          className={`ob-option ${selected ? "selected" : ""}`}
                          onClick={() =>
                            handleSelectAnswer(currentQuestion.id, letter)
                          }
                        >
                          <span className="ob-option-letter">
                            {letter.toUpperCase()}
                          </span>
                          <span className="ob-option-text">{text}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="ob-quiz-nav">
                <button
                  type="button"
                  className="ob-btn-ghost"
                  onClick={handlePrev}
                  disabled={currentQ === 0}
                >
                  <ArrowLeft size={16} /> Previous
                </button>

                {currentQ < totalQuestions - 1 ? (
                  <button
                    type="button"
                    className="ob-btn-primary"
                    onClick={handleNext}
                    disabled={!answers[String(currentQuestion?.id)]}
                  >
                    Next <ArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ob-btn-primary"
                    onClick={handleSubmitDiagnostic}
                    disabled={
                      step3Loading || answeredCount < totalQuestions
                    }
                  >
                    {step3Loading ? (
                      <>
                        <Loader2 size={16} className="spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        Finish <Check size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ==================================================
          STEP 3 — Results
          ================================================== */}
      {step === 3 && result && (
        <div className="ob-card">
          <div className="ob-icon ob-icon-success">
            <Trophy size={28} />
          </div>
          <h1 className="ob-title">You're all set! 🎉</h1>
          <p className="ob-subtitle">
            Your personalized learning profile is ready.
          </p>

          <div className="ob-result-stats">
            <div className="ob-result-stat">
              <div className="ob-result-value">
                {result.correct} / {result.total_questions}
              </div>
              <div className="ob-result-label">Correct answers</div>
            </div>
            <div className="ob-result-stat">
              <div className="ob-result-value">{result.percent}%</div>
              <div className="ob-result-label">Diagnostic score</div>
            </div>
          </div>

          <div className="ob-result-message">
            {result.percent >= 70 ? (
              <>You're ahead of the curve! We'll skip the basics and go deep.</>
            ) : result.percent >= 40 ? (
              <>Solid foundation. We'll build on what you already know.</>
            ) : (
              <>We'll start with the essentials and go at your pace.</>
            )}
          </div>

          <p className="ob-result-hint">
            Your AI Tutor and recommendations are now personalized based on this
            diagnostic.
          </p>

          <button
            type="button"
            className="ob-btn-primary"
            onClick={handleFinish}
          >
            Start Learning <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}