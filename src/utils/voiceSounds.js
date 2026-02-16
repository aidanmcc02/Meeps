/**
 * Notification sounds: one DOM <audio> element (set by the app) is unlocked on first
 * user gesture and reused for all sounds. No Web Audio or dynamic Audio() in callbacks.
 * Disabled in Tauri/WebKit desktop app where autoplay can cause issues.
 */

const isTauri = typeof window !== "undefined" && !!window.__TAURI__;

let notificationAudioElement = null;
let userHasInteracted = false;

/** Call after a user gesture so we know we can unlock the element when it mounts. */
export function setUserHasInteracted() {
  userHasInteracted = true;
  if (notificationAudioElement) unlockNotificationElement(notificationAudioElement);
}

/** Call when the app mounts its <audio> element so we can use it for all sounds. */
export function setNotificationAudioElement(element) {
  notificationAudioElement = element;
  if (element && userHasInteracted) unlockNotificationElement(element);
}

/** Call from a user gesture (e.g. first click) to allow the element to play later. */
export function unlockNotificationElement(element) {
  if (isTauri || !element) return;
  try {
    element.volume = 0.7;
    element.play().then(() => element.pause()).catch(() => {});
  } catch (_e) {}
}

function playViaElement() {
  if (isTauri || !notificationAudioElement) return false;
  try {
    notificationAudioElement.currentTime = 0;
    notificationAudioElement.volume = 0.7;
    notificationAudioElement.play().catch(() => {});
    return true;
  } catch (_e) {
    return false;
  }
}

export function unlockAudio() {
  if (isTauri) return;
  if (notificationAudioElement) unlockNotificationElement(notificationAudioElement);
}

export function preloadNotificationSound() {
  if (isTauri) return;
  unlockNotificationElement(notificationAudioElement);
}

export function playConnectSound() {
  if (isTauri) return;
  playViaElement();
}

export function playUserJoinedSound() {
  if (isTauri) return;
  playViaElement();
}

export function playUserLeftSound() {
  if (isTauri) return;
  playViaElement();
}

export function playJoinedSound() {
  if (isTauri) return;
  playViaElement();
}

export function playDisconnectedSound() {
  if (isTauri) return;
  playViaElement();
}

export function playMessageSentSound() {
  if (isTauri) return;
  playViaElement();
}

export function playMessageReceivedSound() {
  if (isTauri) return;
  playViaElement();
}

export function playVoiceParticipantSound() {
  if (isTauri) return;
  playViaElement();
}
