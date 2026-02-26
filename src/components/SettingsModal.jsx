import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

const KEY_MODES = [
  { value: "toggle", label: "Toggle" },
  { value: "hold", label: "Hold" }
];

function formatKeyLabel(code) {
  if (!code) return "Click to set";
  if (code === "Space") return "Space";
  const match = /^Key([A-Z])$/.exec(code);
  if (match) return match[1];
  const matchDigit = /^Digit(\d)$/.exec(code);
  if (matchDigit) return matchDigit[1];
  return code;
}

function SettingsModal({ isOpen, onClose, onOpenVoiceSettings, keybinds, onKeybindsChange, isTauri, activityLoggingEnabled, onActivityLoggingChange }) {
  const [view, setView] = useState("list"); // 'list' | 'keybinds'
  const [capturing, setCapturing] = useState(null); // 'mute' | 'muteDeafen' | null
  const [localKeybinds, setLocalKeybinds] = useState(keybinds);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [launchAtStartupLoading, setLaunchAtStartupLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setLocalKeybinds(keybinds);
  }, [isOpen, keybinds]);

  useEffect(() => {
    if (isOpen && isTauri) {
      invoke("is_launch_at_startup_enabled")
        .then((v) => setLaunchAtStartup(!!v))
        .catch(() => setLaunchAtStartup(false));
    }
  }, [isOpen, isTauri]);

  useEffect(() => {
    if (!isOpen) {
      setView("list");
      setCapturing(null);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        if (capturing) {
          setCapturing(null);
          e.preventDefault();
        } else if (view === "keybinds") {
          setView("list");
          e.preventDefault();
        } else {
          onClose?.();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, view, capturing]);

  // Capture key when recording a keybind
  useEffect(() => {
    if (!capturing) return;
    function captureKey(e) {
      e.preventDefault();
      e.stopPropagation();
      const code = e.code || (e.key === " " ? "Space" : e.key);
      setLocalKeybinds((prev) => ({
        ...prev,
        [capturing]: { ...prev[capturing], key: code }
      }));
      setCapturing(null);
    }
    window.addEventListener("keydown", captureKey, true);
    return () => window.removeEventListener("keydown", captureKey, true);
  }, [capturing]);

  const handleOpenVoiceSettings = () => {
    onClose?.();
    onOpenVoiceSettings?.();
  };

  const handleSaveKeybinds = () => {
    onKeybindsChange?.(localKeybinds);
    setView("list");
  };

  const setKeybindMode = (which, mode) => {
    setLocalKeybinds((prev) => ({
      ...prev,
      [which]: { ...prev[which], mode }
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 id="settings-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            {view === "list" ? "Settings" : "Keybinds"}
          </h2>
          <button
            type="button"
            onClick={() => (view === "keybinds" ? setView("list") : onClose?.())}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {view === "list" && (
            <ul className="space-y-0.5">
              {isTauri && (
                <li>
                  <div className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Open Meeps at startup</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={launchAtStartup}
                      disabled={launchAtStartupLoading}
                      onClick={async () => {
                        setLaunchAtStartupLoading(true);
                        try {
                          const next = !launchAtStartup;
                          await invoke("set_launch_at_startup", { enabled: next });
                          setLaunchAtStartup(next);
                        } catch (_) {}
                        setLaunchAtStartupLoading(false);
                      }}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 ${
                        launchAtStartup ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                          launchAtStartup ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </li>
              )}
              {activityLoggingEnabled !== undefined && (
                <li>
                  <div className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span>Activity logging</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activityLoggingEnabled}
                      onClick={() => onActivityLoggingChange?.(!activityLoggingEnabled)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                        activityLoggingEnabled ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                          activityLoggingEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </li>
              )}
              <li>
                <button
                  type="button"
                  onClick={handleOpenVoiceSettings}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Voice settings</span>
                  <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setView("keybinds")}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Keybinds</span>
                  <svg className="ml-auto h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            </ul>
          )}

          {view === "keybinds" && (
            <div className="space-y-5">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Toggle: press to mute, press again to unmute. Hold: hold key to mute, release to unmute. Only active when in a call.
              </p>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Mute</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapturing("mute")}
                    className={`min-w-[6rem] rounded-lg border px-3 py-2 text-sm font-medium ${
                      capturing === "mute"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {capturing === "mute" ? "Press a key…" : formatKeyLabel(localKeybinds.mute?.key)}
                  </button>
                  <select
                    value={localKeybinds.mute?.mode ?? "toggle"}
                    onChange={(e) => setKeybindMode("mute", e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {KEY_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Mute + Deafen</label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapturing("muteDeafen")}
                    className={`min-w-[6rem] rounded-lg border px-3 py-2 text-sm font-medium ${
                      capturing === "muteDeafen"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-900/30 dark:text-indigo-300"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    }`}
                  >
                    {capturing === "muteDeafen" ? "Press a key…" : formatKeyLabel(localKeybinds.muteDeafen?.key)}
                  </button>
                  <select
                    value={localKeybinds.muteDeafen?.mode ?? "hold"}
                    onChange={(e) => setKeybindMode("muteDeafen", e.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                  >
                    {KEY_MODES.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSaveKeybinds}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  Save keybinds
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
