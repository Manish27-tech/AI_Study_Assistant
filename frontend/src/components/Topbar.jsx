import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Search,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  X,
  AlertTriangle,
  Target,
  Flame,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { getNotifications } from "../api/client";
import "./Topbar.css";

const CACHE_KEY = "notifs_cache";
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export default function Topbar({ onMenuClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("read_notifs") || "[]");
    } catch {
      return [];
    }
  });

  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const searchInputRef = useRef(null);

  const initial = user?.name?.charAt(0)?.toUpperCase() || "U";
  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;

  // ==================================================
  // Instant load from cache + silent refresh
  // ==================================================
  useEffect(() => {
    if (!user?.student_id) return;

    // ---- Step 1: Instant from cache ----
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      if (cached && cached.student_id === user.student_id) {
        setNotifications(cached.notifications || []);
      }
    } catch {
      // ignore cache errors
    }

    // ---- Step 2: Fetch fresh in background ----
    refreshNotifications(true);

    // ---- Step 3: Refresh every 60s while app is open ----
    const interval = setInterval(() => refreshNotifications(false), CACHE_TTL_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.student_id]);

  const refreshNotifications = async (isInitial = false) => {
    if (!user?.student_id) return;

    // Skip if cache is fresh and this isn't an initial load
    if (!isInitial) {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
      } catch {
        // proceed
      }
    }

    try {
      const res = await getNotifications(user.student_id);
      const data = res.data;
      setNotifications(data.notifications || []);
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          student_id: user.student_id,
          notifications: data.notifications || [],
          fetchedAt: Date.now(),
        })
      );
    } catch (err) {
      console.warn("Notification refresh failed:", err);
    }
  };

  // ==================================================
  // Manual refresh when panel opens
  // ==================================================
  useEffect(() => {
    if (notifOpen && user?.student_id) {
      refreshNotifications(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifOpen]);

  // Close menus on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-focus search input
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [searchOpen]);

  // Escape closes everything
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds(allIds);
    localStorage.setItem("read_notifs", JSON.stringify(allIds));
  };

  const handleNotifClick = (notif) => {
    const updated = [...new Set([...readIds, notif.id])];
    setReadIds(updated);
    localStorage.setItem("read_notifs", JSON.stringify(updated));

    if (notif.topic_id) navigate(`/topic/${notif.topic_id}`);
    else if (notif.link) navigate(notif.link);
    setNotifOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault?.();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const getIcon = (type) => {
    if (type === "risk") return AlertTriangle;
    if (type === "recommendation") return Target;
    if (type === "streak") return Flame;
    return Sparkles;
  };

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} />
      </button>

      {/* ---------- SEARCH ---------- */}
      <div className={`topbar-search ${searchOpen ? "open" : ""}`} ref={searchRef}>
        {!searchOpen ? (
          <button
            className="topbar-search-trigger"
            onClick={() => setSearchOpen(true)}
            aria-label="Open search"
            title="Search"
          >
            <Search size={18} />
          </button>
        ) : (
          <form className="topbar-search-box" onSubmit={handleSearchSubmit}>
            <Search size={16} className="topbar-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search any topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              type="button"
              className="topbar-search-close"
              onClick={() => {
                setSearchQuery("");
                setSearchOpen(false);
              }}
              aria-label="Close search"
            >
              <X size={16} />
            </button>
          </form>
        )}
      </div>

      {/* ---------- RIGHT ACTIONS ---------- */}
      <div className="topbar-actions">
        <button className="icon-btn" onClick={toggle} title="Toggle theme">
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* ---------- NOTIFICATIONS ---------- */}
        <div className="notif-wrap" ref={notifRef}>
          <button
            className="icon-btn"
            onClick={() => setNotifOpen((o) => !o)}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="badge-dot">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="notif-panel">
              <div className="notif-header">
                <div className="notif-header-title">
                  <Bell size={15} />
                  Notifications
                  {unreadCount > 0 && (
                    <span className="notif-count">{unreadCount} new</span>
                  )}
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button className="notif-mark-all" onClick={markAllRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="notif-body">
                {notifications.length === 0 && (
                  <div className="notif-empty">
                    <CheckCircle2 size={32} />
                    <p>You're all caught up!</p>
                  </div>
                )}

                {notifications.map((n) => {
                  const Icon = getIcon(n.type);
                  const isRead = readIds.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      className={`notif-item ${isRead ? "read" : "unread"} notif-type-${n.type}`}
                      onClick={() => handleNotifClick(n)}
                    >
                      <div className={`notif-icon notif-icon-${n.type}`}>
                        <Icon size={16} />
                      </div>
                      <div className="notif-content">
                        <div className="notif-title">{n.title}</div>
                        <div className="notif-text">{n.body}</div>
                        <div className="notif-meta">
                          <span className="notif-action">{n.action} →</span>
                        </div>
                      </div>
                      {!isRead && <span className="notif-dot" />}
                    </button>
                  );
                })}
              </div>

              <div className="notif-footer">
                <button
                  className="notif-footer-btn"
                  onClick={() => {
                    setNotifOpen(false);
                    navigate("/gaps");
                  }}
                >
                  View Knowledge Gaps
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ---------- USER MENU ---------- */}
        <div className="user-menu-wrap" ref={menuRef}>
          <div className="user-chip" onClick={() => setMenuOpen((o) => !o)}>
            <div className="avatar">{initial}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name || "Student"}</div>
              <div className="user-role">Student</div>
            </div>
          </div>

          {menuOpen && (
            <div className="user-menu">
              <div className="user-menu-header">
                <div className="user-menu-avatar">{initial}</div>
                <div>
                  <div className="user-menu-name">{user?.name}</div>
                  <div className="user-menu-email">{user?.email}</div>
                </div>
              </div>
              <button
                className="user-menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/settings");
                }}
              >
                <User size={15} />
                Profile
              </button>
              <button className="user-menu-item danger" onClick={handleLogout}>
                <LogOut size={15} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}