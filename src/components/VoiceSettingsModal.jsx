import React, { useEffect, useRef, useState } from "react";

function VoiceSettingsModal({ isOpen, onClose, voiceSettings, onSave }) {
  const [inputDeviceId, setInputDeviceId] = useState(voiceSettings?.inputDeviceId ?? "");
  const [outputDeviceId, setOutputDeviceId] = useState(voiceSettings?.outputDeviceId ?? "");
  const [volume, setVolume] = useState(voiceSettings?.volume ?? 1);
  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(voiceSettings?.pushToTalkEnabled ?? false);
  const [pushToTalkKey, setPushToTalkKey] = useState(voiceSettings?.pushToTalkKey ?? "Space");
  const [inputDevices, setInputDevices] = useState([]);
  const [outputDevices, setOutputDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [capturingKey, setCapturingKey] = useState(false);
  const [micError, setMicError] = useState(null);
  const scanCancelledRef = useRef(false);
  const isTauri = typeof window !== "undefined" && !!window.__TAURI__;

  useEffect(() => {
    if (!isOpen) return;
    setInputDeviceId(voiceSettings?.inputDeviceId ?? "");
    setOutputDeviceId(voiceSettings?.outputDeviceId ?? "");
    setVolume(voiceSettings?.volume ?? 1);
    setPushToTalkEnabled(voiceSettings?.pushToTalkEnabled ?? false);
    setPushToTalkKey(voiceSettings?.pushToTalkKey ?? "Space");
  }, [isOpen, voiceSettings]);

  // Scan for mics/speakers when modal opens. Requesting mic permission first
  // ensures the browser exposes device labels (otherwise they often show as empty).
  const scanDevices = React.useCallback(() => {
    if (!isOpen) return;
    if (!navigator.mediaDevices) {
      setMicError("Media devices not available.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMicError(null);
    scanCancelledRef.current = false;

    function applyDevices(devices) {
      if (scanCancelledRef.current) return;
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
      setInputDevices(audioInputs);
      setOutputDevices(audioOutputs);
      setInputDeviceId((prev) => (prev || (audioInputs[0]?.deviceId ?? "")));
      setOutputDeviceId((prev) => (prev || (audioOutputs[0]?.deviceId ?? "")));
    }

    function done() {
      if (!scanCancelledRef.current) setLoading(false);
    }

    // Request mic permission so enumerateDevices() returns real labels
    navigator.mediaDevices
      .getUserMedia({ video: false, audio: true })
      .then((stream) => {
        if (scanCancelledRef.current) return;
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((devices) => {
        applyDevices(devices);
      })
      .catch((err) => {
        const name = err?.name || "";
        const denied = name === "NotAllowedError" || name === "PermissionDeniedError";
        if (!scanCancelledRef.current) {
          setMicError(denied ? "Microphone access was denied." : "Could not access microphone.");
        }
        return navigator.mediaDevices.enumerateDevices().then(applyDevices);
      })
      .finally(done);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setMicError(null);
    scanDevices();
    return () => {
      scanCancelledRef.current = true;
    };
  }, [isOpen, scanDevices]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        if (capturingKey) {
          setCapturingKey(false);
          e.preventDefault();
        } else {
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, capturingKey]);

  // Capture next key press for push-to-talk key
  useEffect(() => {
    if (!capturingKey) return;
    function captureKey(e) {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key === " " ? "Space" : e.key;
      setPushToTalkKey(key);
      setCapturingKey(false);
    }
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  }, [capturingKey]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.({
      inputDeviceId: inputDeviceId || null,
      outputDeviceId: outputDeviceId || null,
      volume: Number(volume),
      pushToTalkEnabled,
      pushToTalkKey: pushToTalkKey || "Space"
    });
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="voice-settings-modal w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-600 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Voice &amp; sound settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Microphone (input)
              </label>
              <button
                type="button"
                onClick={() => scanDevices()}
                disabled={loading}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
              >
                {loading ? "Scanning…" : "Rescan devices"}
              </button>
            </div>
            <select
              value={inputDeviceId}
              onChange={(e) => setInputDeviceId(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            >
              <option value="">Default</option>
              {inputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            {micError && (
              <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                <p>{micError}</p>
                {isTauri && (
                  <p className="mt-1 opacity-90">
                    In the desktop app, allow microphone in your system settings (e.g. System Preferences → Privacy &amp; Security → Microphone) and restart the app or click Rescan.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => scanDevices()}
                  className="mt-2 font-medium text-amber-700 dark:text-amber-300 hover:underline"
                >
                  Request access / Rescan
                </button>
              </div>
            )}
            {inputDevices.length === 0 && !loading && !micError && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                No microphones found. Allow mic access and rescan, or plug in a device.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Speaker (output)
            </label>
            <select
              value={outputDeviceId}
              onChange={(e) => setOutputDeviceId(e.target.value)}
              disabled={loading}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-400"
            >
              <option value="">Default</option>
              {outputDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId} className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Volume (other participants): {Math.round(volume * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="voice-settings-range w-full h-2 rounded-lg appearance-none bg-gray-200 dark:bg-gray-600 accent-indigo-500 dark:accent-indigo-400"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-600 dark:bg-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Push to talk</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Hold a key to transmit (optional)
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={pushToTalkEnabled}
                onChange={(e) => setPushToTalkEnabled(e.target.checked)}
                className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-500 dark:border-gray-500 dark:bg-gray-600 dark:checked:bg-indigo-500 dark:checked:border-indigo-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">Enable</span>
            </label>
          </div>

          {pushToTalkEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Push to talk key
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCapturingKey(true)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 ${
                    capturingKey
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-200"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {capturingKey ? "Press any key…" : pushToTalkKey || "Set key"}
                </button>
                {capturingKey && (
                  <button
                    type="button"
                    onClick={() => setCapturingKey(false)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VoiceSettingsModal;
