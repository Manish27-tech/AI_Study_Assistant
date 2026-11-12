import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateStudent,
  deleteStudent,
  exportStudentData,
  getProfileStats,
} from "../api/client";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import {
  User as UserIcon,
  Palette,
  Download,
  AlertTriangle,
  Check,
  Sun,
  Moon,
  Save,
  Camera,
  Trash2,
  MapPin,
  Globe,
  Link as LinkIcon,
  Code,
  Bell,
  BellOff,
  Clock,
} from "lucide-react";
import {
  getReminderSettings,
  saveReminderSettings,
  requestNotificationPermission,
  isNotificationSupported,
  sendTestNotification,
  DAY_NAMES,
} from "../utils/reminderService";
import "./Settings.css";

const INTEREST_OPTIONS = [
  "AI", "Machine Learning", "Deep Learning", "Data Science",
  "Web Development", "Mobile Development", "Game Development",
  "Cloud", "Cybersecurity", "DevOps", "DSA", "Python",
  "Java", "JavaScript", "SQL", "Blockchain",
  "UI/UX Design", "Product Management",
];

const LEARNING_STYLES = [
  { value: "", label: "Not set" },
  { value: "visual", label: "Visual (diagrams, charts)" },
  { value: "reading", label: "Reading (prose, docs)" },
  { value: "examples", label: "Examples (worked problems)" },
  { value: "practice", label: "Practice (hands-on, quizzes)" },
];

const EDUCATION_LEVELS = [
  { value: "", label: "Not set" },
  { value: "highschool", label: "High School" },
  { value: "undergrad", label: "Undergraduate" },
  { value: "grad", label: "Graduate" },
  { value: "self", label: "Self-taught" },
  { value: "prof", label: "Working Professional" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "bn", label: "বাংলা (Bengali)" },
  { value: "ta", label: "தமிழ் (Tamil)" },
  { value: "te", label: "తెలుగు (Telugu)" },
  { value: "es", label: "Español (Spanish)" },
  { value: "fr", label: "Français (French)" },
  { value: "de", label: "Deutsch (German)" },
  { value: "pt", label: "Português (Portuguese)" },
  { value: "it", label: "Italiano (Italian)" },
  { value: "ja", label: "日本語 (Japanese)" },
  { value: "ko", label: "한국어 (Korean)" },
  { value: "zh", label: "中文 (Chinese)" },
  { value: "ar", label: "العربية (Arabic)" },
  { value: "ru", label: "Русский (Russian)" },
];

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    course: "",
    bio: "",
    interests: "",
    avatar_url: "",
    preferred_learning_style: "",
    education_level: "",
    location: "",
    website: "",
    github: "",
    linkedin: "",
    preferred_language: "en",
  });
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ---------- Reminder state ----------
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [reminderDays, setReminderDays] = useState([1, 2, 3, 4, 5]);
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [reminderError, setReminderError] = useState("");
  const [reminderSuccess, setReminderSuccess] = useState("");

  // ---------- Load profile ----------
  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || "",
        email: user.email || "",
        course: user.course || "",
        bio: user.bio || "",
        interests: user.interests || "",
        avatar_url: user.avatar_url || "",
        preferred_learning_style: user.preferred_learning_style || "",
        education_level: user.education_level || "",
        location: user.location || "",
        website: user.website || "",
        github: user.github || "",
        linkedin: user.linkedin || "",
        preferred_language: user.preferred_language || "en",
      });
    }
  }, [user]);

  // ---------- Load stats ----------
  useEffect(() => {
    if (!user?.student_id) return;
    getProfileStats(user.student_id)
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, [user?.student_id]);

  // ---------- Load reminder settings ----------
  useEffect(() => {
    const s = getReminderSettings();
    setReminderEnabled(s.enabled);
    setReminderTime(s.time);
    setReminderDays(s.days);

    if (isNotificationSupported()) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const flash = (msg, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 2500);
  };

  const flashReminder = (msg, isError = false) => {
    if (isError) setReminderError(msg);
    else setReminderSuccess(msg);
    setTimeout(() => {
      setReminderError("");
      setReminderSuccess("");
    }, 2500);
  };

  // ---------- Avatar ----------
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      flash("Please select an image file.", true);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      flash("Image too large. Max 5 MB.", true);
      return;
    }

    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      setProfile((p) => ({ ...p, avatar_url: dataUrl }));
    } catch {
      flash("Could not process image.", true);
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resizeImage = (file, maxSize) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxSize) {
              h = (h * maxSize) / w;
              w = maxSize;
            }
          } else {
            if (h > maxSize) {
              w = (w * maxSize) / h;
              h = maxSize;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAvatar = () => {
    setProfile((p) => ({ ...p, avatar_url: "" }));
  };

  // ---------- Interests ----------
  const selectedInterests = profile.interests
    ? profile.interests.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleInterest = (interest) => {
    const current = new Set(selectedInterests);
    if (current.has(interest)) current.delete(interest);
    else current.add(interest);
    setProfile((p) => ({ ...p, interests: Array.from(current).join(", ") }));
  };

  // ---------- Save profile ----------
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.student_id) return;

    if (!profile.name.trim() || !profile.email.trim() || !profile.course.trim()) {
      flash("Name, email, and course are required.", true);
      return;
    }
    if (profile.bio && profile.bio.length > 200) {
      flash("Bio must be 200 characters or less.", true);
      return;
    }

    setSaving(true);
    try {
      const res = await updateStudent(user.student_id, profile);
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      localStorage.setItem(
        "user",
        JSON.stringify({ ...stored, ...res.data })
      );
      window.location.reload();
    } catch (err) {
      flash(err.response?.data?.detail || "Failed to save profile", true);
      setSaving(false);
    }
  };

  // ---------- Export ----------
  const handleExport = async () => {
    if (!user?.student_id) return;
    try {
      const res = await exportStudentData(user.student_id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `study-assistant-export-${user.student_id}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      flash("Data exported successfully!");
    } catch {
      flash("Export failed.", true);
    }
  };

  // ---------- Delete account ----------
  const handleDeleteAccount = async () => {
    if (!user?.student_id) return;
    const confirmText = window.prompt(
      `Type DELETE to permanently remove "${profile.name}" and all data:`
    );
    if (confirmText !== "DELETE") {
      flash("Delete cancelled.", true);
      return;
    }
    try {
      await deleteStudent(user.student_id);
      flash("Account deleted. Logging out...");
      setTimeout(() => {
        localStorage.removeItem("user");
        navigate("/login");
      }, 1500);
    } catch {
      flash("Failed to delete account.", true);
    }
  };

  // ---------- Reminder handlers ----------
  const handleToggleReminder = async () => {
    const newValue = !reminderEnabled;

    if (newValue) {
      const perm = await requestNotificationPermission();
      setNotificationPermission(perm);
      if (perm !== "granted") {
        flashReminder(
          "Please allow notifications in your browser to enable reminders.",
          true
        );
        return;
      }
    }

    setReminderEnabled(newValue);
    saveReminderSettings({
      enabled: newValue,
      time: reminderTime,
      days: reminderDays,
    });
    flashReminder(newValue ? "Reminders enabled" : "Reminders disabled");
  };

  const handleTimeChange = (newTime) => {
    setReminderTime(newTime);
    saveReminderSettings({
      enabled: reminderEnabled,
      time: newTime,
      days: reminderDays,
    });
  };

  const handleDayToggle = (dayIndex) => {
    const newDays = reminderDays.includes(dayIndex)
      ? reminderDays.filter((d) => d !== dayIndex)
      : [...reminderDays, dayIndex].sort();
    setReminderDays(newDays);
    saveReminderSettings({
      enabled: reminderEnabled,
      time: reminderTime,
      days: newDays,
    });
  };

  const handleTestReminder = () => {
    if (notificationPermission !== "granted") {
      flashReminder("Allow notifications first.", true);
      return;
    }
    const res = sendTestNotification();
    if (res.ok) {
      flashReminder("Test notification sent!");
    } else {
      flashReminder(res.error || "Could not send test.", true);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">
            Manage your profile, preferences, and data.
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-flash settings-flash-error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="settings-flash settings-flash-success">
          <Check size={16} /> {success}
        </div>
      )}

      {/* ==================================================
          PROFILE HERO
          ================================================== */}
      <section className="settings-section profile-hero">
        <div className="profile-hero-inner">
          <div className="avatar-wrap">
            <div className="avatar-large">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" />
              ) : (
                <span className="avatar-initial">
                  {profile.name?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>

            <div className="avatar-actions">
              <button
                type="button"
                className="avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Camera size={14} />
                {uploadingAvatar ? "Uploading..." : "Change photo"}
              </button>

              {profile.avatar_url && (
                <button
                  type="button"
                  className="avatar-btn avatar-btn-danger"
                  onClick={removeAvatar}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </div>

          <div className="profile-meta">
            <h2 className="profile-name">{profile.name || "Your Name"}</h2>
            <div className="profile-sub">
              {profile.course && (
                <span className="profile-course">{profile.course}</span>
              )}
              {profile.location && (
                <>
                  <span className="profile-dot">·</span>
                  <span className="profile-location">
                    <MapPin size={12} /> {profile.location}
                  </span>
                </>
              )}
            </div>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
        </div>

        {stats && (
          <div className="profile-stats">
            <div className="pstat">
              <div className="pstat-value">{stats.topics_explored}</div>
              <div className="pstat-label">Topics Explored</div>
            </div>
            <div className="pstat">
              <div className="pstat-value">{stats.concepts_tested}</div>
              <div className="pstat-label">Concepts Tested</div>
            </div>
            <div className="pstat">
              <div className="pstat-value">{stats.tests_taken}</div>
              <div className="pstat-label">Tests Taken</div>
            </div>
          </div>
        )}
      </section>

      {/* ==================================================
          EDIT PROFILE
          ================================================== */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue">
            <UserIcon size={18} />
          </div>
          <div>
            <h2 className="section-title">Profile</h2>
            <p className="section-desc">Your personal information.</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={handleSaveProfile}>
          <div className="form-row">
            <label>
              <span>Full Name</span>
              <input
                type="text"
                value={profile.name}
                onChange={(e) =>
                  setProfile({ ...profile, name: e.target.value })
                }
                placeholder="Jane Doe"
              />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={profile.email}
                onChange={(e) =>
                  setProfile({ ...profile, email: e.target.value })
                }
                placeholder="jane@example.com"
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              <span>Course / Field</span>
              <input
                type="text"
                value={profile.course}
                onChange={(e) =>
                  setProfile({ ...profile, course: e.target.value })
                }
                placeholder="B.Tech CSE / Self-taught"
              />
            </label>
            <label>
              <span>Location</span>
              <input
                type="text"
                value={profile.location}
                onChange={(e) =>
                  setProfile({ ...profile, location: e.target.value })
                }
                placeholder="Mumbai, India"
              />
            </label>
          </div>

          <label>
            <span>
              Bio{" "}
              <span className="field-hint">
                ({profile.bio.length}/200 characters)
              </span>
            </span>
            <textarea
              value={profile.bio}
              onChange={(e) =>
                setProfile({ ...profile, bio: e.target.value.slice(0, 200) })
              }
              rows={3}
              placeholder="A short bio about yourself — what you're learning, why, and what you hope to build."
            />
          </label>

          {/* LANGUAGE */}
          <div className="language-block">
            <label>
              <span>
                <Globe size={12} /> Preferred Language
              </span>
              <select
                value={profile.preferred_language}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    preferred_language: e.target.value,
                  })
                }
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className="field-hint">
                All AI-generated content, tests, and tutor responses will be in
                this language. Existing cached content stays in its original
                language until regenerated.
              </span>
            </label>
          </div>

          <div className="form-row">
            <label>
              <span>Learning Style</span>
              <select
                value={profile.preferred_learning_style}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    preferred_learning_style: e.target.value,
                  })
                }
              >
                {LEARNING_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Education Level</span>
              <select
                value={profile.education_level}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    education_level: e.target.value,
                  })
                }
              >
                {EDUCATION_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* INTERESTS */}
          <div className="interests-block">
            <span className="interests-label">
              Interests{" "}
              <span className="field-hint">
                ({selectedInterests.length} selected)
              </span>
            </span>
            <div className="interests-grid">
              {INTEREST_OPTIONS.map((interest) => {
                const active = selectedInterests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    className={`interest-chip ${active ? "active" : ""}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {active && <Check size={12} />}
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SOCIAL LINKS */}
          <div className="form-row">
            <label>
              <span>
                <Globe size={12} /> Website
              </span>
              <input
                type="url"
                value={profile.website}
                onChange={(e) =>
                  setProfile({ ...profile, website: e.target.value })
                }
                placeholder="https://yourwebsite.com"
              />
            </label>
            <label>
              <span>
                <Code size={12} /> GitHub
              </span>
              <input
                type="text"
                value={profile.github}
                onChange={(e) =>
                  setProfile({ ...profile, github: e.target.value })
                }
                placeholder="username"
              />
            </label>
          </div>

          <label>
            <span>
              <LinkIcon size={12} /> LinkedIn
            </span>
            <input
              type="text"
              value={profile.linkedin}
              onChange={(e) =>
                setProfile({ ...profile, linkedin: e.target.value })
              }
              placeholder="linkedin.com/in/username"
            />
          </label>

          <button type="submit" className="btn-save" disabled={saving}>
            <Save size={15} /> {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </section>

      {/* ==================================================
          APPEARANCE
          ================================================== */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-purple">
            <Palette size={18} />
          </div>
          <div>
            <h2 className="section-title">Appearance</h2>
            <p className="section-desc">Choose how the app looks.</p>
          </div>
        </div>
        <div className="theme-options">
          <button
            type="button"
            className={`theme-option ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
          >
            <Sun size={18} />
            <span>Light</span>
          </button>
          <button
            type="button"
            className={`theme-option ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
          >
            <Moon size={18} />
            <span>Dark</span>
          </button>
        </div>
      </section>

      {/* ==================================================
          REMINDERS
          ================================================== */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-orange">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="section-title">Study Reminders</h2>
            <p className="section-desc">
              Get a browser notification at your chosen time. Works while the
              app is open in a tab.
            </p>
          </div>
        </div>

        {!isNotificationSupported() && (
          <div className="reminder-warning">
            <AlertTriangle size={14} /> Your browser doesn't support
            notifications.
          </div>
        )}

        {notificationPermission === "denied" && (
          <div className="reminder-warning">
            <AlertTriangle size={14} /> Notifications are blocked. Enable them
            in your browser settings for this site.
          </div>
        )}

        {reminderError && (
          <div className="reminder-flash reminder-flash-error">
            <AlertTriangle size={14} /> {reminderError}
          </div>
        )}
        {reminderSuccess && (
          <div className="reminder-flash reminder-flash-success">
            <Check size={14} /> {reminderSuccess}
          </div>
        )}

        <div className="reminder-toggle-row">
          <div className="reminder-toggle-label">
            {reminderEnabled ? (
              <>
                <Bell size={15} /> Reminders enabled
              </>
            ) : (
              <>
                <BellOff size={15} /> Reminders disabled
              </>
            )}
          </div>
          <button
            type="button"
            className={`reminder-switch ${reminderEnabled ? "on" : ""}`}
            onClick={handleToggleReminder}
            aria-pressed={reminderEnabled}
          >
            <span className="reminder-switch-knob" />
          </button>
        </div>

        {reminderEnabled && (
          <>
            <div className="reminder-block">
              <label className="reminder-label">
                <Clock size={12} /> Reminder time
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="reminder-time-input"
              />
            </div>

            <div className="reminder-block">
              <label className="reminder-label">Days</label>
              <div className="reminder-days">
                {DAY_NAMES.map((name, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`reminder-day ${
                      reminderDays.includes(index) ? "active" : ""
                    }`}
                    onClick={() => handleDayToggle(index)}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-secondary reminder-test-btn"
              onClick={handleTestReminder}
            >
              <Bell size={14} /> Send test notification
            </button>
          </>
        )}
      </section>

      {/* ==================================================
          DATA & PRIVACY
          ================================================== */}
      <section className="settings-section">
        <div className="section-head">
          <div className="section-icon icon-blue">
            <Download size={18} />
          </div>
          <div>
            <h2 className="section-title">Data & Privacy</h2>
            <p className="section-desc">Your data, your control.</p>
          </div>
        </div>
        <div className="data-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={handleExport}
          >
            <Download size={15} /> Export All Data (JSON)
          </button>
        </div>
      </section>

      {/* ==================================================
          DANGER ZONE
          ================================================== */}
      <section className="settings-section danger-zone">
        <div className="section-head">
          <div className="section-icon icon-red">
            <AlertTriangle size={18} />
          </div>
          <div>
            <h2 className="section-title">Danger Zone</h2>
            <p className="section-desc">
              This action cannot be undone. All subjects, topics, quizzes and
              progress will be deleted.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-danger"
          onClick={handleDeleteAccount}
        >
          Delete Account & All Data
        </button>
      </section>
    </div>
  );
}