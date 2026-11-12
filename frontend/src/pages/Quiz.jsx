import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getSearchHistory,
  getEnrichedTopics,
  generateTest,
  generateSmartTest,
  submitTest,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConceptModal from "../components/ConceptModal";
import {
  Clock,
  SkipForward,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Play,
  HelpCircle,
  Target,
  BarChart3,
  Zap,
} from "lucide-react";
import "./Quiz.css";

const HISTORY_CACHE_KEY = "quiz_history_cache_v1";
const TOPICS_CACHE_KEY = "quiz_topics_cache_v1";
const SESSION_CACHE_KEY = "quiz_session_cache_v1";

export default function Quiz() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [history, setHistory] = useState([]);
  const [enriched, setEnriched] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  const [activeTopic, setActiveTopic] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [smartGenerating, setSmartGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [activeConcept, setActiveConcept] = useState(null);

  const timerRef = useRef(null);
  const autoStarted = useRef(false);
  const sessionRestored = useRef(false);

  // Load topics from cache + refresh in background
  useEffect(() => {
    if (!user?.student_id) return;

    let hasCache = false;
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_CACHE_KEY) || "null");
      const t = JSON.parse(localStorage.getItem(TOPICS_CACHE_KEY) || "null");
      if (h && h.student_id === user.student_id) {
        setHistory(h.data || []);
        hasCache = true;
      }
      if (t && t.student_id === user.student_id) {
        setEnriched(t.data || []);
      }
      if (hasCache) setLoadingTopics(false);
    } catch {}

    refreshTopics(!hasCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const refreshTopics = async (showLoading) => {
    if (!user?.student_id) return;
    if (showLoading) setLoadingTopics(true);

    const [histRes, enrichedRes] = await Promise.allSettled([
      getSearchHistory(user.student_id, 30),
      getEnrichedTopics(user.student_id),
    ]);

    if (histRes.status === "fulfilled") {
      const data = histRes.value.data.history || [];
      setHistory(data);
      try {
        localStorage.setItem(
          HISTORY_CACHE_KEY,
          JSON.stringify({ student_id: user.student_id, data, fetchedAt: Date.now() })
        );
      } catch {}
    }

    if (enrichedRes.status === "fulfilled") {
      const data = enrichedRes.value.data || [];
      setEnriched(data);
      try {
        localStorage.setItem(
          TOPICS_CACHE_KEY,
          JSON.stringify({ student_id: user.student_id, data, fetchedAt: Date.now() })
        );
      } catch {}
    }

    setLoadingTopics(false);
  };

  // Merge history + enriched
  const enrichedMap = new Map(enriched.map((t) => [t.id, t]));
  const learnedTopics = history
    .map((h) => {
      const t = enrichedMap.get(h.topic_id);
      return {
        id: h.topic_id,
        name: h.topic_name,
        subject_name: h.subject_name,
        searched_at: h.searched_at,
        score: t?.score || 0,
        attempts: t?.attempts || 0,
      };
    })
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i);

  // Auto-start if ?topic= is in URL
  useEffect(() => {
    const urlTopic = Number(searchParams.get("topic"));
    if (!urlTopic || autoStarted.current || learnedTopics.length === 0) return;
    const topic = learnedTopics.find((t) => t.id === urlTopic);
    if (topic) {
      autoStarted.current = true;
      startTest(topic, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnedTopics, searchParams]);

  // Restore session
  useEffect(() => {
    if (!user?.student_id || sessionRestored.current) return;
    sessionRestored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(SESSION_CACHE_KEY) || "null");
      if (
        saved &&
        saved.student_id === user.student_id &&
        saved.questions?.length > 0 &&
        !saved.result
      ) {
        setQuestions(saved.questions);
        setAnswers(saved.answers || {});
        setCurrentIndex(saved.currentIndex || 0);
        setSeconds(saved.seconds || 0);
        setActiveTopic(saved.topic);
      }
    } catch {}
  }, [user?.student_id]);

  // Persist session
  useEffect(() => {
    if (!user?.student_id || !activeTopic || questions.length === 0 || result) return;
    try {
      localStorage.setItem(
        SESSION_CACHE_KEY,
        JSON.stringify({
          student_id: user.student_id,
          topic: activeTopic,
          questions,
          answers,
          currentIndex,
          seconds,
          savedAt: Date.now(),
        })
      );
    } catch {}
  }, [user?.student_id, activeTopic, questions, answers, currentIndex, seconds, result]);

  // Timer
  useEffect(() => {
    if (questions.length === 0 || result) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [questions.length, result]);

  const startTest = async (topic, force = false) => {
    setActiveTopic(topic);
    setGenerating(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setSeconds(0);
    localStorage.removeItem(SESSION_CACHE_KEY);

    try {
      const res = await generateTest(topic.id, user.student_id, 6, force);
      setQuestions(res.data.questions);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Test generation failed. Try again in a moment."
      );
    } finally {
      setGenerating(false);
    }
  };

  const startSmartTest = async () => {
    setSmartGenerating(true);
    setError("");
    try {
      const res = await generateSmartTest(user.student_id, 6);
      const smartTopic = {
        id: res.data.topic_id,
        name: res.data.topic_name,
        subject_name: res.data.subject_name,
        difficulty: res.data.difficulty,
      };
      setActiveTopic(smartTopic);
      setQuestions(res.data.questions);
      setAnswers({});
      setCurrentIndex(0);
      setResult(null);
      setSeconds(0);
      localStorage.removeItem(SESSION_CACHE_KEY);
    } catch (err) {
      setError(err.response?.data?.detail || "Smart test generation failed.");
    } finally {
      setSmartGenerating(false);
    }
  };

  const handleBackToTopics = () => {
    localStorage.removeItem(SESSION_CACHE_KEY);
    setActiveTopic(null);
    setQuestions([]);
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
    setSeconds(0);
    setError("");
    setActiveConcept(null);
    setSearchParams({});
    autoStarted.current = false;
  };

  const handleAnswer = (qid, option) =>
    setAnswers((prev) => ({ ...prev, [qid]: option }));

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
    else handleSubmit();
  };

  const handleSkip = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length === 0) {
      setError("Answer at least one question.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await submitTest(user.student_id, answers);
      setResult(res.data);
      localStorage.removeItem(SESSION_CACHE_KEY);
      localStorage.removeItem("dashboard_cache_v1");
      localStorage.removeItem("dashboard_recs_cache_v1");
      localStorage.removeItem("recs_cache_v1");
      localStorage.removeItem("gaps_cache_v1");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryNew = () => {
    if (activeTopic) startTest(activeTopic, true);
  };

  const currentQuestion = questions[currentIndex];
  const progress =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const trendIcon = (t) => {
    if (t === "improving") return <TrendingUp size={12} />;
    if (t === "declining") return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  const conceptColor = (score) => {
    if (score >= 75) return "concept-good";
    if (score >= 50) return "concept-mid";
    return "concept-weak";
  };

  const scoreClass = (s) => {
    if (s >= 75) return "score-good";
    if (s >= 50) return "score-mid";
    if (s > 0) return "score-weak";
    return "score-none";
  };

  const formatTimeAgo = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const openConceptDeepDive = (c) => {
    setActiveConcept({ id: c.concept_id, name: c.concept_name, description: "" });
  };

  // TOPIC SELECTION
  if (!activeTopic) {
    return (
      <div className="quiz-page">
        <div className="quiz-header">
          <div>
            <h1 className="quiz-title">Test Your Understanding</h1>
            <p className="quiz-subtitle">
              Pick a topic you've studied or let the AI decide.
            </p>
          </div>
        </div>

        {/* SMART TEST BANNER */}
        <div className="smart-test-banner">
          <div className="stb-content">
            <h3><Zap size={18} className="stb-icon" /> AI Smart Checkup</h3>
            <p>Let the AI analyze your weak spots and generate a targeted test instantly.</p>
          </div>
          <button 
            className="stb-btn" 
            onClick={startSmartTest} 
            disabled={smartGenerating || learnedTopics.length === 0}
          >
            {smartGenerating ? (
              <><RefreshCw size={16} className="spin" /> Analyzing...</>
            ) : (
              <><Sparkles size={16} /> Start Smart Test</>
            )}
          </button>
        </div>

        {loadingTopics && learnedTopics.length === 0 && (
          <p className="quiz-muted">Loading your topics...</p>
        )}

        {!loadingTopics && learnedTopics.length === 0 && (
          <div className="quiz-empty-state">
            <HelpCircle size={48} />
            <h2>No learned topics yet</h2>
            <p>Search for a topic first, then come back to test your understanding.</p>
            <button className="btn-primary" onClick={() => navigate("/search")}>
              <Sparkles size={14} /> Search a Topic
            </button>
          </div>
        )}

        {learnedTopics.length > 0 && (
          <>
            <div className="topics-grid-header">
              <h2 className="topics-grid-title">
                Your Topics ({learnedTopics.length})
              </h2>
            </div>
            <div className="topics-grid">
              {learnedTopics.map((t) => (
                <button
                  key={t.id}
                  className="topic-test-card"
                  onClick={() => startTest(t, false)}
                >
                  <div className="ttc-header">
                    <span className="ttc-subject">{t.subject_name}</span>
                    <span className={`ttc-score ${scoreClass(t.score)}`}>
                      {t.attempts > 0 ? `${Math.round(t.score)}%` : "New"}
                    </span>
                  </div>
                  <div className="ttc-name">{t.name}</div>
                  <div className="ttc-footer">
                    <div className="ttc-meta">
                      {t.attempts > 0
                        ? `${t.attempts} attempt${t.attempts === 1 ? "" : "s"}`
                        : "Not tested yet"}
                    </div>
                    <div className="ttc-time">{formatTimeAgo(t.searched_at)}</div>
                  </div>
                  <div className="ttc-action">
                    <Play size={14} />
                    <span>{t.attempts > 0 ? "Retake Test" : "Start Test"}</span>
                    <ArrowRight size={14} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="quiz-help-row">
          <div className="quiz-help-card">
            <div className="qhc-icon icon-blue">
              <Target size={18} />
            </div>
            <div>
              <h3>Concept-aware</h3>
              <p>Questions target specific concepts, not just topic facts.</p>
            </div>
          </div>
          <div className="quiz-help-card">
            <div className="qhc-icon icon-purple">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3>Per-concept breakdown</h3>
              <p>See exactly which concepts you're strong or weak in.</p>
            </div>
          </div>
          <div className="quiz-help-card">
            <div className="qhc-icon icon-green">
              <Sparkles size={18} />
            </div>
            <div>
              <h3>Feeds your recommendations</h3>
              <p>Results automatically update your learning plan.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // TEST RUNNING
  return (
    <div className="quiz-page">
      <div className="quiz-header">
        <button className="btn-back" onClick={handleBackToTopics}>
          <ArrowLeft size={14} /> Back to Topics
        </button>
        <div>
          <h1 className="quiz-title">{activeTopic.name} Test</h1>
          <p className="quiz-subtitle">
            Concept-aware questions — find out exactly what you understand.
          </p>
        </div>
        {!generating && !result && (
          <button
            className="btn-regenerate"
            onClick={() => startTest(activeTopic, true)}
            disabled={generating}
          >
            <RefreshCw size={14} />
            New Questions
          </button>
        )}
      </div>

      {error && <div className="quiz-error">{error}</div>}

      {generating && (
        <div className="quiz-generating">
          <div className="ai-loading">
            <Sparkles size={20} />
            <span>Generating concept-aware questions...</span>
          </div>
        </div>
      )}

      {!generating && !result && questions.length > 0 && currentQuestion && (
        <div className="quiz-body">
          <div className="quiz-main">
            <div className="quiz-progress-row">
              <div className="quiz-progress-text">
                Question <b>{currentIndex + 1}</b> of <b>{questions.length}</b>
              </div>
              <div className="quiz-timer">
                <Clock size={14} /> {formatTime(seconds)}
              </div>
            </div>
            <div className="quiz-progress-bar">
              <div
                className="quiz-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="quiz-question-card">
              <div className="ai-badge">
                <Sparkles size={12} />
                {currentQuestion.question_type || "conceptual"} ·{" "}
                {currentQuestion.difficulty}
              </div>
              <h2 className="quiz-q-text">
                {currentIndex + 1}. {currentQuestion.question}
              </h2>
              <div className="quiz-options">
                {["A", "B", "C", "D"].map((opt) => {
                  const key = `option_${opt.toLowerCase()}`;
                  const selected = answers[currentQuestion.id] === opt;
                  return (
                    <label
                      key={opt}
                      className={`quiz-option ${selected ? "selected" : ""}`}
                    >
                      <span className="quiz-opt-radio">
                        {selected && <span className="quiz-opt-radio-inner" />}
                      </span>
                      <input
                        type="radio"
                        name={`q-${currentQuestion.id}`}
                        value={opt}
                        checked={selected}
                        onChange={() => handleAnswer(currentQuestion.id, opt)}
                      />
                      <span className="quiz-opt-text">{currentQuestion[key]}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="quiz-nav">
              <button
                className="btn-skip"
                onClick={handlePrev}
                disabled={currentIndex === 0}
              >
                ← Previous
              </button>
              <div className="quiz-nav-right">
                <button className="btn-skip" onClick={handleSkip}>
                  <SkipForward size={14} /> Skip
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button className="btn-primary" onClick={handleNext}>
                    Next <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={submitting}
                  >
                    <Check size={14} />
                    {submitting ? "Submitting..." : "Submit"}
                  </button>
                )}
              </div>
            </div>
          </div>

          <aside className="quiz-info">
            <h3 className="quiz-info-title">Test Info</h3>
            <div className="quiz-info-item">
              <span>Topic</span>
              <b>{activeTopic.name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Subject</span>
              <b>{activeTopic.subject_name}</b>
            </div>
            <div className="quiz-info-item">
              <span>Total Questions</span>
              <b>{questions.length}</b>
            </div>
            <div className="quiz-info-item">
              <span>Answered</span>
              <b>{Object.keys(answers).length}</b>
            </div>
            {currentQuestion.concepts?.length > 0 && (
              <div className="quiz-info-concepts">
                <div className="quiz-info-subtitle">This question tests</div>
                {currentQuestion.concepts.map((c) => (
                  <span key={c.id} className="quiz-concept-chip">
                    {c.name}
                  </span>
                ))}
              </div>
            )}
            <div className="quiz-resume-note">
              Your answers are saved automatically.
            </div>
          </aside>
        </div>
      )}

      {result && (
        <div className="quiz-result-box">
          <div className="result-header">
            <div>
              <h2>🎯 Test Results</h2>
              <p className="result-subtitle">
                {result.correct} out of {result.total} correct
              </p>
            </div>
            <div className="result-score-big">
              <span>{result.score_percent}%</span>
            </div>
          </div>

          {result.concepts && result.concepts.length > 0 && (
            <div className="result-concepts">
              <h3 className="result-section-title">🧠 Concept Breakdown</h3>
              <p className="result-section-sub">
                Sorted weakest first — click any concept to open its deep-dive.
              </p>
              {result.concepts.map((c) => (
                <div key={c.concept_id} className="concept-result">
                  <div className="concept-result-header">
                    <button
                      type="button"
                      className="concept-result-name-clickable"
                      onClick={() => openConceptDeepDive(c)}
                      title={`Open deep-dive for ${c.concept_name}`}
                    >
                      {c.concept_name}
                    </button>
                    <div className="concept-result-right">
                      <span className={`concept-trend trend-${c.trend}`}>
                        {trendIcon(c.trend)}
                        {c.trend}
                      </span>
                      <span
                        className={`concept-score-badge ${conceptColor(
                          c.session_score
                        )}`}
                      >
                        {c.session_score}%
                      </span>
                    </div>
                  </div>
                  <div className="concept-result-bar">
                    <div
                      className={`concept-result-fill ${conceptColor(
                        c.session_score
                      )}`}
                      style={{ width: `${c.session_score}%` }}
                    />
                  </div>
                  <div className="concept-result-meta">
                    This session: <b>{c.session_correct}/{c.session_total}</b>
                    {" · "}
                    Overall: <b>{c.overall_score}%</b>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="result-questions">
            <h3 className="result-section-title">📝 Question Review</h3>
            {result.details.map((d) => (
              <div
                key={d.question_id}
                className={`quiz-detail ${d.is_correct ? "ok" : "bad"}`}
              >
                <div className="quiz-detail-q">{d.question}</div>
                <div className="quiz-detail-line">
                  Your answer: <b>{d.your_answer || "—"}</b> · Correct:{" "}
                  <b>{d.correct_answer}</b>
                </div>
                {d.explanation && (
                  <div className="quiz-detail-expl">💡 {d.explanation}</div>
                )}
                {d.concepts?.length > 0 && (
                  <div className="quiz-detail-concepts">
                    {d.concepts.map((cn, i) => (
                      <span key={i} className="quiz-concept-chip">
                        {cn}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="quiz-result-actions">
            <button onClick={handleBackToTopics} className="btn-secondary">
              <ArrowLeft size={14} /> Back to Topics
            </button>
            <button onClick={handleRetryNew} className="btn-primary">
              <RefreshCw size={14} /> Take Another Test
            </button>
          </div>
        </div>
      )}

      {activeConcept && (
        <ConceptModal
          concept={activeConcept}
          onClose={() => setActiveConcept(null)}
        />
      )}
    </div>
  );
}