import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchTopic, getTopicFull } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { ArrowRight, Loader2, Link2 } from "lucide-react";
import "./RelatedTopics.css";

function parseRelatedTopics(md) {
  if (!md) return [];
  const lines = md.split("\n");
  const items = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const match = line.match(/^[-*]\s+\*\*(.+?):?\*\*[:\s—\-]*(.*)$/);
    if (match) {
      const name = match[1].trim().replace(/:$/, "");
      const description = match[2].trim().replace(/^[—\-:]\s*/, "");
      if (name) items.push({ name, description });
      continue;
    }

    const plain = line.match(/^[-*]\s+(.+)$/);
    if (plain) {
      items.push({ name: plain[1].trim(), description: "" });
    }
  }
  return items;
}

export default function RelatedTopics({ markdown }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState("");

  const items = parseRelatedTopics(markdown);

  if (items.length === 0) {
    return <p className="rt-empty">No related topics available.</p>;
  }

  // Hover prefetch — pre-create the topic so click is instant
  const prefetch = (name) => {
    if (!user?.student_id) return;
    searchTopic(name, user.student_id, "medium").catch(() => {});
  };

  const handleClick = async (name) => {
    if (!user?.student_id || opening) return;
    setOpening(name);
    setError("");
    try {
      const res = await searchTopic(name, user.student_id, "medium");
      // Fire-and-forget prefetch of full content
      getTopicFull(res.data.topic_id).catch(() => {});
      navigate(`/topic/${res.data.topic_id}`);
    } catch (err) {
      setError(
        err.response?.data?.detail || `Could not open "${name}". Try again.`
      );
      setOpening(null);
    }
  };

  return (
    <div className="rt-wrap">
      {error && <div className="rt-error">{error}</div>}

      <div className="rt-grid">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            className={`rt-card ${opening === item.name ? "rt-opening" : ""}`}
            onClick={() => handleClick(item.name)}
            onMouseEnter={() => prefetch(item.name)}
            onFocus={() => prefetch(item.name)}
            disabled={opening !== null}
          >
            <div className="rt-card-icon">
              <Link2 size={14} />
            </div>

            <div className="rt-card-body">
              <div className="rt-card-name">{item.name}</div>
              {item.description && (
                <div className="rt-card-desc">{item.description}</div>
              )}
            </div>

            <div className="rt-card-arrow">
              {opening === item.name ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <ArrowRight size={14} />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}