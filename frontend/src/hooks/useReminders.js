import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  startReminderLoop,
  stopReminderLoop,
  getReminderSettings,
  showNotification,
  isNotificationSupported,
} from "../utils/reminderService";

/**
 * Runs the reminder loop while the app is open.
 * Send a notification with a link to /recommendations when it's time.
 */
export default function useReminders() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const settings = getReminderSettings();
    if (!settings.enabled) return;

    const sendFn = () => {
      showNotification(
        "📚 Time to study!",
        "You have recommendations waiting. Click to open.",
        () => navigate("/recommendations")
      );
    };

    startReminderLoop(sendFn);
    return () => stopReminderLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}