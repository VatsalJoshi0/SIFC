import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../features/auth/sessionStore";
import { api } from "../api/client";

// 15 minutes of inactivity per FR-A4, FR-A6, P10
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const IdleTimer: React.FC = () => {
  const navigate = useNavigate();
  const { accessToken, lastActivity, updateActivity, clearSession } = useSessionStore();

  useEffect(() => {
    if (!accessToken) return;

    const handleUserActivity = () => {
      updateActivity();
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, handleUserActivity, { passive: true }));

    const checkInterval = setInterval(async () => {
      const now = Date.now();
      if (now - lastActivity > IDLE_TIMEOUT_MS) {
        clearInterval(checkInterval);
        try {
          await api.auth.logout();
        } catch {
          // ignore
        }
        clearSession();
        navigate("/login?reason=idle_timeout");
      }
    }, 15000); // Check every 15s

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [accessToken, lastActivity, updateActivity, clearSession, navigate]);

  return null;
};
