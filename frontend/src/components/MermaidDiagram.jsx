import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import "./MermaidDiagram.css";

let mermaidInitialized = false;

function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    securityLevel: "loose",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    themeVariables: {
      background: "#ffffff",
      primaryTextColor: "#1e293b",
      lineColor: "#94a3b8",
      fontSize: "14px",
      fontFamily: "'Inter', system-ui, sans-serif",

      // Default node styling — soft & clean
      primaryColor: "#eff6ff",
      primaryBorderColor: "#3b82f6",
      primaryTextColor: "#1e3a8a",

      // Secondary
      secondaryColor: "#f0fdf4",
      secondaryBorderColor: "#22c55e",
      secondaryTextColor: "#14532d",

      // Tertiary
      tertiaryColor: "#fef3c7",
      tertiaryBorderColor: "#f59e0b",
      tertiaryTextColor: "#78350f",

      // Cluster (subgraph)
      clusterBkg: "#f8fafc",
      clusterBorder: "#cbd5e1",

      // Notes
      noteBkgColor: "#fef3c7",
      noteTextColor: "#78350f",
      noteBorderColor: "#fbbf24",
    },
    flowchart: {
      curve: "basis",
      padding: 24,
      nodeSpacing: 50,
      rankSpacing: 60,
      htmlLabels: true,
      useMaxWidth: true,
    },
    sequence: {
      useMaxWidth: true,
      actorMargin: 60,
      boxMargin: 12,
    },
  });
  mermaidInitialized = true;
}

function sanitizeMermaid(code) {
  if (!code) return "";
  let cleaned = code.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:mermaid)?\s*\n?/, "");
    cleaned = cleaned.replace(/\n?```\s*$/, "");
  }

  cleaned = cleaned.replace(/;\s*$/gm, "");

  cleaned = cleaned.replace(/\[([^\]]+)\]/g, (match, inner) => {
    let fixed = inner
      .replace(/[()]/g, "")
      .replace(/:/g, " -")
      .replace(/;/g, ",")
      .replace(/["']/g, "")
      .trim();
    return `[${fixed}]`;
  });

  cleaned = cleaned.split("\n").filter((l) => l.trim()).join("\n");
  return cleaned;
}

function buildFallbackDiagram(originalCode) {
  if (!originalCode) return "";
  const labels = [];
  const re = /\[([^\]]+)\]/g;
  let m;
  while ((m = re.exec(originalCode)) !== null) {
    const label = m[1].replace(/[()"':;]/g, "").trim();
    if (label && label.length < 50 && !labels.includes(label)) labels.push(label);
  }
  if (labels.length < 2) return "";
  const used = labels.slice(0, 8);
  let code = "flowchart LR\n";
  used.forEach((label, i) => {
    const safe = label.replace(/[()"':;{}[\]|]/g, "").trim();
    code += `    N${i}["${safe}"]\n`;
  });
  for (let i = 0; i < used.length - 1; i++) {
    code += `    N${i} --> N${i + 1}\n`;
  }
  return code;
}

export default function MermaidDiagram({ code }) {
  const containerRef = useRef(null);
  const [state, setState] = useState("loading");
  const [renderedCode, setRenderedCode] = useState("");

  useEffect(() => {
    if (!code || !containerRef.current) return;
    let cancelled = false;

    const tryRender = async (rawCode) => {
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      const { svg } = await mermaid.render(id, rawCode.trim());
      return svg;
    };

    const render = async () => {
      initMermaid();
      setState("loading");
      const sanitized = sanitizeMermaid(code);

      try {
        const svg = await tryRender(sanitized);
        if (cancelled) return;
        containerRef.current.innerHTML = svg;
        setState("rendered");
        return;
      } catch (e1) {
        console.warn("Mermaid attempt 1 failed:", e1?.message || e1);
      }

      try {
        const fallback = buildFallbackDiagram(code);
        if (fallback) {
          const svg = await tryRender(fallback);
          if (cancelled) return;
          containerRef.current.innerHTML = svg;
          setState("fallback");
          return;
        }
      } catch (e2) {
        console.warn("Mermaid attempt 2 failed:", e2?.message || e2);
      }

      if (!cancelled) {
        setRenderedCode(sanitizeMermaid(code));
        setState("error");
        if (containerRef.current) containerRef.current.innerHTML = "";
      }
    };

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (state === "error") {
    return (
      <div className="mermaid-fallback">
        <div className="mermaid-fallback-note">
          ℹ️ We couldn't render this diagram, but here's the flow:
        </div>
        <pre className="mermaid-code"><code>{renderedCode}</code></pre>
      </div>
    );
  }

  return (
    <div className="mermaid-wrap">
      <div
        ref={containerRef}
        aria-label="Concept diagram"
        className="mermaid-canvas"
        style={{ display: state === "loading" ? "none" : "block" }}
      />
      {state === "loading" && (
        <div className="mermaid-loading">Rendering diagram...</div>
      )}
      {state === "fallback" && (
        <div className="mermaid-fallback-badge">Simplified view</div>
      )}
    </div>
  );
}