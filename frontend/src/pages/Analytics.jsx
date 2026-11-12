import { useEffect, useState } from "react";
import { getAnalyticsTimeline } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
} from "recharts";
import {
  TrendingUp,
  Activity,
  Target,
  Award,
  BarChart3,
  Calendar,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import "./Analytics.css";

const CACHE_KEY = "analytics_cache_v1";

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState(30);

  useEffect(() => {
    if (!user?.student_id) return;

    // Instant from cache (only for default range)
    let hasCache = false;
    if (range === 30) {
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
    }

    refresh(hasCache && range === 30);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id, range]);

  const refresh = async (silent = false) => {
    if (!user?.student_id) return;
    if (!silent) setLoading(true);
    setError("");

    try {
      const res = await getAnalyticsTimeline(user.student_id, range);
      setData(res.data);
      if (range === 30) {
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
      }
    } catch (err) {
      if (!data) setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  const tooltipStyle = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    fontSize: 12,
    padding: "8px 12px",
  };

  return (
    <div className="analytics-page">
      {/* HEADER */}
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-subtitle">
            Track your learning activity and progress over time.
          </p>
        </div>

        <div className="analytics-controls">
          <select value={range} onChange={(e) => setRange(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="analytics-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && !data && (
        <div className="analytics-loading">
          <Loader2 size={24} className="spin" />
          <p>Loading analytics...</p>
        </div>
      )}

      {data && (
        <>
          {/* HEADLINE STATS */}
          <div className="analytics-stats">
            <div className="astat">
              <div className="astat-icon icon-blue">
                <Target size={16} />
              </div>
              <div>
                <div className="astat-label">Avg Score</div>
                <div className="astat-value">{data.headline.avg_score}%</div>
              </div>
            </div>

            <div className="astat">
              <div className="astat-icon icon-green">
                <Activity size={16} />
              </div>
              <div>
                <div className="astat-label">Tests Taken</div>
                <div className="astat-value">{data.headline.total_tests}</div>
              </div>
            </div>

            <div className="astat">
              <div className="astat-icon icon-purple">
                <Award size={16} />
              </div>
              <div>
                <div className="astat-label">Questions Answered</div>
                <div className="astat-value">
                  {data.headline.total_questions}
                </div>
              </div>
            </div>

            <div className="astat">
              <div className="astat-icon icon-orange">
                <Calendar size={16} />
              </div>
              <div>
                <div className="astat-label">Active Days</div>
                <div className="astat-value">
                  {data.headline.active_days} / {data.period_days}
                </div>
              </div>
            </div>
          </div>

          {/* SCORE TREND */}
          <div className="analytics-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Score Trend</h2>
                <p className="panel-sub">
                  Daily average score over the last {data.period_days} days
                </p>
              </div>
              <div className="panel-icon icon-blue">
                <TrendingUp size={16} />
              </div>
            </div>

            {data.headline.total_questions === 0 ? (
              <div className="analytics-empty">
                No quiz activity yet. Take a test to see your trend.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={data.daily_scores}>
                  <defs>
                    <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={11}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="var(--text-muted)"
                    fontSize={11}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    fill="url(#scoreGradient)"
                    dot={{ r: 3, fill: "var(--primary)" }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ACTIVITY + WEEKLY CONCEPTS */}
          <div className="analytics-columns">
            <div className="analytics-panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">Questions per Day</h2>
                  <p className="panel-sub">Activity volume</p>
                </div>
                <div className="panel-icon icon-purple">
                  <BarChart3 size={16} />
                </div>
              </div>

              {data.headline.total_questions === 0 ? (
                <div className="analytics-empty">No activity yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.daily_scores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      stroke="var(--text-muted)"
                      fontSize={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="questions"
                      fill="var(--purple)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="analytics-panel">
              <div className="panel-head">
                <div>
                  <h2 className="panel-title">New Concepts Tested</h2>
                  <p className="panel-sub">Last 6 weeks</p>
                </div>
                <div className="panel-icon icon-green">
                  <TrendingUp size={16} />
                </div>
              </div>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.concepts_progress}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    stroke="var(--text-muted)"
                    fontSize={11}
                  />
                  <YAxis stroke="var(--text-muted)" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line
                    type="monotone"
                    dataKey="concepts"
                    stroke="var(--success)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "var(--success)" }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* TOPIC BREAKDOWN */}
          <div className="analytics-panel">
            <div className="panel-head">
              <div>
                <h2 className="panel-title">Subject Performance</h2>
                <p className="panel-sub">
                  Average score per subject based on concepts tested
                </p>
              </div>
            </div>

            {data.topic_breakdown.length === 0 ? (
              <div className="analytics-empty">No subjects yet.</div>
            ) : (
              <div className="subject-bars">
                {data.topic_breakdown.map((s) => (
                  <div key={s.subject_name} className="subject-bar-row">
                    <div className="subject-bar-header">
                      <span className="subject-bar-name">{s.subject_name}</span>
                      <span className="subject-bar-stats">
                        {s.concepts_count} concepts · {s.avg_score}%
                      </span>
                    </div>
                    <div className="subject-bar-track">
                      <div
                        className="subject-bar-fill"
                        style={{ width: `${s.avg_score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}