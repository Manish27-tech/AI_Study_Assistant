import { createContext, useContext, useState } from "react";
import { loginOrRegister } from "../api/client";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const login = async (email, password, name = null, course = null) => {
    // Password is not used yet (no real auth backend) — kept for UX only.
    // The backend expects: { email, name?, course? }
    const payload = { email };
    if (name) payload.name = name;
    if (course) payload.course = course;

    const res = await loginOrRegister(payload);

    const userData = {
      student_id: res.data.student_id,
      email: res.data.email,
      name: res.data.name,
      course: res.data.course,
      onboarding_completed: !!res.data.onboarding_completed,
      learning_goal: res.data.learning_goal || "",
      daily_time_minutes: res.data.daily_time_minutes || 30,
      current_level: res.data.current_level || "",
      loginAt: new Date().toISOString(),
    };

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
  };

  const updateUser = (partial) => {
    setUser((prev) => {
      const next = { ...(prev || {}), ...partial };
      localStorage.setItem("user", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}