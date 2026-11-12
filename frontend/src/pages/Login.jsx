import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GraduationCap,
  User,
  Target,
  Brain,
  TrendingUp,
  Bot,
  Mail,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userData = await login(email, password);

      // Phase 2 — send new users to onboarding first
      if (userData && !userData.onboarding_completed) {
        navigate("/onboarding");
        return;
      }

      // Check for redirect param
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect");
      navigate(redirect || "/");
    } catch (err) {
      setError(
        err.response?.data?.detail || "Login failed. Is the backend running?"
      );
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Target, text: "Personalized Study Plans" },
    { icon: Brain, text: "AI Recommendations" },
    { icon: TrendingUp, text: "Progress Tracking" },
    { icon: Bot, text: "Quiz & Practice" },
    { icon: GraduationCap, text: "AI Tutor Support" },
  ];

  return (
    <div className="login-page">
      {/* ---------- LEFT: HERO ---------- */}
      <div className="login-hero">
        <div className="hero-brand">
          <GraduationCap size={26} />
          <span>AI Study Assistant</span>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Your Personal AI Tutor for <span>Smarter Learning</span>
          </h1>
          <p className="hero-subtitle">
            Get personalized study plans, track your progress, identify weak
            areas and achieve your goals with the power of AI.
          </p>

          <ul className="hero-features">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <li key={i}>
                  <div className="feature-icon">
                    <Icon size={16} />
                  </div>
                  <span>{f.text}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="hero-illustration">
          <svg
            viewBox="0 0 400 260"
            xmlns="http://www.w3.org/2000/svg"
            className="hero-svg"
          >
            <circle cx="80" cy="70" r="50" fill="rgba(56,189,248,0.12)" />
            <circle cx="330" cy="180" r="70" fill="rgba(139,92,246,0.12)" />
            <circle cx="200" cy="40" r="30" fill="rgba(37,99,235,0.1)" />

            <rect
              x="110"
              y="100"
              width="180"
              height="120"
              rx="8"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <rect x="125" y="115" width="150" height="4" rx="2" fill="#38bdf8" />
            <rect x="125" y="128" width="100" height="4" rx="2" fill="#cbd5e1" />
            <rect x="125" y="141" width="130" height="4" rx="2" fill="#cbd5e1" />
            <rect x="125" y="154" width="90" height="4" rx="2" fill="#cbd5e1" />
            <rect x="125" y="175" width="60" height="8" rx="4" fill="#2563eb" />

            <rect x="180" y="220" width="40" height="10" rx="3" fill="#cbd5e1" />

            <circle cx="90" cy="180" r="16" fill="#2563eb" />
            <rect x="74" y="200" width="32" height="40" rx="8" fill="#2563eb" />

            <rect
              x="295"
              y="80"
              width="60"
              height="40"
              rx="8"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="2"
            />
            <circle cx="310" cy="100" r="5" fill="#10b981" />
            <rect x="322" y="95" width="25" height="4" rx="2" fill="#cbd5e1" />
            <rect x="322" y="105" width="18" height="4" rx="2" fill="#cbd5e1" />
          </svg>
        </div>

        <div className="hero-footer">Better Learning, Brighter Future.</div>
      </div>

      {/* ---------- RIGHT: LOGIN CARD ---------- */}
      <div className="login-form-side">
        <div className="login-card">
          <h2 className="login-welcome">Welcome Back 👋</h2>
          <p className="login-subtext">
            Login to continue your learning journey.
          </p>

          {error && <div className="login-error">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <label className="login-field">
              <span>Email</span>
              <div className="login-input">
                <Mail size={16} />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <label className="login-field">
              <span>Password</span>
              <div className="login-input">
                <Lock size={16} />
                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </label>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="login-signup">
            Don't have an account? <a href="#signup">Sign Up</a>
          </p>

          <div className="login-divider">
            <span>Or continue with</span>
          </div>

          <div className="login-socials">
            <button className="social-btn" type="button">
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3.1.6 4.2 1.7l3.1-3.1C17.5 1.9 14.9 1 12 1 7.7 1 4 3.6 2.4 7.3l3.7 2.9C6.9 7.4 9.2 5 12 5z"
                />
                <path
                  fill="#34A853"
                  d="M23.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.5c-.3 1.5-1.1 2.7-2.4 3.6l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.5z"
                />
                <path
                  fill="#4285F4"
                  d="M12 23c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1.1.7-2.5 1.2-4.2 1.2-3.2 0-5.9-2.2-6.9-5.1l-3.7 2.9C3.9 20.3 7.6 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.1 13.3c-.2-.7-.4-1.5-.4-2.3s.1-1.5.4-2.3L1.4 5.8C.5 7.6 0 9.7 0 12s.5 4.4 1.4 6.2l3.7-2.9z"
                />
              </svg>
              Google
            </button>

            <button className="social-btn" type="button">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.3-3.2-.1-.3-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.9.1 3.2.8.8 1.3 1.9 1.3 3.2 0 4.7-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z" />
              </svg>
              GitHub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}