/**
 * Notification sounds from public/sounds/:
 * - message: messages sent/received
 * - user-joined: user join
 * - user-left: user leave
 * Unlock on first user gesture so autoplay policy is satisfied. Works in browser and Tauri.
 */

let soundUrls = null; // { message, userJoined, userLeave } -> full URLs
let userHasInteracted = false;
let audioContext = null;

/** Initialize sound URLs. Call from App on mount. */
export function initSoundElements(baseUrl = import.meta.env?.BASE_URL || "/") {
  const base = baseUrl.endsWith("/") ? baseUrl : baseUrl + "/";
  soundUrls = {
    message: base + "sounds/message.mp3",
    userJoined: base + "sounds/user-joined.mp3",
    userLeave: base + "sounds/user-left.mp3"
  };
  // Preload and unlock using disposable elements (muted to avoid audible cut-off)
  if (soundUrls && typeof Audio !== "undefined") {
    Object.values(soundUrls).forEach((url) => {
      const el = new Audio(url);
      el.volume = 0;
      el.play().then(() => el.pause()).catch(() => {});
    });
  }
}

/** @deprecated Use initSoundElements. Kept for backwards compat. */
export function setNotificationAudioElement(element) {
  if (!soundUrls && element?.src) {
    const base = (element.src || "").replace(/[^/]+$/, "");
    initSoundElements(base || "/");
  }
}

/** Call after a user gesture so we know we can play sounds when needed. */
export function setUserHasInteracted() {
  userHasInteracted = true;
  ensureAudioContext();
}

function ensureAudioContext() {
  if (audioContext) {
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  } catch (_e) {
    return null;
  }
}

/** Call from a user gesture (e.g. first click) to allow sounds to play later. */
export function unlockNotificationElement(element) {
  if (!element) return;
  ensureAudioContext();
  userHasInteracted = true;
  try {
    if (element.volume !== undefined) element.volume = 0.7;
    if (typeof element.play === "function") element.play().then(() => element.pause()).catch(() => {});
  } catch (_e) {}
}

/** Play a short beep using Web Audio (fallback when sound file fails). */
function playBeep() {
  const ctx = userHasInteracted ? ensureAudioContext() : audioContext;
  if (!ctx) return false;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    return true;
  } catch (_e) {
    return false;
  }
}

function playSound(key) {
  const url = soundUrls?.[key];
  if (!url) return playBeep();
  try {
    const el = new Audio(url);
    el.volume = 0.7;
    el.play().catch(() => playBeep());
    return true;
  } catch (_e) {
    return playBeep();
  }
}

export function unlockAudio() {
  ensureAudioContext();
  userHasInteracted = true;
  if (soundUrls && typeof Audio !== "undefined") {
    Object.values(soundUrls).forEach((url) => {
      const el = new Audio(url);
      el.volume = 0;
      el.play().then(() => el.pause()).catch(() => {});
    });
  }
}

export function preloadNotificationSound() {
  ensureAudioContext();
  userHasInteracted = true;
  if (soundUrls && typeof Audio !== "undefined") {
    Object.values(soundUrls).forEach((url) => {
      const el = new Audio(url);
      el.volume = 0;
      el.play().then(() => el.pause()).catch(() => {});
    });
  }
}

export function playConnectSound() {
  playSound("userJoined");
}

export function playUserJoinedSound() {
  playSound("userJoined");
}

export function playUserLeftSound() {
  playSound("userLeave");
}

export function playJoinedSound() {
  playSound("userJoined");
}

export function playDisconnectedSound() {
  playSound("userLeave");
}

export function playMessageSentSound() {
  playSound("message");
}

export function playMessageReceivedSound() {
  playSound("message");
}

export function playVoiceParticipantSound() {
  playSound("message");
}
