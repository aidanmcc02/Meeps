/**
 * Message notifications for PWA (iPhone) and Tauri (Windows).
 * Only notifies when the app/tab is in the background (document.visibilityState === "hidden").
 * Notifications are shown for all messages (not just @mentions).
 */

/** Strip basic markdown for plain text notification preview */
function stripMarkdown(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\n+/g, " ")
    .trim();
}

/**
 * Returns true if the message content mentions the current user (by @displayName slug or @everyone).
 * @param {string} content - Raw message content
 * @param {string} displayName - Current user's display name
 */
export function messageMentionsMe(content, displayName) {
  if (!content || typeof content !== "string") return false;
  
  // Check for @everyone first (always triggers, regardless of displayName)
  if (/@everyone\b/i.test(content)) return true;
  
  // Check for user-specific mentions only if displayName is set
  const trimmed = (displayName || "").trim();
  if (!trimmed) return false;
  const currentSlug = trimmed.replace(/\s+/g, "_").toLowerCase();

  const re = /@(\S+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const slug = (match[1] || "").toLowerCase();
    if (slug === currentSlug) return true;
  }
  return false;
}

/**
 * Returns true if the message content mentions the current user by direct @displayName only (not @everyone).
 * Use this when the current user is the sender so that @everyone does not "ping" the sender.
 */
export function messageMentionsMeDirectly(content, displayName) {
  if (!content || typeof content !== "string") return false;
  const trimmed = (displayName || "").trim();
  if (!trimmed) return false;
  const currentSlug = trimmed.replace(/\s+/g, "_").toLowerCase();
  const re = /@(\S+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const slug = (match[1] || "").toLowerCase();
    if (slug === currentSlug) return true;
  }
  return false;
}

/**
 * Get service worker registration if available
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
async function getServiceWorkerRegistration() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

/**
 * Request notification permission. Safe to call in both browser and Tauri.
 * For iOS PWA, also ensures service worker is registered.
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
  
  // Ensure service worker is registered for iOS PWA
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.ready;
    } catch {
      // Service worker not ready, but continue with notification permission
    }
  }
  
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Convert VAPID public key (base64url) to Uint8Array for pushManager.subscribe.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push and register the subscription with the backend.
 * Call after notification permission is granted (for notifications when app is closed, e.g. iOS).
 * @param {string} apiBase - Backend base URL (e.g. https://api.example.com)
 * @param {string} token - JWT Bearer token
 * @returns {Promise<boolean>} true if subscription was registered
 */
export async function subscribePushSubscription(apiBase, token) {
  if (typeof window === "undefined" || window.__TAURI__) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (!Notification.permission || Notification.permission !== "granted") return false;
  if (!apiBase || !token) return false;

  const base = apiBase.replace(/\/$/, "");

  try {
    const reg = await navigator.serviceWorker.ready;
    const vapidRes = await fetch(`${base}/api/push-vapid-public`);
    if (!vapidRes.ok) return false;
    const { publicKey } = await vapidRes.json();
    if (!publicKey) return false;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    const subRes = await fetch(`${base}/api/push-subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    return subRes.ok;
  } catch {
    return false;
  }
}

/**
 * Show a message notification only when the app is in the background.
 * Call this when any message is received (not just @mentions).
 * Format: "Meeps" (title), "SenderName: message preview" (body) – no channel.
 * Uses service worker for iOS PWA compatibility.
 * @param {string} senderName - Display name of the sender
 * @param {string} bodyPreview - Short preview of the message (plain text; markdown stripped)
 * @param {string} channel - Channel name (e.g. "general") – used for tag only, not shown in notification
 */
export async function showMentionNotificationIfBackground(
  senderName,
  bodyPreview,
  channel
) {
  if (typeof document === "undefined" || document.visibilityState !== "hidden") {
    return;
  }

  const title = "Meeps";
  const sender = senderName || "Someone";
  const plainPreview = stripMarkdown(
    typeof bodyPreview === "string" ? bodyPreview : ""
  ).slice(0, 80);
  const previewText = plainPreview + (plainPreview.length >= 80 ? "…" : "") || "New message";
  const body = `${sender}: ${previewText}`;

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
    // Try to use service worker registration for iOS PWA compatibility
    const registration = await getServiceWorkerRegistration();
    if (registration && registration.showNotification) {
      const channelId = channel || "general";
      const url = `/?channel=${encodeURIComponent(channelId)}`;
      await registration.showNotification(title, {
        body,
        icon: "/apple-touch-icon.png",
        badge: "/icon-192.png",
        tag: `message-${channelId}`,
        data: {
          url,
          channel: channelId
        }
      });
    } else {
      new Notification(title, {
        body,
        icon: "/apple-touch-icon.png"
      });
    }
  } catch {
    // ignore errors
  }
}
