import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Preprocess markdown:
 * - Fix literal \n, \t escapes → real chars
 * - Repair broken LaTeX (\text mangled into TAB + ext)
 */
function preprocess(text) {
  if (!text || typeof text !== "string") return text;

  let s = text;

  // Double-escaped → real newline
  s = s.replace(/\\\\n/g, "\n");
  s = s.replace(/\\n/g, "\n");
  s = s.replace(/\\\\t/g, "\t");
  s = s.replace(/\\t/g, "\t");
  s = s.replace(/\\r/g, "");

  // Repair mangled LaTeX from JSON escape collisions
  s = s.replace(/\t\u200b?ext/g, "\\text");
  s = s.replace(/\text/g, "\\text");
  s = s.replace(/\times/g, "\\times");
  s = s.replace(/\theta/g, "\\theta");
  s = s.replace(/\frac/g, "\\frac");
  s = s.replace(/\sqrt/g, "\\sqrt");
  s = s.replace(/\alpha/g, "\\alpha");
  s = s.replace(/\beta/g, "\\beta");
  s = s.replace(/\rho/g, "\\rho");
  s = s.replace(/\right/g, "\\right");
  s = s.replace(/\left/g, "\\left");

  // Fix "ext{s.t.}" leftover patterns
  s = s.replace(/ext\{/g, "\\text{");
  s = s.replace(/exts\.t\./g, "\\text{ s.t. }");
  s = s.replace(/extfor(\w+)/g, "\\text{ for $1}");

  return s;
}

export default function Markdown({ children }) {
  if (!children) return null;
  const content = preprocess(String(children));

  return (
    <div className="md-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}