import { useState } from "react";
import { Image as ImageIcon, RefreshCw, AlertTriangle } from "lucide-react";
import "./AIDiagram.css";

/**
 * Renders an AI-generated diagram using Pollinations.ai (100% free).
 * URL format: https://image.pollinations.ai/prompt/{prompt}?width=...&seed=...
 */
function buildImageUrl(prompt, seed, width = 1024, height = 768) {
  if (!prompt) return "";
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed || 42),
    nologo: "true",
    model: "flux",
  });
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

export default function AIDiagram({ prompt, seed, caption }) {
  const [currentSeed, setCurrentSeed] = useState(seed || 42);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(0);

  if (!prompt) {
    return (
      <div className="ai-diagram-empty">
        <ImageIcon size={28} />
        <p>No diagram generated for this topic.</p>
        <p className="ai-diagram-empty-hint">
          Click "Regenerate" above to create one.
        </p>
      </div>
    );
  }

  const imageUrl = buildImageUrl(prompt, currentSeed) + `&cb=${cacheBuster}`;

  const handleRegenerate = () => {
    const newSeed = Math.floor(Math.random() * 999999) + 1;
    setCurrentSeed(newSeed);
    setLoading(true);
    setError(false);
    setCacheBuster(Date.now());
  };

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <div className="ai-diagram-wrap">
      <div className="ai-diagram-frame">
        {loading && (
          <div className="ai-diagram-loading">
            <div className="ai-diagram-spinner">
              <ImageIcon size={26} />
            </div>
            <p>Generating your diagram...</p>
            <p className="ai-diagram-hint">
              AI is painting this illustration (10–20 sec)
            </p>
          </div>
        )}

        {error && (
          <div className="ai-diagram-error">
            <AlertTriangle size={22} />
            <p>Could not load the diagram.</p>
            <button className="btn-secondary" onClick={handleRegenerate}>
              Try Again
            </button>
          </div>
        )}

        {!error && (
          <img
            key={cacheBuster}
            src={imageUrl}
            alt={caption || "AI-generated diagram"}
            className={`ai-diagram-img ${loading ? "hidden" : "visible"}`}
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
        )}
      </div>

      <div className="ai-diagram-footer">
        {caption && <p className="ai-diagram-caption">{caption}</p>}
        <button
          className="ai-diagram-refresh"
          onClick={handleRegenerate}
          title="Generate a different version"
        >
          <RefreshCw size={13} />
          Regenerate Diagram
        </button>
      </div>
    </div>
  );
}