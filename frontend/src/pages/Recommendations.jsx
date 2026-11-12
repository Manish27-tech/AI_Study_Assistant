import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getRecommendationsList,
  generateRecommendations,
  completeRecommendation,
  searchTopic,
  getTopicFull,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  RefreshCw,
  Clock,
  BookOpen,
  HelpCircle,
  Eye,
  PenTool,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  Lightbulb,
  Loader2,
} from "lucide-react";
import "./Recommendations.css";

const CACHE_KEY = "recs_cache_v1";

export default function Recommendations() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);
  const navigate = useNavigate();

  // ==================================================
  // Instant from cache + silent background refresh
  // ==================================================
  useEffect(() => {
    if (!user?.student_id) return;

    // Step 1: Instant from cache
    let hasCache = false;
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.student_id === user.student_id) {
        setData(cached.data);
        hasCache = true;
        setLoading(false);
      }
    } catch {
      // ignore
    }

    // Step 2: Background refresh
    refreshRecommendations(!hasCache);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const refreshRecommendations = async (showLoading = false) => {
    if (!user?.student_id) return;
    if (showLoading) setLoading(true);
    setError("");

    try {
      const res = await getRecommendationsList(user.student_id);
      setData(res.data);
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            student_id: user.student_id,
            data: res.data,
            fetchedAt: Date.now(),
          })
        );
      } catch {
        // ignore storage errors
      }
    } catch (err) {
      if (!data) setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError("");
    try {
      await generateRecommendations(user.student_id, true);
      // Clear cache so next load fetches fresh
      localStorage.removeItem(CACHE_KEY);
      await refreshRecommendations(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleComplete = async (e, recId) => {
    e.stopPropagation();
    try {
      await completeRecommendation(recId, user.student_id);
      // Optimistic update: remove from list immediately
      setData((prev) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          total: prev.total - 1,
          recommendations: prev.recommendations.filter((r) => r.id !== recId),
        };
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              student_id: user.student_id,
              data: updated,
              fetchedAt: Date.now(),
            })
          );
        } catch {
          // ignore
        }
        return updated;
      });
    } catch {
      setError("Could not mark complete");
    }
  };

  const prefetch = (rec) => {
    if (!user?.student_id) return;
    searchTopic(rec.concept_name, user.student_id, "medium").catch(() => {});
  };

  const handleOpenConcept = async (rec) => {
    if (!user?.student_id || openingId) return;
    setOpeningId(rec.id);
    setError("");
    try {
      const res = await searchTopic(
        rec.concept_name,
        user.student_id,
        "medium"
      );
      getTopicFull(res.data.topic_id).catch(() => {});
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Could not open this topic. Please try again."
      );
      setOpeningId(null);
    }
  };

  const activityIcon = (type) => {
    if (type === "read") return <BookOpen size={14} />;
    if (type === "practice") return <PenTool size={14} />;
    if (type === "quiz") return <HelpCircle size={14} />;
    if (type === "revise") return <Eye size={14} />;
    return <Sparkles size={14} />;
  };

  const trendIcon = (t) => {
    if (t === "improving") return <TrendingUp size={11} />;
    if (t === "declining") return <TrendingDown size={11} />;
    return <Minus size={11} />;
  };

  const priorityClass = (p) => {
    if (p >= 75) return "prio-critical";
    if (p >= 55) return "prio-high";
    if (p >= 35) return "prio-medium";
    return "prio-low";
  };

  const priorityLabel = (p) => {
    if (p >= 75) return "Critical";
    if (p >= 55) return "High";
    if (p >= 35) return "Medium";
    return "Low";
  };

  return (
    <div className="recs-page">
      <div className="recs-header">
        <div>
          <h1 className="recs-title">Your Recommendations</h1>
          <p className="recs-subtitle">
            Click any card to open a full learning page on that concept.
          </p>
        </div>
        <div className="recs-controls">
          <button
            className="btn-regenerate"
            onClick={handleRegenerate}
            disabled={regenerating || loading}
          >
            <RefreshCw size={14} className={regenerating ? "spin" : ""} />
            {regenerating ? "Recalculating..." : "Recalculate"}
          </button>
        </div>
      </div>

      {error && <div className="recs-error">{error}</div>}
      {loading && !data && (
        <p className="recs-muted">Loading recommendations...</p>
      )}

      {data && data.total === 0 && (
        <div className="recs-empty">
          <Lightbulb size={40} />
          <p>No recommendations yet.</p>
          <p className="recs-empty-hint">
            Take a test on any topic to get personalized suggestions.
          </p>
        </div>
      )}

      {data && data.total > 0 && (
        <>
          <div className="recs-summary">
            <div className="recs-summary-item">
              <Sparkles size={16} />
              <div>
                <div className="recs-summary-label">Recommended items</div>
                <div className="recs-summary-value">{data.total}</div>
              </div>
            </div>
            <div className="recs-summary-item">
              <Clock size={16} />
              <div>
                <div className="recs-summary-label">Total suggested time</div>
                <div className="recs-summary-value">
                  {data.total_minutes} min
                </div>
              </div>
            </div>
          </div>

          <div className="recs-list">
            {data.recommendations.map((r) => (
              <div
                key={r.id}
                className="rec-card rec-card-clickable"
                onClick={() => handleOpenConcept(r)}
                onMouseEnter={() => prefetch(r)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOpenConcept(r);
                  }
                }}
              >
                <div className="rec-card-top">
                  <span className={`prio-badge ${priorityClass(r.priority)}`}>
                    {priorityLabel(r.priority)} · {Math.round(r.priority)}
                  </span>
                </div>

                <h3 className="rec-concept">{r.concept_name}</h3>
                <div className="rec-topic">
                  {r.subject_name} → {r.topic_name}
                </div>

                <div className="rec-scores">
                  <div className="rec-score-item">
                    <div className="rec-score-label">Score</div>
                    <div className="rec-score-value">
                      {Math.round(r.score)}%
                    </div>
                  </div>
                  <div className="rec-score-item">
                    <div className="rec-score-label">Trend</div>
                    <div className={`rec-trend trend-${r.trend}`}>
                      {trendIcon(r.trend)} {r.trend}
                    </div>
                  </div>
                  <div className="rec-score-item">
                    <div className="rec-score-label">Importance</div>
                    <div className="rec-score-value">{r.importance}/5</div>
                  </div>
                </div>

                <div className="rec-reason">💡 {r.reason}</div>

                <div className="rec-activity">
                  <span className="rec-activity-chip">
                    {activityIcon(r.activity_type)}
                    {r.activity_type}
                  </span>
                  <span className="rec-activity-chip">
                    <Clock size={14} /> {r.suggested_minutes} min
                  </span>
                </div>

                <div className="rec-actions">
                  <button
                    className="btn-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenConcept(r);
                    }}
                    disabled={openingId === r.id}
                  >
                    {openingId === r.id ? (
                      <>
                        <Loader2 size={14} className="spin" /> Opening...
                      </>
                    ) : (
                      <>
                        <BookOpen size={14} /> Open Content
                      </>
                    )}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={(e) => handleComplete(e, r.id)}
                  >
                    <Check size={14} /> Mark Done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}