import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchTopic, getTopicFull } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";
import "./ClickableTypes.css";

export function parseTypes(md) {
  if (!md) return [];
  const trimmed = md.trim().toLowerCase();
  // Reject LLM's "no types" fallbacks
  if (
    trimmed === "" ||
    trimmed === "none" ||
    trimmed.startsWith("no types") ||
    trimmed.includes("no types available")
  ) {
    return [];
  }

  const lines = md.split("\n");
  const items = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const header = line.match(/^###\s*(?:Type\s*\d+\s*[:.\-–—]\s*)?(.+)$/i);
    if (header) {
      if (current) items.push(current);
      const fullLabel = header[1].trim();
      const splitMatch = fullLabel.match(/^(Type\s*\d+)\s*[:.\-–—]\s*(.+)$/i);
      if (splitMatch) {
        current = {
          label: splitMatch[1].trim(),
          name: splitMatch[2].trim(),
          description: "",
        };
      } else {
        current = { label: "", name: fullLabel, description: "" };
      }
      continue;
    }

    if (current) {
      current.description = current.description
        ? `${current.description} ${line}`
        : line;
    }
  }

  if (current) items.push(current);
  return items;
}

export function hasValidTypes(md) {
  return parseTypes(md).length > 0;
}

export default function ClickableTypes({ markdown }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [opening, setOpening] = useState(null);
  const [error, setError] = useState("");

  const items = parseTypes(markdown);

  if (items.length === 0) {
    return null;
  }

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
    <div className="ct-wrap">
      {error && <div className="ct-error">{error}</div>}

      <div className="ct-list">
        {items.map((item, i) => (
          <div key={i} className="ct-item">
            <h3 className="ct-heading">
              {item.label && <span className="ct-label">{item.label}: </span>}
              <button
                type="button"
                className={`ct-link ${opening === item.name ? "ct-opening" : ""}`}
                onClick={() => handleClick(item.name)}
                onMouseEnter={() => prefetch(item.name)}
                onFocus={() => prefetch(item.name)}
                disabled={opening !== null}
                title={`Open full learning page for ${item.name}`}
              >
                {item.name}
                {opening === item.name && (
                  <Loader2 size={13} className="ct-spin" />
                )}
              </button>
            </h3>

            {item.description && (
              <p className="ct-desc">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}