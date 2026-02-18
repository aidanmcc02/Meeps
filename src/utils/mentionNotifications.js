/**
 * Mention detection and notifications for PWA (iPhone) and Tauri (Windows).
 * Only notifies when the app/tab is in the background (document.visibilityState === "hidden").
 */

/**
 * Returns true if the message content mentions the current user (by @displayName slug or @everyone).
 * @param {string} content - Raw message content
 * @param {string} displayName - Current user's display name
 */
export function messageMentionsMe(content, displayName) {
  if (!content || typeof content !== "string") return false;
  const trimmed = (displayName || "").trim();
  if (!trimmed) return false;
  const currentSlug = trimmed.replace(/\s+/g, "_").toLowerCase();

  const re = /@(\S+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const slug = (match[1] || "").toLowerCase();
    if (slug === "everyone") return true;
    if (slug === currentSlug) return true;
  }
  return false;
}

/**
 * Request notification permission. Safe to call in both browser and Tauri.
 * @returns {Promise<boolean>} true if permission granted
 */
export async function requestNotificationPermission() {
  if (typeof window === "undefined") return false;
  if (window.__TAURI__) {
    try {
      const { isPermissionGranted, requestPermission } = await import(
        "@tauri-apps/api/notification"
      );
      let granted = await isPermissionGranted();
      if (!granted) {
        const result = await requestPermission();
        granted = result === "granted";
      }
      return granted;
    } catch {
      return false;
    }
  }
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Show a mention notification only when the app is in the background.
 * Call this when a message that mentions the user is received.
 * @param {string} senderName - Display name of the sender
 * @param {string} bodyPreview - Short preview of the message (plain text)
 * @param {string} channel - Channel name (e.g. "general")
 */
export async function showMentionNotificationIfBackground(
  senderName,
  bodyPreview,
  channel
) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") {
    return;
  }

  const title = "Meeps – mentioned you";
  const sender = senderName || "Someone";
  const preview =
    typeof bodyPreview === "string" && bodyPreview.trim()
      ? bodyPreview.trim().slice(0, 80) + (bodyPreview.length > 80 ? "…" : "")
      : "New message";
  const body = `#${channel || "general"}: ${sender} – ${preview}`;

  if (window.__TAURI__) {
    try {
      const { isPermissionGranted, sendNotification } = await import(
        "@tauri-apps/api/notification"
      );
      const granted = await isPermissionGranted();
      if (granted) {
        sendNotification({ title, body });
      }
    } catch {
      // ignore
    }
    return;
  }

  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(title, {
      body,
      icon: "/apple-touch-icon.png"
    });
  } catch {
    // ignore
  }
}
