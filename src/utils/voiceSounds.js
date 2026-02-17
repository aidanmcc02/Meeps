/**
 * Notification sounds: use Web Audio API to play a short beep (no asset required).
 * Unlock on first user gesture so autoplay policy is satisfied. Works in browser and Tauri.
 */

let notificationAudioElement = null;
let userHasInteracted = false;
let audioContext = null;

/** Call after a user gesture so we know we can play sounds when needed. */
export function setUserHasInteracted() {
  userHasInteracted = true;
  ensureAudioContext();
}

/** Call when the app mounts its <audio> element (kept for ref; we use Web Audio for sounds). */
export function setNotificationAudioElement(element) {
  notificationAudioElement = element;
  if (element && userHasInteracted) ensureAudioContext();
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
  // If we still use the element for anything, unlock it
  try {
    if (element.volume !== undefined) element.volume = 0.7;
    if (typeof element.play === "function") element.play().then(() => element.pause()).catch(() => {});
  } catch (_e) {}
}

/** Play a short beep using Web Audio (works without any .mp3 file and in Tauri). */
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

/** Try <audio> element first (if src loaded), else Web Audio beep. */
function playViaElement() {
  try {
    if (notificationAudioElement?.src && notificationAudioElement.readyState >= 2) {
      notificationAudioElement.currentTime = 0;
      notificationAudioElement.volume = 0.7;
      notificationAudioElement.play().catch(() => playBeep());
      return true;
    }
  } catch (_e) {}
  return playBeep();
}

export function unlockAudio() {
  ensureAudioContext();
  if (notificationAudioElement) unlockNotificationElement(notificationAudioElement);
}

export function preloadNotificationSound() {
  ensureAudioContext();
  if (notificationAudioElement) unlockNotificationElement(notificationAudioElement);
}

export function playConnectSound() {
  playViaElement();
}

export function playUserJoinedSound() {
  playViaElement();
}

export function playUserLeftSound() {
  playViaElement();
}

export function playJoinedSound() {
  playViaElement();
}

export function playDisconnectedSound() {
  playViaElement();
}

export function playMessageSentSound() {
  playViaElement();
}

export function playMessageReceivedSound() {
  playViaElement();
}

export function playVoiceParticipantSound() {
  playViaElement();
}
