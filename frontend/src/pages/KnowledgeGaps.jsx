import { useEffect, useState } from "react";
import { getStudentConcepts } from "../api/client";
import { useAuth } from "../context/AuthContext";
import ConceptModal from "../components/ConceptModal";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Brain,
} from "lucide-react";
import "./KnowledgeGaps.css";

const CACHE_KEY = "gaps_cache_v1";

export default function KnowledgeGaps() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeConcept, setActiveConcept] = useState(null);

  useEffect(() => {
    if (!user?.student_id) return;

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

    refreshGaps(!hasCache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const refreshGaps = async (showLoading = false) => {
    if (!user?.student_id) return;
    if (showLoading) setLoading(true);
    setError("");

    try {
      const res = await getStudentConcepts(user.student_id);
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
        // ignore
      }
    } catch (err) {
      if (!data) setError("Failed to load concept data");
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (t) => {
    if (t === "improving") return <TrendingUp size={12} />;
    if (t === "declining") return <TrendingDown size={12} />;
    return <Minus size={12} />;
  };

  const scoreClass = (score) => {
    if (score >= 75) return "gap-good";
    if (score >= 50) return "gap-mid";
    return "gap-weak";
  };

  const allConcepts = (data?.topics || []).flatMap((t) =>
    t.concepts.map((c) => ({
      ...c,
      topic_id: t.topic_id,
      topic_name: t.topic_name,
      subject_name: t.subject_name,
    }))
  );

  const filtered = allConcepts.filter((c) => {
    if (filter === "all") return true;
    if (filter === "weak") return c.score < 50;
    if (filter === "strong") return c.score >= 75;
    if (filter === "improving") return c.trend === "improving";
    if (filter === "declining") return c.trend === "declining";
    if (filter === "at_risk") return c.at_risk === true;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.score - b.score);

  const total = allConcepts.length;
  const weak = allConcepts.filter((c) => c.score < 50).length;
  const strong = allConcepts.filter((c) => c.score >= 75).length;
  const improving = allConcepts.filter((c) => c.trend === "improving").length;
  const atRisk = allConcepts.filter((c) => c.at_risk === true).length;

  // Build a concept object for ConceptModal
  const openConceptDeepDive = (c) => {
    setActiveConcept({
      id: c.concept_id,
      name: c.concept_name,
      description: c.description || "",
    });
  };

  return (
    <div className="gaps-page">
      <div className="gaps-header">
        <div>
          <h1 className="gaps-title">Knowledge Gaps</h1>
          <p className="gaps-subtitle">
            Click any concept to open its deep-dive explanation.
          </p>
        </div>

        <div className="gaps-controls">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Concepts</option>
            <option value="at_risk">🔴 At Risk (ML)</option>
            <option value="weak">⚪ Weak (&lt; 50%)</option>
            <option value="strong">🟢 Strong (≥ 75%)</option>
            <option value="improving">📈 Improving</option>
            <option value="declining">📉 Declining</option>
          </select>
        </div>
      </div>

      {error && <div className="gaps-error">{error}</div>}
      {loading && !data && <p className="gaps-muted">Loading...</p>}

      {data && total === 0 && (
        <div className="gaps-empty">
          <Target size={40} />
          <p>No concept data yet.</p>
          <p className="gaps-empty-hint">
            Take a test to start tracking your concept mastery.
          </p>
        </div>
      )}

      {data && total > 0 && (
        <>
          <div className="gaps-stats">
            <div className="gap-stat">
              <div className="gap-stat-icon icon-blue">
                <BookOpen size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Total Concepts</div>
                <div className="gap-stat-value">{total}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-green">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Strong</div>
                <div className="gap-stat-value">{strong}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-orange">
                <TrendingUp size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Improving</div>
                <div className="gap-stat-value">{improving}</div>
              </div>
            </div>

            <div className="gap-stat">
              <div className="gap-stat-icon icon-red">
                <AlertTriangle size={16} />
              </div>
              <div>
                <div className="gap-stat-label">Weak</div>
                <div className="gap-stat-value">{weak}</div>
              </div>
            </div>
          </div>

          {atRisk > 0 && (
            <div className="ml-summary-strip">
              <div className="ml-summary-icon">
                <Brain size={18} />
              </div>
              <div>
                <div className="ml-summary-title">ML Risk Analysis</div>
                <div className="ml-summary-text">
                  Your Random Forest model flagged{" "}
                  <b>
                    {atRisk} concept{atRisk === 1 ? "" : "s"}
                  </b>{" "}
                  as at-risk based on score, attempts, and topic difficulty.
                </div>
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            <p className="gaps-muted">No concepts match this filter.</p>
          ) : (
            <div className="gap-list">
              {sorted.map((c) => (
                <div
                  key={`${c.topic_id}-${c.concept_id}`}
                  className={`gap-item gap-item-clickable ${
                    c.at_risk ? "gap-item-risk" : ""
                  }`}
                  onClick={() => openConceptDeepDive(c)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openConceptDeepDive(c);
                    }
                  }}
                >
                  <div className="gap-item-left">
                    <div className={`gap-score ${scoreClass(c.score)}`}>
                      {Math.round(c.score)}%
                    </div>
                    <div className="gap-info">
                      <div className="gap-name-row">
                        <span className="gap-name">{c.concept_name}</span>
                        {c.at_risk !== undefined && (
                          <span
                            className={`ml-badge ${
                              c.at_risk ? "ml-badge-risk" : "ml-badge-ok"
                            }`}
                            title={`ML confidence: ${
                              c.risk_confidence
                            } · ${Math.round(
                              (c.risk_probability || 0) * 100
                            )}% risk probability`}
                          >
                            <Brain size={10} />
                            {c.at_risk ? "At Risk" : "On Track"}
                          </span>
                        )}
                      </div>
                      <div className="gap-topic">
                        {c.subject_name} → {c.topic_name}
                      </div>
                    </div>
                  </div>

                  <div className="gap-item-right">
                    <span
                      className={`gap-trend trend-${c.trend}`}
                      title={`Trend: ${c.trend}`}
                    >
                      {trendIcon(c.trend)}
                      {c.trend}
                    </span>
                    <div className="gap-meta">
                      {c.correct}/{c.attempts} correct
                    </div>
                    <div className="gap-confidence">
                      <div className="gap-confidence-bar">
                        <div
                          className="gap-confidence-fill"
                          style={{ width: `${c.confidence * 100}%` }}
                        />
                      </div>
                      <span className="gap-confidence-label">
                        {Math.round(c.confidence * 100)}% confident
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Concept Deep-Dive Modal */}
      {activeConcept && (
        <ConceptModal
          concept={activeConcept}
          onClose={() => setActiveConcept(null)}
        />
      )}
    </div>
  );
}