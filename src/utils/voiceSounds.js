/**
 * Short notification sounds for voice channel (connect, user joined, user left).
 * Uses HTML5 Audio with generated WAV blobs. Disabled in Tauri/WebKit desktop app
 * where GStreamer autoplay can be missing and cause freezes/crashes.
 */

const isTauri = typeof window !== "undefined" && !!window.__TAURI__;

const SAMPLE_RATE = 44100;

function generateToneWav(frequencyHz, durationMs, volume = 0.2) {
  const numSamples = Math.floor((SAMPLE_RATE * durationMs) / 1000);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = SAMPLE_RATE * numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const samples = new Int16Array(buffer, 44, numSamples);

  const twoPiF = (2 * Math.PI * frequencyHz) / SAMPLE_RATE;
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = Math.exp(-t * 8);
    samples[i] = Math.round(32767 * volume * envelope * Math.sin(twoPiF * i));
  }

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, numChannels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  return new Blob([buffer], { type: "audio/wav" });
}

function playWavBlob(blob) {
  try {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 1;
    audio.play().then(() => {
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }).catch(() => URL.revokeObjectURL(url));
  } catch (_e) {
    // ignore
  }
}

export function playConnectSound() {
  if (isTauri) return;
  playWavBlob(generateToneWav(523, 120, 0.25));
}

export function playUserJoinedSound() {
  if (isTauri) return;
  playWavBlob(generateToneWav(659, 80, 0.2));
  setTimeout(() => playWavBlob(generateToneWav(784, 80, 0.2)), 90);
}

export function playUserLeftSound() {
  if (isTauri) return;
  playWavBlob(generateToneWav(392, 100, 0.2));
}
