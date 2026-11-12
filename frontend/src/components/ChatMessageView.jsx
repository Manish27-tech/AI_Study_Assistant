import { useState, memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "../context/ThemeContext";
import {
  Copy,
  Check,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  Volume2,
  VolumeX,
  FileText,
  Globe,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import "./ChatMessageView.css";

/* ---------- Code block ---------- */
function CodeBlock({ language, value }) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isLong = value.split("\n").length > 20;
  const displayValue =
    isLong && !expanded
      ? value.split("\n").slice(0, 20).join("\n") + "\n..."
      : value;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="nv-code">
      <div className="nv-code-head">
        <span className="nv-code-lang">{language || "text"}</span>
        <button
          type="button"
          className="nv-code-copy"
          onClick={handleCopy}
          aria-label="Copy code"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={theme === "dark" ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: "14px 16px",
          background: "transparent",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {displayValue}
      </SyntaxHighlighter>
      {isLong && (
        <button
          type="button"
          className="nv-code-expand"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? (
            <>
              <ChevronUp size={13} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={13} /> Show more ({value.split("\n").length} lines)
            </>
          )}
        </button>
      )}
    </div>
  );
}

/* ---------- User message ---------- */
function UserMessage({ message, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const submitEdit = () => {
    const t = draft.trim();
    if (!t || t === message.content) {
      setEditing(false);
      setDraft(message.content);
      return;
    }
    setEditing(false);
    onEdit?.(message.id, t);
  };

  return (
    <div className="nv-msg nv-msg-user">
      <div className="nv-msg-avatar nv-avatar-user">
        <User size={14} />
      </div>
      <div className="nv-msg-body">
        {editing ? (
          <div className="nv-edit-wrap">
            <textarea
              className="nv-edit-textarea"
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitEdit();
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setDraft(message.content);
                }
              }}
            />
            <div className="nv-edit-actions">
              <button
                type="button"
                className="nv-btn-ghost"
                onClick={() => {
                  setEditing(false);
                  setDraft(message.content);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="nv-btn-primary"
                onClick={submitEdit}
              >
                Send
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="nv-user-bubble">{message.content}</div>
            <div className="nv-msg-actions nv-actions-user">
              <button type="button" onClick={copy} title="Copy">
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              {onEdit && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(message.id)}
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Assistant message ---------- */
function AssistantMessage({
  message,
  isStreaming,
  onRegenerate,
  onFeedback,
  onDelete,
  onSpeak,
  isSpeaking,
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const hasContent = !!message.content;

  return (
    <div className="nv-msg nv-msg-assistant">
      <div className="nv-msg-avatar nv-avatar-assistant">N</div>
      <div className="nv-msg-body">
{/* Web sources */}
{message.webSources?.length > 0 && (
  <div className="nv-web-sources">
    <div className="nv-web-sources-label">
      <Globe size={12} /> Web sources
    </div>
    <div className="nv-sources">
      {message.webSources.map((s, i) => (
        <a
          key={i}
          className="nv-web-source-chip"
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.snippet}
        >
          <span className="nv-web-source-num">{i + 1}</span>
          <span className="nv-web-source-title">{s.title}</span>
        </a>
      ))}
    </div>
  </div>
)}

{/* File sources */}
{message.sources?.length > 0 && (
  <div className="nv-sources">
    {message.sources.map((s, i) => (
      <div key={i} className="nv-source-chip" title={s.snippet}>
        <FileText size={11} />
        <span>{s.filename}</span>
        <span className="nv-source-meta">· chunk {s.chunk_index}</span>
      </div>
    ))}
  </div>
)}

        <div className="nv-md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || "");
                const value = String(children).replace(/\n$/, "");
                if (!inline && (match || value.includes("\n"))) {
                  return <CodeBlock language={match?.[1]} value={value} />;
                }
                return (
                  <code className="nv-inline-code" {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {message.content || (isStreaming ? "" : "_(empty)_")}
          </ReactMarkdown>
          {isStreaming && <span className="nv-cursor" />}
        </div>

        {hasContent && !isStreaming && (
          <div className="nv-msg-actions nv-actions-assistant">
            <button type="button" onClick={copy} title="Copy">
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                title="Regenerate"
              >
                <RefreshCw size={13} />
              </button>
            )}
            {onSpeak && (
              <button
                type="button"
                onClick={() => onSpeak(message.content, message.id)}
                title={isSpeaking ? "Stop" : "Read aloud"}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
              </button>
            )}
            {onFeedback && (
              <>
                <button
                  type="button"
                  className={message.feedback === "up" ? "active" : ""}
                  onClick={() =>
                    onFeedback(
                      message.id,
                      message.feedback === "up" ? "" : "up"
                    )
                  }
                  title="Good response"
                >
                  <ThumbsUp size={13} />
                </button>
                <button
                  type="button"
                  className={message.feedback === "down" ? "active" : ""}
                  onClick={() =>
                    onFeedback(
                      message.id,
                      message.feedback === "down" ? "" : "down"
                    )
                  }
                  title="Bad response"
                >
                  <ThumbsDown size={13} />
                </button>
              </>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(message.id)}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Dispatcher ---------- */
function ChatMessageView({
  message,
  isStreaming,
  onRegenerate,
  onEdit,
  onFeedback,
  onDelete,
  onSpeak,
  isSpeaking,
}) {
  if (message.role === "user") {
    return (
      <UserMessage message={message} onEdit={onEdit} onDelete={onDelete} />
    );
  }
  return (
    <AssistantMessage
      message={message}
      isStreaming={isStreaming}
      onRegenerate={onRegenerate}
      onFeedback={onFeedback}
      onDelete={onDelete}
      onSpeak={onSpeak}
      isSpeaking={isSpeaking}
    />
  );
}

export default memo(ChatMessageView);