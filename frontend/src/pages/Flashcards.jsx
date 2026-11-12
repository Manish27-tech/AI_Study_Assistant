import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getEnrichedTopics,
  generateFlashcards,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCachedFetch } from "../hooks/useCachedFetch";
import {
  Layers,
  RefreshCw,
  Loader2,
  Sparkles,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Check,
  ArrowRight,
} from "lucide-react";
import "./Flashcards.css";

export default function Flashcards() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentCard, setCurrentCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const cacheKey = user?.student_id
    ? `flashcard_topics_${user.student_id}`
    : null;

  const {
    data: topics,
    loading,
    refreshing,
    error,
    refresh,
  } = useCachedFetch(
    cacheKey,
    async () => {
      if (!user?.student_id) return [];
      const res = await getEnrichedTopics(user.student_id);
      return res.data || [];
    },
    { enabled: !!user?.student_id }
  );

  const loadFlashcards = async (topic) => {
    if (!topic) return;
    setSelectedTopic(topic);
    setGenerating(true);
    setGenError("");
    setCards([]);
    setCurrentCard(0);
    setFlipped(false);

    try {
      const res = await generateFlashcards({
        topic_id: topic.id,
        num_cards: 10,
        force: false,
      });
      setCards(res.data.cards || []);
    } catch (err) {
      setGenError(
        err.response?.data?.detail ||
          err.message ||
          "Could not generate flashcards for this topic."
      );
    } finally {
      setGenerating(false);
    }
  };

  const nextCard = () => {
    if (currentCard < cards.length - 1) {
      setCurrentCard((i) => i + 1);
      setFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard((i) => i - 1);
      setFlipped(false);
    }
  };

  const toggleFlip = () => setFlipped((f) => !f);

  // Sort topics: recently updated first, then alphabetically
  const sortedTopics = useMemo(() => {
    if (!topics || !topics.length) return [];
    return [...topics].sort((a, b) => {
      const at = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      if (at !== bt) return bt - at;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [topics]);

  const hasTopics = sortedTopics.length > 0;

  return (
    <div className="flashcards-page">
      {/* ---------- HEADER ---------- */}
      <div className="fc-header">
        <div>
          <h1 className="fc-title">Flashcards</h1>
          <p className="fc-subtitle">
            Revise key facts with AI-generated flip cards.
          </p>
        </div>

        <button
          type="button"
          className="fc-refresh-btn"
          onClick={refresh}
          disabled={refreshing}
          title="Refresh topics"
        >
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="fc-error">{error}</div>}

      {/* ---------- TOPIC PICKER ---------- */}
      {!selectedTopic && (
        <>
          {loading && !hasTopics && (
            <div className="fc-loading">
              <Loader2 size={20} className="spin" />
              <span>Loading your topics...</span>
            </div>
          )}

          {!loading && !hasTopics && (
            <div className="fc-empty">
              <div className="fc-empty-icon">
                <Layers size={28} />
              </div>
              <h3>No topics yet</h3>
              <p>
                Search for a topic first. Flashcards are generated from your
                explored topics.
              </p>
              <button
                type="button"
                className="fc-btn-primary"
                onClick={() => navigate("/search")}
              >
                <Sparkles size={14} />
                Search a topic
              </button>
            </div>
          )}

          {hasTopics && (
            <>
              <div className="fc-section-title">
                YOUR TOPICS ({sortedTopics.length})
              </div>

              <div className="fc-topic-grid">
                {sortedTopics.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className="fc-topic-card"
                    onClick={() => loadFlashcards(t)}
                  >
                    <div className="fc-topic-subject">
                      {t.subject_name || "Explored Topics"}
                    </div>
                    <div className="fc-topic-name">{t.name}</div>
                    <div className="fc-topic-footer">
                      <span className="fc-topic-cta">
                        <Layers size={14} />
                        <span>Generate flashcards</span>
                        <ArrowRight size={14} className="fc-topic-arrow" />
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ---------- CARD VIEWER ---------- */}
      {selectedTopic && (
        <div className="fc-viewer">
          <div className="fc-viewer-head">
            <button
              type="button"
              className="fc-back-btn"
              onClick={() => setSelectedTopic(null)}
            >
              <ChevronLeft size={16} /> Topics
            </button>
            <div className="fc-viewer-topic">{selectedTopic.name}</div>
            <button
              type="button"
              className="fc-back-btn"
              onClick={() => loadFlashcards(selectedTopic)}
              disabled={generating}
              title="Regenerate cards"
            >
              <RotateCw size={14} className={generating ? "spin" : ""} />
            </button>
          </div>

          {generating && (
            <div className="fc-loading">
              <Loader2 size={20} className="spin" />
              <span>Generating flashcards...</span>
            </div>
          )}

          {genError && <div className="fc-error">{genError}</div>}

          {!generating && !genError && cards.length > 0 && (
            <>
              <div
                className={`fc-card ${flipped ? "flipped" : ""}`}
                onClick={toggleFlip}
              >
                <div className="fc-card-inner">
                  <div className="fc-card-face fc-card-front">
                    <div className="fc-card-label">Question</div>
                    <div className="fc-card-text">
                      {cards[currentCard].front}
                    </div>
                    <div className="fc-card-hint">
                      Click to reveal answer
                    </div>
                  </div>
                  <div className="fc-card-face fc-card-back">
                    <div className="fc-card-label">Answer</div>
                    <div className="fc-card-text">
                      {cards[currentCard].back}
                    </div>
                    {cards[currentCard].concept_name && (
                      <div className="fc-card-concept">
                        <Check size={12} /> {cards[currentCard].concept_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="fc-nav">
                <button
                  type="button"
                  className="fc-nav-btn"
                  onClick={prevCard}
                  disabled={currentCard === 0}
                >
                  <ChevronLeft size={16} /> Prev
                </button>

                <div className="fc-nav-counter">
                  {currentCard + 1} / {cards.length}
                </div>

                <button
                  type="button"
                  className="fc-nav-btn"
                  onClick={nextCard}
                  disabled={currentCard === cards.length - 1}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {!generating && !genError && cards.length === 0 && (
            <div className="fc-empty">
              <p>No cards generated. Try regenerating.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}