/**
 * Browser Notification reminder service.
 * Schedules daily study reminders via setTimeout + localStorage.
 */

const KEY_ENABLED = "reminder_enabled";
const KEY_TIME = "reminder_time";
const KEY_DAYS = "reminder_days";
const KEY_LAST_SENT = "reminder_last_sent";

// 0 = Sunday, 1 = Monday, ..., 6 = Saturday
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getReminderSettings() {
  return {
    enabled: localStorage.getItem(KEY_ENABLED) === "true",
    time: localStorage.getItem(KEY_TIME) || "18:00",
    days: (() => {
      try {
        return JSON.parse(localStorage.getItem(KEY_DAYS) || "[1,2,3,4,5]");
      } catch {
        return [1, 2, 3, 4, 5];
      }
    })(),
  };
}

export function saveReminderSettings({ enabled, time, days }) {
  localStorage.setItem(KEY_ENABLED, String(enabled));
  localStorage.setItem(KEY_TIME, time);
  localStorage.setItem(KEY_DAYS, JSON.stringify(days));
}

export function isNotificationSupported() {
  return "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function alreadySentToday() {
  return localStorage.getItem(KEY_LAST_SENT) === todayKey();
}

function markSentToday() {
  localStorage.setItem(KEY_LAST_SENT, todayKey());
}

function parseTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return { hours: h, minutes: m };
}

/**
 * Show a browser notification.
 */
export function showNotification(title, body, onClick) {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;

  try {
    const notif = new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "study-reminder",
    });
    if (onClick) {
      notif.onclick = (e) => {
        e.preventDefault();
        window.focus();
        onClick();
      };
    }
  } catch (e) {
    console.warn("[reminder] Failed to show notification:", e);
  }
}

/**
 * Schedule a check every minute (only while tab is open).
 * Sends notification when the current time matches the reminder time
 * AND today is a selected day AND nothing was sent today.
 */
let intervalId = null;

export function startReminderLoop(onSend) {
  stopReminderLoop();

  const check = () => {
    const settings = getReminderSettings();
    if (!settings.enabled) return;
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const dayOfWeek = now.getDay();

    if (!settings.days.includes(dayOfWeek)) return;
    if (alreadySentToday()) return;

    const { hours, minutes } = parseTime(settings.time);

    // Trigger if current time is within the reminder's minute
    if (
      now.getHours() === hours &&
      now.getMinutes() === minutes
    ) {
      markSentToday();
      if (onSend) {
        onSend();
      } else {
        showNotification(
          "📚 Time to study!",
          "You have recommendations waiting. Tap to open."
        );
      }
    }
  };

  // Check immediately, then every 30 seconds
  check();
  intervalId = setInterval(check, 30 * 1000);
}

export function stopReminderLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Send a test notification immediately (for the Settings page).
 */
export function sendTestNotification() {
  if (!isNotificationSupported()) {
    return { ok: false, error: "Notifications not supported in this browser." };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, error: "Permission not granted." };
  }
  showNotification(
    "🎉 Test reminder",
    "Your reminders are set up correctly. You'll get one at your chosen time."
  );
  return { ok: true };
}