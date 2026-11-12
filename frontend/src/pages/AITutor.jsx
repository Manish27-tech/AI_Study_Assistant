import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getChatModels,
  listConversations,
  createConversation,
  getConversation,
  updateConversation,
  deleteConversation,
  sendMessageFeedback,
  deleteMessage,
  streamChatMessage,
  uploadChatAttachment,
  listChatAttachments,
  deleteChatAttachment,
} from "../api/client";
import ChatMessageView from "../components/ChatMessageView";
import ModelSelector from "../components/ModelSelector";
import PremiumModal from "../components/PremiumModal";
import useVoiceInput from "../hooks/useVoiceInput";
import useVoiceOutput from "../hooks/useVoiceOutput";
import {
  Plus, Search, MessageSquare, MoreHorizontal, Pencil, Trash2, Pin, Send, Square,
  Sparkles, ChevronDown, ChevronsLeft, PanelLeftOpen, Menu, X, Loader2, Code2, FileText,
  Globe, Lightbulb, ListChecks, PenTool, Mic, MicOff, Paperclip, File as FileIcon, Home,
  LayoutDashboard, RefreshCw,
} from "lucide-react";
import "./AITutor.css";

const DEFAULT_MODEL = "groq-oss-120b";
const SIDEBAR_KEY = "nova_sidebar_collapsed";
const CONV_CACHE_KEY = "nova_conversations_cache_v2";

const SUGGESTIONS = [
  { icon: Lightbulb, label: "Explain a concept", prompt: "Explain quantum computing in simple terms." },
  { icon: Code2, label: "Write some code", prompt: "Write a Python function that reverses a string." },
  { icon: FileText, label: "Draft something", prompt: "Write a professional email asking for a meeting." },
  { icon: Globe, label: "Research a topic", prompt: "What are the latest trends in AI for 2025?" },
  { icon: ListChecks, label: "Create a plan", prompt: "Give me a 7-day plan to learn Python." },
  { icon: PenTool, label: "Brainstorm ideas", prompt: "Give me 10 side project ideas for a CS student." },
];

export default function AITutor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPrompt = searchParams.get("prompt");

  const [conversations, setConversations] = useState(() => {
    try {
      const raw = localStorage.getItem(CONV_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.data || [];
    } catch { return []; }
  });

  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [refreshingConvs, setRefreshingConvs] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [premiumModalModel, setPremiumModalModel] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_KEY) === "true";
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchTimer, setSearchTimer] = useState(null);
  const [menuConvId, setMenuConvId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasFetchedRef = useRef(false);
  const hasSentInitialPrompt = useRef(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed ? "true" : "false");
  }, [sidebarCollapsed]);

  const voiceInput = useVoiceInput({
    onResult: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
  });
  const voiceOutput = useVoiceOutput();

  useEffect(() => {
    getChatModels()
      .then((res) => setModels(res.data.models || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?.student_id) return;
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const cached = (() => {
      try {
        const raw = localStorage.getItem(CONV_CACHE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch { return null; }
    })();

    if (cached?.data?.length) {
      loadConversations("", { silent: true });
    } else {
      loadConversations("", { silent: false });
    }
  }, [user?.student_id]);

  useEffect(() => {
    if (initialPrompt && models.length > 0 && !hasSentInitialPrompt.current) {
      hasSentInitialPrompt.current = true;
      setTimeout(() => sendMessage(initialPrompt), 300);
    }
  }, [initialPrompt, models]);

  const loadConversations = async (q = "", { silent = false } = {}) => {
    if (!user?.student_id) return;
    if (!silent) {
      setRefreshingConvs(true);
      if (conversations.length === 0) setLoading(true);
    }
    try {
      const res = await listConversations(user.student_id, q);
      const list = res.data.conversations || [];
      setConversations(list);
      if (!q.trim()) {
        try {
          localStorage.setItem(CONV_CACHE_KEY, JSON.stringify({ student_id: user.student_id, data: list, fetchedAt: Date.now() }));
        } catch {}
      }
      setError("");
    } catch {
      if (conversations.length === 0) setError("Could not load conversations.");
    } finally {
      setLoading(false);
      setRefreshingConvs(false);
    }
  };

  useEffect(() => {
    if (!user?.student_id) return;
    if (!searchQuery.trim()) return;
    if (searchTimer) clearTimeout(searchTimer);
    const t = setTimeout(() => loadConversations(searchQuery), 350);
    setSearchTimer(t);
  }, [searchQuery]);

  useEffect(() => {
    if (!activeConvId || !user?.student_id) {
      setAttachments([]);
      return;
    }
    listChatAttachments(activeConvId, user.student_id)
      .then((res) => setAttachments(res.data.attachments || []))
      .catch(() => setAttachments([]));
  }, [activeConvId, user?.student_id]);

  const openConversation = async (convId) => {
    setActiveConvId(convId);
    setSidebarOpen(false);
    setError("");
    voiceOutput.stop();
    try {
      const res = await getConversation(convId, user.student_id);
      setMessages(res.data.messages || []);
      setSelectedModel(res.data.model || DEFAULT_MODEL);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: res.data.title } : c));
    } catch {
      setError("Could not load this conversation.");
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setInput("");
    setError("");
    setSidebarOpen(false);
    setAttachments([]);
    voiceOutput.stop();
  };

  const ensureConversation = async () => {
    if (activeConvId) return activeConvId;
    const res = await createConversation(user.student_id, "New chat", selectedModel);
    setActiveConvId(res.data.id);
    setConversations((prev) => [
      { id: res.data.id, title: res.data.title, model: res.data.model, pinned: false, preview: "", updated_at: res.data.created_at },
      ...prev,
    ]);
    return res.data.id;
  };

  const handleSidebarToggle = () => {
    if (window.innerWidth < 900) setSidebarOpen((o) => !o);
    else setSidebarCollapsed((c) => !c);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadFile = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("File too large. Max 10 MB."); return; }
    setUploading(true);
    setUploadProgress("Uploading...");
    setError("");
    try {
      const convId = await ensureConversation();
      setUploadProgress("Extracting text and generating embeddings...");
      const res = await uploadChatAttachment(convId, user.student_id, file);
      setAttachments((prev) => [...prev, res.data]);
      setUploadProgress("");
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || err.message || "Could not process this file. Try a different one.";
      setError(msg);
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  };

  const handleRemoveAttachment = async (attachmentId) => {
    try {
      await deleteChatAttachment(attachmentId, user.student_id);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch {
      setError("Could not remove file.");
    }
  };

  const sendMessage = async (overrideText) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

    setError("");
    setInput("");
    voiceOutput.stop();

    const tempUserId = `temp-${Date.now()}`;
    const tempAssistantId = `temp-a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, feedback: "" },
      { id: tempAssistantId, role: "assistant", content: "", feedback: "", sources: [], webSources: [] },
    ]);

    setStreaming(true);

    let convId;
    try {
      convId = await ensureConversation();
    } catch {
      setError("Could not create conversation.");
      setStreaming(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let streamedText = "";

    try {
      await streamChatMessage(
        convId, user.student_id, text, selectedModel,
        {
          user_message_id: (data) => setMessages((prev) => prev.map((m) => m.id === tempUserId ? { ...m, id: data.id } : m)),
          title: (data) => setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: data.title } : c)),
          sources: (data) => setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, sources: data.sources || [] } : m)),
          web_sources: (data) => setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, webSources: data.sources || [] } : m)),
          delta: (data) => {
            streamedText += data.content;
            setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, content: streamedText } : m));
            messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
          },
          done: (data) => setMessages((prev) => prev.map((m) => m.id === tempAssistantId ? { ...m, id: data.message_id || m.id } : m)),
          error: (data) => setError(data.message || "Streaming failed."),
        },
        controller.signal, { web_search: webSearchEnabled }
      );
    } catch (err) {
      if (err.name !== "AbortError") setError("Connection lost while streaming.");
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadConversations(searchQuery, { silent: true });
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setStreaming(false);
  };

  // BULLETPROOF ENTER KEY HANDLER
  const handleKeyDown = (e) => {
    // Check if Enter is pressed, Shift is NOT pressed, and the user isn't using an IME (like Chinese/Japanese input)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault(); // Stops the textarea from creating a new line
      e.stopPropagation(); // Stops the event from bubbling
      sendMessage(); // Triggers the send function
    }
  };

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  const handleRegenerate = async (assistantMsgId) => {
    if (streaming) return;
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    if (idx < 1) return;
    let userIdx = -1;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") { userIdx = i; break; }
    }
    if (userIdx === -1) return;
    const userText = messages[userIdx].content;
    const newMessages = messages.slice(0, idx);
    setMessages(newMessages);
    await sendMessage(userText);
  };

  const handleEditMessage = async (msgId, newContent) => {
    if (streaming) return;
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;
    const newMessages = messages.slice(0, idx);
    setMessages(newMessages);
    await sendMessage(newContent);
  };

  const handleFeedback = async (msgId, feedback) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, feedback } : m));
    try { await sendMessageFeedback(msgId, user.student_id, feedback); } catch {}
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(msgId, user.student_id);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch { setError("Could not delete message."); }
  };

  const startRename = (conv) => { setRenamingId(conv.id); setRenameValue(conv.title); setMenuConvId(null); };
  const submitRename = async (convId) => {
    const newTitle = renameValue.trim();
    setRenamingId(null);
    if (!newTitle) return;
    setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, title: newTitle } : c));
    try { await updateConversation(convId, user.student_id, { title: newTitle }); } catch { setError("Could not rename."); }
  };

  const togglePin = async (conv) => {
    const newVal = !conv.pinned;
    setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, pinned: newVal } : c));
    setMenuConvId(null);
    try { await updateConversation(conv.id, user.student_id, { pinned: newVal }); loadConversations(searchQuery, { silent: true }); } catch { setError("Could not pin."); }
  };

  const handleDeleteConversation = async (conv) => {
    setMenuConvId(null);
    if (!window.confirm(`Delete "${conv.title}"? This cannot be undone.`)) return;
    try {
      await deleteConversation(conv.id, user.student_id);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (activeConvId === conv.id) { setActiveConvId(null); setMessages([]); setAttachments([]); }
    } catch { setError("Could not delete conversation."); }
  };

  useEffect(() => {
    const handler = () => setMenuConvId(null);
    if (menuConvId) {
      document.addEventListener("click", handler);
      return () => document.removeEventListener("click", handler);
    }
  }, [menuConvId]);

  const handleModelChange = (modelId, isLocked) => {
    if (isLocked) {
      const m = models.find((x) => x.id === modelId);
      setPremiumModalModel(m?.label || "Premium Model");
    } else {
      setSelectedModel(modelId);
    }
  };

  const currentModel = models.find((m) => m.id === selectedModel);

  return (
    <div className={`nova-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className={`nova-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="nova-sidebar-head">
          <div className="nova-brand">
            <div className="nova-brand-mark">N</div>
            <span className="nova-brand-text">NovaAI</span>
          </div>
          <button type="button" className="nova-icon-btn nova-sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <X size={18} />
          </button>
          <button type="button" className="nova-sidebar-collapse-btn" onClick={() => setSidebarCollapsed(true)} title="Collapse sidebar">
            <ChevronsLeft size={18} />
          </button>
        </div>

        <button type="button" className="nova-new-chat" onClick={startNewChat}>
          <Plus size={18} strokeWidth={3} /><span>New chat</span>
        </button>

        <div className="nova-search">
          <Search size={14} />
          <input type="text" placeholder="Search conversations..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <button type="button" className="nova-conv-refresh" onClick={() => loadConversations(searchQuery)} disabled={refreshingConvs} title="Refresh conversations">
            <RefreshCw size={12} className={refreshingConvs ? "spin" : ""} />
          </button>
        </div>

        <div className="nova-conv-list">
          {loading && conversations.length === 0 && <div className="nova-conv-empty"><Loader2 size={16} className="spin" /></div>}
          {!loading && conversations.length === 0 && <div className="nova-conv-empty-text">{searchQuery ? "No matches" : "No conversations yet"}</div>}

          {conversations.map((conv) => (
            <div key={conv.id} className={`nova-conv-item ${conv.id === activeConvId ? "active" : ""}`} onClick={() => openConversation(conv.id)}>
              {renamingId === conv.id ? (
                <input type="text" className="nova-rename-input" value={renameValue} autoFocus onChange={(e) => setRenameValue(e.target.value)} onBlur={() => submitRename(conv.id)} onKeyDown={(e) => { if (e.key === "Enter") submitRename(conv.id); if (e.key === "Escape") setRenamingId(null); }} onClick={(e) => e.stopPropagation()} />
              ) : (
                <>
                  <MessageSquare size={14} className="nova-conv-icon" />
                  <div className="nova-conv-body"><div className="nova-conv-title">{conv.pinned && <Pin size={11} className="pin-icon" />}{conv.title}</div></div>
                  <button type="button" className="nova-conv-menu-btn" onClick={(e) => { e.stopPropagation(); setMenuConvId(menuConvId === conv.id ? null : conv.id); }} aria-label="Conversation options"><MoreHorizontal size={14} /></button>
                  {menuConvId === conv.id && (
                    <div className="nova-conv-menu" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => startRename(conv)}><Pencil size={12} /> Rename</button>
                      <button type="button" onClick={() => togglePin(conv)}><Pin size={12} /> {conv.pinned ? "Unpin" : "Pin"}</button>
                      <button type="button" className="danger" onClick={() => handleDeleteConversation(conv)}><Trash2 size={12} /> Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="nova-sidebar-foot">
          <button type="button" className="nova-dashboard-btn" onClick={() => navigate("/")} title="Back to Dashboard"><LayoutDashboard size={16} /><span>Back to Dashboard</span></button>
          <div className="nova-user">
            <div className="nova-user-avatar">{user?.avatar_url ? <img src={user.avatar_url} alt="You" /> : <span>{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>}</div>
            <div className="nova-user-meta"><div className="nova-user-name">{user?.name || "You"}</div><div className="nova-user-sub">Free plan</div></div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="nova-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />}

      <main className="nova-main">
        <header className="nova-topbar">
          <button type="button" className="nova-icon-btn nova-home-btn" onClick={() => navigate("/")} title="Back to Dashboard" aria-label="Back to Dashboard"><Home size={18} /></button>
          <button type="button" className="nova-icon-btn nova-hamburger" onClick={handleSidebarToggle} aria-label="Toggle sidebar" title={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <Menu size={18} />}</button>

          <div className="nova-topbar-model">
             <ModelSelector models={models} selectedModel={selectedModel} onChange={handleModelChange} />
          </div>

          <div className="nova-topbar-actions">
            <button type="button" className="nova-icon-btn" onClick={startNewChat} title="New chat"><Plus size={18} /></button>
          </div>
        </header>

        <div className="nova-content">
          {error && <div className="nova-error"><span>{error}</span><button type="button" onClick={() => setError("")}><X size={14} /></button></div>}

          {messages.length === 0 ? (
            <div className="nova-welcome">
              <div className="nova-welcome-orb-container">
                <div className="nova-welcome-orb"></div>
                <div className="nova-welcome-mark">N</div>
              </div>
              <h1 className="nova-welcome-title">How can I help you today?</h1>
              <p className="nova-welcome-sub">{currentModel?.description || "I'm NovaAI, your personal study assistant."}</p>
              
              <div className="nova-suggestions">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} type="button" className="nova-sugg" onClick={() => sendMessage(s.prompt)}>
                      <div className="nova-sugg-icon-wrap"><Icon size={18} /></div>
                      <div className="nova-sugg-body"><div className="nova-sugg-label">{s.label}</div><div className="nova-sugg-prompt">{s.prompt}</div></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="nova-messages">
              {messages.map((m) => (
                <ChatMessageView key={m.id} message={m} isStreaming={streaming && m.id === messages[messages.length - 1]?.id} onRegenerate={handleRegenerate} onEdit={handleEditMessage} onFeedback={handleFeedback} onDelete={handleDeleteMessage} onSpeak={voiceOutput.supported ? voiceOutput.speak : undefined} isSpeaking={voiceOutput.speakingId === m.id} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="nova-composer-wrap">
          {(attachments.length > 0 || uploading) && (
            <div className="nova-attachments">
              {attachments.map((a) => (
                <div key={a.id} className="nova-attachment">
                  <FileIcon size={14} /><span className="nova-attachment-name">{a.filename}</span><span className="nova-attachment-meta">{a.chunk_count} chunks</span>
                  <button type="button" className="nova-attachment-remove" onClick={() => handleRemoveAttachment(a.id)} aria-label={`Remove ${a.filename}`}><X size={12} /></button>
                </div>
              ))}
              {uploading && <div className="nova-attachment uploading"><Loader2 size={14} className="spin" /><span className="nova-attachment-name">{uploadProgress || "Uploading..."}</span></div>}
            </div>
          )}

          <div className="nova-composer" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
            <button type="button" className="nova-mic-btn" onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={streaming || uploading}><Paperclip size={18} /></button>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp" onChange={handleFileSelect} style={{ display: "none" }} />
            <button type="button" className={`nova-mic-btn ${webSearchEnabled ? "active" : ""}`} onClick={() => setWebSearchEnabled((v) => !v)} title={webSearchEnabled ? "Web search ON" : "Web search OFF"} disabled={streaming}><Globe size={18} /></button>
            {voiceInput.supported && <button type="button" className={`nova-mic-btn ${voiceInput.listening ? "listening" : ""}`} onClick={voiceInput.toggle} title={voiceInput.listening ? "Stop listening" : "Speak"} disabled={streaming}>{voiceInput.listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
            
            <textarea 
              ref={textareaRef} 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder={voiceInput.listening ? "Listening..." : attachments.length > 0 ? `Ask about ${attachments[0].filename}...` : webSearchEnabled ? "Ask anything — web search is ON..." : "Message NovaAI..."} 
              rows={1} 
              disabled={streaming} 
            />

            {streaming ? <button type="button" className="nova-send-btn nova-stop-btn" onClick={stopStreaming} title="Stop generating"><Square size={16} fill="currentColor" /></button> : <button type="button" className="nova-send-btn" onClick={() => sendMessage()} disabled={!input.trim()} title="Send"><Send size={18} /></button>}
          </div>

          {voiceInput.listening && voiceInput.interim && <div className="nova-voice-preview"><Mic size={12} /> {voiceInput.interim}</div>}
          {voiceInput.error && <p className="nova-composer-hint nova-composer-hint-error">{voiceInput.error}</p>}
          <p className="nova-composer-hint">{webSearchEnabled && <span className="nova-web-hint">🌐 Web search enabled · </span>}NovaAI can make mistakes. Check important information.{attachments.length > 0 && " Answers may reference your uploaded files."}</p>
        </div>
      </main>

      <PremiumModal isOpen={!!premiumModalModel} onClose={() => setPremiumModalModel(null)} modelName={premiumModalModel} />
    </div>
  );
}