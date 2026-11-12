import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTopicFull, regenerateContent, analyzeTopic } from "../api/client";
import { useAuth } from "../context/AuthContext";
import Markdown from "../components/Markdown";
import MermaidDiagram from "../components/MermaidDiagram";
import ConceptModal from "../components/ConceptModal";
import RelatedTopics from "../components/RelatedTopics";
import ClickableTypes, { hasValidTypes } from "../components/ClickableTypes";
import { exportAnswerAsPdf } from "../utils/pdfExport";
import { useCachedFetch } from "../hooks/useCachedFetch";
import "../components/Markdown.css";
import {
  Sparkles,
  RefreshCw,
  ArrowLeft,
  Layers,
  BookOpen,
  Lightbulb,
  Target,
  Wrench,
  AlertTriangle,
  Link2,
  Play,
  Copy,
  Check,
  Download,
  Zap,
  Map,
  X,
  Info,
} from "lucide-react";
import "./TopicView.css";

export default function TopicView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const cacheKey = id ? `topic_full_v2_${id}` : null;

  const {
    data,
    loading,
    refreshing,
    error,
    refresh,
  } = useCachedFetch(
    cacheKey,
    async () => {
      const res = await getTopicFull(id);
      return res.data;
    },
    { ttl: 10 * 60 * 1000 } // 10 min
  );

  const [regenerating, setRegenerating] = useState(false);
  const [activeConcept, setActiveConcept] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Phase 5 — Intelligent Roadmap State
  const [analysis, setAnalysis] = useState(null);
  const [showRoadmapBanner, setShowRoadmapBanner] = useState(true);

  const contentRef = useRef(null);

  // Fetch roadmap analysis in the background when topic changes
  useEffect(() => {
    if (!id) return;
    setShowRoadmapBanner(true);
    
    analyzeTopic(id, user?.student_id)
      .then((res) => {
        const result = res.data.analysis;
        if (result && result.requires_roadmap) {
          setAnalysis(result);
        } else {
          setAnalysis(null);
        }
      })
      .catch(() => setAnalysis(null));
  }, [id, user?.student_id]);

  const handleRegenerate = async () => {
    if (
      !window.confirm(
        "Regenerate content? This creates a fresh version (~8 sec)."
      )
    )
      return;
    setRegenerating(true);
    try {
      await regenerateContent(id);
      await refresh(); // fetch fresh after regeneration
    } catch {
      // error handled in hook
    } finally {
      setRegenerating(false);
    }
  };

  const handleRefresh = async () => {
    await refresh();
  };

  const handleCopyAll = async () => {
    if (!contentRef.current) return;
    try {
      await navigator.clipboard.writeText(contentRef.current.innerText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      // silent
    }
  };

  const handleExportPdf = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      await exportAnswerAsPdf({
        title: data?.topic?.name || "Study Material",
        subtitle: data?.topic
          ? `${data.topic.subject_name} · ${data.topic.difficulty}`
          : "",
        sourceElement: contentRef.current,
        filename: `${
          data?.topic?.name?.replace(/\s+/g, "-").toLowerCase() || "topic"
        }.pdf`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setExporting(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/search");
    }
  };

  if (loading) {
    return (
      <div className="topic-loading">
        <div className="loading-spinner">
          <Sparkles size={28} />
        </div>
        <h2>Preparing your lesson...</h2>
        <p>This usually takes 5–15 seconds.</p>
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="topic-error-wrap">
        <div className="topic-error">{error}</div>
        <div className="topic-error-actions">
          <button className="btn-primary" onClick={handleRefresh}>
            <RefreshCw size={14} />
            Try Again
          </button>
          <button className="btn-secondary" onClick={() => navigate("/search")}>
            Back to Search
          </button>
          <button className="btn-secondary" onClick={() => navigate("/")}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { topic, content, concepts } = data;

  return (
    <div className="topic-view" ref={contentRef}>
      
      {/* Phase 5 — Minimized Roadmap Button (Section 5 of Vision) */}
      {analysis && !showRoadmapBanner && (
        <div className="trb-minimized" data-html2canvas-ignore="true">
          <button 
            className="trb-minimized-btn" 
            onClick={() => setShowRoadmapBanner(true)}
          >
            <Info size={16} />
            Prerequisite suggestion for {topic.name}
          </button>
        </div>
      )}

      {/* Phase 5 — Intelligent Roadmap Banner */}
      {analysis && showRoadmapBanner && (
        <div className="topic-roadmap-banner" data-html2canvas-ignore="true">
          <div className="trb-icon">
            <Map size={20} />
          </div>
          <div className="trb-content">
            <h3>We noticed this is a broad subject.</h3>
            <p>
              Before starting <strong>{topic.name}</strong>, we recommend checking out the prerequisites to build a stronger foundation.
            </p>
          </div>
          <div className="trb-actions">
            <button
              className="trb-btn-primary"
              onClick={() => navigate(`/roadmap/${id}`)}
            >
              View Full Roadmap
            </button>
            <button
              className="trb-btn-close"
              onClick={() => setShowRoadmapBanner(false)}
              title="Minimize"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="topic-header" data-html2canvas-ignore="true">
        <button className="topic-back" onClick={handleBack} type="button">
          <ArrowLeft size={16} /> Back
        </button>

        <div className="topic-title-row">
          <div>
            <div className="topic-subject-tag">{topic.subject_name}</div>
            <h1 className="topic-title">{topic.name}</h1>
            {content.tagline && (
              <p className="topic-tagline">{content.tagline}</p>
            )}
            <div className="topic-meta">
              <span className={`diff-pill diff-${topic.difficulty}`}>
                {topic.difficulty}
              </span>
              <span className="topic-meta-item">
                {concepts.length} concepts
              </span>
            </div>
          </div>

          <div className="topic-actions" data-html2canvas-ignore="true">
            <button
              className="btn-secondary"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh content"
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>

            <button
              className="btn-secondary"
              onClick={handleCopyAll}
              title="Copy all"
            >
              {copiedAll ? (
                <>
                  <Check size={14} /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </button>
            <button
              className="btn-secondary"
              onClick={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <>
                  <RefreshCw size={14} className="spin" /> Preparing...
                </>
              ) : (
                <>
                  <Download size={14} /> PDF
                </>
              )}
            </button>
            <button
              className="btn-secondary"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw size={14} className={regenerating ? "spin" : ""} />
              {regenerating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              className="btn-primary"
              onClick={() => navigate(`/quiz?topic=${id}`)}
            >
              <Play size={14} />
              Take Test
            </button>
          </div>
        </div>
      </div>

      {concepts.length > 0 && (
        <section className="topic-concepts-strip" data-html2canvas-ignore="true">
          <div className="strip-title">
            <Layers size={16} />
            Concepts in this topic
          </div>
          <div className="concept-chips">
            {concepts.map((c) => (
              <button
                key={c.id}
                type="button"
                className="concept-chip concept-chip-clickable"
                onClick={() => setActiveConcept(c)}
              >
                <span className="concept-chip-name">{c.name}</span>
                <span
                  className={`concept-chip-imp imp-${c.importance}`}
                  title={`Importance: ${c.importance}/5`}
                >
                  {c.importance}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {content.intro_md && (
        <Section icon={BookOpen} title="Introduction" accent="blue">
          <Markdown>{content.intro_md}</Markdown>
        </Section>
      )}

      {content.real_world_example_md && (
        <Section icon={Lightbulb} title="Real-World Example" accent="yellow">
          <div className="topic-highlight-block">
            <Markdown>{content.real_world_example_md}</Markdown>
          </div>
        </Section>
      )}

      {content.why_needed_md && (
        <Section
          icon={Target}
          title={`Why ${topic.name} Matters`}
          accent="purple"
        >
          <Markdown>{content.why_needed_md}</Markdown>
        </Section>
      )}

      {content.how_it_works_md && (
        <Section icon={Zap} title="How It Works" accent="orange">
          <Markdown>{content.how_it_works_md}</Markdown>
        </Section>
      )}

      {content.diagram_mermaid && content.diagram_mermaid.trim() && (
        <Section icon={Layers} title="Diagram" accent="purple">
          <MermaidDiagram code={content.diagram_mermaid} />
          {content.diagram_caption && (
            <p className="diagram-caption">{content.diagram_caption}</p>
          )}
        </Section>
      )}

      {hasValidTypes(content.types_md) && (
        <Section icon={Layers} title="Types & Variants" accent="blue">
          <ClickableTypes markdown={content.types_md} />
        </Section>
      )}

      {content.applications_md && (
        <Section icon={Target} title="Applications" accent="green">
          <Markdown>{content.applications_md}</Markdown>
        </Section>
      )}

      {content.challenges_md && (
        <Section icon={AlertTriangle} title="Challenges" accent="red">
          <Markdown>{content.challenges_md}</Markdown>
        </Section>
      )}

      {content.best_practices_md && (
        <Section icon={Wrench} title="Best Practices" accent="green">
          <Markdown>{content.best_practices_md}</Markdown>
        </Section>
      )}

      {content.related_topics_md && (
        <Section icon={Link2} title="Related Topics to Explore" accent="purple">
          <p className="rt-hint" data-html2canvas-ignore="true">
            Click any topic to open a full learning page on it.
          </p>
          <RelatedTopics markdown={content.related_topics_md} />
        </Section>
      )}

      <div className="topic-cta" data-html2canvas-ignore="true">
        <div>
          <h3>Ready to test your understanding?</h3>
          <p>
            Take a short test to see what stuck and what needs another look.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate(`/quiz?topic=${id}`)}
        >
          <Play size={16} />
          Start Test
        </button>
      </div>

      {activeConcept && (
        <ConceptModal
          concept={activeConcept}
          onClose={() => setActiveConcept(null)}
        />
      )}
    </div>
  );
}

function Section({ icon: Icon, title, accent, children }) {
  return (
    <section className="topic-section">
      <div className="section-heading">
        <div className={`section-heading-icon accent-${accent}`}>
          <Icon size={16} />
        </div>
        <h2 className="section-heading-text">{title}</h2>
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}