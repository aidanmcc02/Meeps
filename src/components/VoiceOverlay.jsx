import React, { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/** Toast message for join/leave notifications - slides in with scale animation */
function Toast({ message, type, visible }) {
  const isJoin = type === "join";
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-8 z-50 -translate-x-1/2 transition-all duration-400 ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-2 scale-95 opacity-0"
      }`}
      style={{
        transitionProperty: "transform, opacity",
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)"
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-xl px-4 py-2.5 shadow-2xl backdrop-blur-md ${
          isJoin
            ? "border border-emerald-500/60 bg-emerald-900/80 text-emerald-100"
            : "border border-rose-500/50 bg-rose-900/80 text-rose-100"
        }`}
        style={{
          boxShadow: isJoin
            ? "0 0 40px rgba(16, 185, 129, 0.25), 0 8px 32px rgba(0,0,0,0.4)"
            : "0 0 40px rgba(244, 63, 94, 0.2), 0 8px 32px rgba(0,0,0,0.4)"
        }}
      >
        {isJoin ? (
          <svg className="h-5 w-5 flex-shrink-0 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        ) : (
          <svg className="h-5 w-5 flex-shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}

export default function VoiceOverlay() {
  const [participants, setParticipants] = useState([]);
  const [toast, setToast] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const unlistenUpdate = listen("voice-overlay-update", (event) => {
      const payload = event.payload;
      if (payload && Array.isArray(payload.participants)) {
        setParticipants(payload.participants);
      }
    });

    const unlistenToast = listen("voice-overlay-toast", (event) => {
      const payload = event.payload;
      if (payload && typeof payload.message === "string") {
        setToast({ message: payload.message, type: payload.type || "join" });
        setToastVisible(true);
        const t = setTimeout(() => {
          setToastVisible(false);
          setTimeout(() => setToast(null), 500);
        }, 3500);
        return () => clearTimeout(t);
      }
    });

    return () => {
      unlistenUpdate.then((fn) => fn());
      unlistenToast.then((fn) => fn());
    };
  }, []);

  return (
    <div className="pointer-events-none min-h-screen w-full p-4" style={{ background: "transparent" }}>
      <div className="flex flex-col gap-2">
        {/* Participants list - compact gaming overlay style */}
        <div
          className="rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-xl pointer-events-none"
          style={{
            boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
          }}
        >
          <div className="mb-1.5 flex items-center gap-2 px-0.5">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">In call</span>
            <span className="text-[11px] text-white/50">({participants.length})</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {participants.map((p) => {
              const name = p.displayName || `User ${p.id}`;
              const initials = name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "?";
              return (
                <div
                  key={String(p.id)}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5"
                  title={name}
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/60 text-[10px] font-bold text-white">
                    {initials}
                  </div>
                  <span className="max-w-[120px] truncate text-xs text-white/90">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Join/leave toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          visible={toastVisible}
        />
      )}
    </div>
  );
}
