import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDashboardAnalytics,
  getRecommendationsList,
  searchTopic,
  getTopicFull,
  getStudentStruggles,
  getDailyStudyPlan,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../hooks/useCachedFetch";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Brain,
  MessageSquare,
  BookOpen,
  Play,
  Clock,
} from "lucide-react";
import "./Dashboard.css";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Dynamic Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  // ---------- Cached fetches (instant load + manual refresh) ----------
  const {
    data: analyticsData,
    loading,
    error,
    refreshing,
    refresh,
  } = useCachedFetch(
    user?.student_id ? `dash_analytics_${user.student_id}` : "dash_analytics_none",
    async () => {
      if (!user?.student_id) return null;
      const res = await getDashboardAnalytics(user.student_id);
      return res.data;
    }
  );

  const { data: recsData } = useCachedFetch(
    user?.student_id ? `dash_recs_${user.student_id}` : "dash_recs_none",
    async () => {
      if (!user?.student_id) return [];
      const res = await getRecommendationsList(user.student_id);
      return (res.data.recommendations || []).slice(0, 3);
    }
  );

  const { data: strugglesData } = useCachedFetch(
    user?.student_id ? `dash_struggles_${user.student_id}` : "dash_struggles_none",
    async () => {
      if (!user?.student_id) return [];
      const res = await getStudentStruggles(user.student_id);
      return res.data.struggles || [];
    }
  );

  // AI STUDY PLANNER
  const { data: dailyPlanData, loading: planLoading } = useCachedFetch(
    user?.student_id ? `dash_daily_plan_${user.student_id}` : "dash_plan_none",
    async () => {
      if (!user?.student_id) return { plan: [] };
      const res = await getDailyStudyPlan(user.student_id);
      return res.data;
    }
  );

  const recs = recsData || [];
  const struggles = strugglesData || [];
  const topStruggle = struggles.length > 0 ? struggles[0] : null;
  const dailyPlan = dailyPlanData?.plan || [];

  const refreshAll = () => {
    refresh();
    if (user?.student_id) {
      localStorage.removeItem(`dash_daily_plan_${user.student_id}`);
    }
  };

  const prefetchRec = (rec) => {
    if (!user?.student_id) return;
    searchTopic(rec.concept_name, user.student_id, "medium").catch(() => {});
  };

  const handleOpenRec = async (rec) => {
    if (!user?.student_id) return;
    try {
      const res = await searchTopic(rec.concept_name, user.student_id, "medium");
      getTopicFull(res.data.topic_id).catch(() => {});
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAskAITutor = () => {
    if (!topStruggle) return;
    const prompt = `I'm struggling with "${topStruggle.concept_name}". My current score is ${topStruggle.score}%. Can you explain it to me in a simpler way with more examples?`;
    navigate(`/ai-tutor?prompt=${encodeURIComponent(prompt)}`);
  };

  const data = analyticsData;

  return (
    <div className="dashboard">
      <div className="dash-greeting-row">
        <div>
          <h1 className="dash-title">
            {getGreeting()}, <span className="dash-name">{user?.name || "Student"}</span> 👋
          </h1>
          <p className="dash-subtitle">Keep going. You're doing great.</p>
        </div>

        <button
          type="button"
          className="dash-refresh-btn"
          onClick={refreshAll}
          disabled={refreshing || planLoading}
          title="Refresh dashboard"
        >
          <RefreshCw size={16} className={refreshing || planLoading ? "spin" : ""} />
          <span>{refreshing || planLoading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {error && <div className="dash-error">{error}</div>}

      {/* 1. INTELLIGENT STRUGGLE ALERT (MOVED TO TOP) */}
      {topStruggle && (
        <div className="struggle-alert-card">
          <div className="struggle-icon">
            <Brain size={24} />
          </div>
          <div className="struggle-content">
            <h3>AI Tutor noticed you're struggling</h3>
            <p>
              You scored <strong>{topStruggle.score}%</strong> on{" "}
              <strong>{topStruggle.concept_name}</strong>. {topStruggle.reason}
            </p>
            <div className="struggle-actions">
              <button className="struggle-btn-primary" onClick={handleAskAITutor}>
                <MessageSquare size={14} /> Ask AI Tutor
              </button>
              <button
                className="struggle-btn-secondary"
                onClick={() => navigate(`/topic/${topStruggle.topic_id}`)}
              >
                Review Topic
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. AI DAILY STUDY PLAN */}
      {dailyPlan.length > 0 && (
        <div className="panel daily-plan-panel">
          <div className="panel-header">
            <h2 className="panel-title">📅 Today's Study Plan</h2>
            <span className="panel-subtitle">Customized for your {user?.daily_time_minutes || 30} min limit</span>
          </div>
          <div className="dash-daily-plan">
            {dailyPlan.map((task, idx) => (
              <div key={idx} className="dp-task">
                <div className="dp-task-icon">
                  {task.activity === "Read" && <BookOpen size={18} />}
                  {task.activity === "Quiz" && <Play size={18} />}
                  {task.activity === "Practice" && <Target size={18} />}
                </div>
                <div className="dp-task-info">
                  <h4>{task.activity}: {task.concept_name}</h4>
                  <p><Clock size={12} /> {task.duration_minutes} mins • {task.reason}</p>
                </div>
                <button 
                  className="btn-secondary dp-btn"
                  onClick={() => navigate(task.activity === "Quiz" ? `/quiz?topic=${task.topic_id}` : `/topic/${task.topic_id}`)}
                >
                  Start
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && !data && <p className="dash-muted">Loading dashboard...</p>}

      {data && (
        <>
          {/* 3. STATS */}
          <div className="dash-stats">
            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Concepts Tested</span>
                <span className="stat-icon stat-icon-blue">
                  <Target size={16} />
                </span>
              </div>
              <div className="stat-row">
                <div className="progress-ring">
                  <svg width="56" height="56" viewBox="0 0 56 56">
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="5"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="22"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={`${
                        data.total_concepts > 0
                          ? (data.concepts_tested / data.total_concepts) * 138.2
                          : 0
                      } 138.2`}
                      transform="rotate(-90 28 28)"
                    />
                  </svg>
                  <div className="progress-ring-text">
                    {data.total_concepts > 0
                      ? Math.round(
                          (data.concepts_tested / data.total_concepts) * 100
                        )
                      : 0}
                    %
                  </div>
                </div>
                <div className="stat-info">
                  <div className="stat-info-strong">
                    {data.concepts_tested} of {data.total_concepts}
                  </div>
                  <div className="stat-info-muted">concepts tested</div>
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Average Score</span>
                <span className="stat-icon stat-icon-green">
                  <TrendingUp size={16} />
                </span>
              </div>
              <div className="stat-value">{data.avg_score}%</div>
              <div className="stat-info-muted">
                across {data.concepts_tested} concept
                {data.concepts_tested === 1 ? "" : "s"}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Strong Concepts</span>
                <span className="stat-icon stat-icon-green">
                  <CheckCircle2 size={16} />
                </span>
              </div>
              <div className="stat-value stat-ok">
                {data.strong_concepts}
              </div>
              <div className="stat-info-muted">scoring ≥ 75%</div>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span className="stat-label">Weak Concepts</span>
                <span className="stat-icon stat-icon-orange">
                  <AlertTriangle size={16} />
                </span>
              </div>
              <div className="stat-value stat-risk">
                {data.weak_concepts}
              </div>
              <div className="stat-info-muted">need attention</div>
            </div>
          </div>

          {/* 4. RECOMMENDATIONS */}
          {recs.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title">🎯 Recommended for You</h2>
                <a href="/recommendations" className="panel-link">
                  View All →
                </a>
              </div>
              <div className="dash-recs">
                {recs.map((r, i) => (
                  <div
                    key={r.id}
                    className="dash-rec-item dash-rec-clickable"
                    onClick={() => handleOpenRec(r)}
                    onMouseEnter={() => prefetchRec(r)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenRec(r);
                      }
                    }}
                  >
                    <div className="dash-rec-rank">{i + 1}</div>
                    <div className="dash-rec-body">
                      <div className="dash-rec-name">{r.concept_name}</div>
                      <div className="dash-rec-reason">{r.reason}</div>
                    </div>
                    <div className="dash-rec-meta">
                      <span className="dash-rec-min">{r.suggested_minutes}m</span>
                      <span className="dash-rec-activity">{r.activity_type}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. PERFORMANCE */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Your Performance</h2>
            </div>

            {(!data.subject_performance ||
              data.subject_performance.length === 0) ? (
              <p className="dash-muted">No subjects yet.</p>
            ) : (
              <div className="perf-list">
                {data.subject_performance.map((s) => (
                  <div key={s.subject_name} className="perf-item">
                    <div className="perf-item-header">
                      <span className="perf-name">{s.subject_name}</span>
                      <span className="perf-score">{s.avg_score}%</span>
                    </div>
                    <div className="perf-bar">
                      <div
                        className="perf-fill"
                        style={{ width: `${s.avg_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. AI SUMMARY */}
          <div className="ai-reco-card">
            <div className="ai-reco-icon">
              <Sparkles size={20} />
            </div>
            <div>
              <div className="ai-reco-label">AI Recommendation</div>
              <div className="ai-reco-text">{data.ai_recommendation}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}