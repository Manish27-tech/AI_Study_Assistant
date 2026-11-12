import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { searchTopic, getSearchHistory, deleteHistoryEntry, clearHistory } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../hooks/useCachedFetch";
import {
  Search as SearchIcon, Sparkles, Lightbulb, AlertTriangle,
  Loader2, History, X, Trash2, ChevronDown, BookOpen, TrendingUp, ArrowRight,
} from "lucide-react";
import "./Search.css";

const FIELDS = [
  "AI", "Machine Learning", "Deep Learning", "Data Science", "Data Analytics",
  "Web Development", "Python", "Java", "JavaScript", "DSA", "Cloud Computing",
  "Cybersecurity", "DevOps", "Blockchain", "SQL", "Operating Systems",
  "Computer Networks", "NLP", "Computer Vision", "IoT", "UX Design",
  "Mobile App Development", "Game Development", "AR VR",
];

const POPULAR = new Set(["AI", "Machine Learning", "Data Science", "Python", "Web Development", "DSA"]);
const VISIBLE_COUNT = 12;

export default function Search() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fieldsExpanded, setFieldsExpanded] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const autoTriggered = useRef(false);
  const searchRef = useRef(null);

  // Cached History Fetch
  const { data: historyData } = useCachedFetch(
    user?.student_id ? `search_history_${user.student_id}` : null,
    async () => {
      if (!user?.student_id) return [];
      const res = await getSearchHistory(user.student_id, 15);
      return res.data.history || [];
    }
  );

  const history = historyData || [];

  // Auto-search from ?q=
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoTriggered.current) {
      autoTriggered.current = true;
      setQuery(q);
      setTimeout(() => performSearch(q), 80);
    }
  }, [searchParams]);

  // Close suggestion dropdown on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const performSearch = async (topicName) => {
    const name = (topicName ?? query).trim();
    if (!name || !user?.student_id || loading) return;

    setLoading(true);
    setError("");
    setShowSuggestions(false);

    try {
      const res = await searchTopic(name, user.student_id, "medium");
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed. Try again.");
      setLoading(false);
    }
  };

  const handleSubmit = (e) => { e.preventDefault(); performSearch(); };
  const handleFieldClick = (field) => { setQuery(`${field} Tutorial`); performSearch(`${field} Tutorial`); };

  const handleDeleteEntry = async (e, entryId) => {
    e.stopPropagation();
    try {
      await deleteHistoryEntry(entryId, user.student_id);
      localStorage.removeItem(`search_history_${user.student_id}`); // Invalidate cache
      // Optimistically update UI
      window.dispatchEvent(new Event("reload_search_history")); 
    } catch {}
  };

  const handleClearAll = async () => {
    if (!window.confirm("Clear all search history?")) return;
    try {
      await clearHistory(user.student_id);
      localStorage.removeItem(`search_history_${user.student_id}`);
      window.dispatchEvent(new Event("reload_search_history"));
      setHistoryOpen(false);
    } catch {}
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const autocompleteMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return FIELDS.filter((f) => f.toLowerCase().includes(q) && f.toLowerCase() !== q).slice(0, 6);
  }, [query]);

  const matchingChips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return new Set();
    return new Set(FIELDS.filter((f) => f.toLowerCase().includes(q)));
  }, [query]);

  const visibleFields = fieldsExpanded ? FIELDS : FIELDS.slice(0, VISIBLE_COUNT);

  return (
    <div className="search-page">
      <div className="search-hero">
        <div className="search-hero-icon"><Sparkles size={28} /></div>
        <h1 className="search-hero-title">Learn Anything, Conceptually</h1>
        <p className="search-hero-subtitle">Type any topic. Get comprehensive, structured content and a concept-level test.</p>
      </div>

      <div className="search-box-wrap" ref={searchRef}>
        <form className="search-box" onSubmit={handleSubmit}>
          <SearchIcon size={20} className="search-box-icon" />
          <input type="text" placeholder="Search" value={query} onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} autoFocus disabled={loading} />
          <button type="submit" className="search-box-btn" disabled={loading || !query.trim()}>
            {loading ? <><Loader2 size={14} className="spin" /> Searching...</> : "Search"}
          </button>
        </form>

        {showSuggestions && autocompleteMatches.length > 0 && (
          <div className="autocomplete-panel">
            {autocompleteMatches.map((f) => (
              <button key={f} type="button" className="autocomplete-item" onClick={() => { setQuery(f); performSearch(f); }}>
                <SearchIcon size={14} /><span className="autocomplete-text">{f}</span><ArrowRight size={14} className="autocomplete-arrow" />
              </button>
            ))}
          </div>
        )}

        {history.length > 0 && !showSuggestions && (
          <div className="history-row">
            <button type="button" className="history-toggle" onClick={() => setHistoryOpen((o) => !o)}>
              <History size={14} />{historyOpen ? "Hide" : "Show"} recent searches ({history.length})
            </button>
          </div>
        )}

        {historyOpen && history.length > 0 && !showSuggestions && (
          <div className="history-panel">
            <div className="history-header">
              <span className="history-title">Recent Searches</span>
              <button type="button" className="history-clear" onClick={handleClearAll}><Trash2 size={12} /> Clear all</button>
            </div>
            <div className="history-list">
              {history.map((h) => (
                <div key={h.id} className="history-item" onClick={() => navigate(`/topic/${h.topic_id}`)} role="button" tabIndex={0}>
                  <History size={14} className="history-item-icon" />
                  <div className="history-item-body">
                    <div className="history-item-name">{h.topic_name}</div>
                    <div className="history-item-meta">{h.subject_name} · {formatTime(h.searched_at)}</div>
                  </div>
                  <button type="button" className="history-item-delete" onClick={(e) => handleDeleteEntry(e, h.id)} title="Remove"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="search-error"><AlertTriangle size={16} /><span>{error}</span></div>}

      <div className="search-suggestions">
        <div className="suggestions-header">
          <div className="suggestions-title"><Lightbulb size={16} /> Try one of these</div>
          <div className="suggestions-count">{visibleFields.length} of {FIELDS.length}</div>
        </div>
        <div className="suggestions-grid">
          {visibleFields.map((f) => {
            const isPopular = POPULAR.has(f);
            const isMatch = matchingChips.has(f);
            return (
              <button key={f} type="button" className={`suggestion-chip ${isPopular ? "chip-popular" : ""} ${isMatch ? "chip-match" : ""}`} onClick={() => handleFieldClick(f)} disabled={loading}>
                {isPopular && <TrendingUp size={13} className="chip-icon" />}<span className="chip-label">{f}</span>
              </button>
            );
          })}
        </div>
        {FIELDS.length > VISIBLE_COUNT && (
          <div className="suggestions-toggle-row">
            <button type="button" className="suggestions-toggle" onClick={() => setFieldsExpanded((v) => !v)}>
              <ChevronDown size={14} className={`suggestions-chevron ${fieldsExpanded ? "flipped" : ""}`} />
              <span>{fieldsExpanded ? "Show less" : "Show all fields"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}