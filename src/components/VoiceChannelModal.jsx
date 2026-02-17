import React, { useEffect, useRef, useState } from "react";

function isGifUrl(url) {
  return typeof url === "string" && url.toLowerCase().includes(".gif");
}

/** Renders a single remote video stream; only updates srcObject when the track changes to avoid glitching. */
function RemoteVideoTile({ stream, displayName, size = "thumb", isSelected, onClick }) {
  const videoRef = useRef(null);
  const videoTracks = stream && typeof stream.getVideoTracks === "function" ? stream.getVideoTracks() : [];
  const liveTrack = videoTracks.find((t) => t.readyState !== "ended") ?? videoTracks[0];
  const trackId = liveTrack?.id ?? null;

  useEffect(() => {
    if (!trackId || !stream) return;
    const tracks = stream.getVideoTracks();
    const live = tracks.find((t) => t.readyState !== "ended") ?? tracks[0];
    if (!live) return;
    const ms = new MediaStream([live]);
    const el = videoRef.current;
    if (el) el.srcObject = ms;
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream, trackId]);

  if (!liveTrack) return null;
  const isLarge = size === "large";
  const wrapperClass = `overflow-hidden rounded-2xl bg-black/60 ring-1 transition-all ${
    isSelected ? "ring-2 ring-emerald-400" : "ring-white/10"
  } ${onClick ? "cursor-pointer hover:ring-white/30" : ""} ${isLarge ? "size-full flex flex-col min-h-0" : ""}`;
  const content = (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={isLarge ? "size-full object-contain" : "h-40 w-auto object-contain"}
      />
      {!isLarge && <p className="px-3 py-2 text-xs text-white/60 truncate max-w-[200px]">{displayName}</p>}
    </>
  );
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} className={wrapperClass}>
      {content}
    </Wrapper>
  );
}

/** Local video (camera or screen); sets srcObject once when stream changes. */
function LocalVideoTile({ stream, label, size = "thumb", isSelected, onClick }) {
  const videoRef = useRef(null);
  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) el.srcObject = stream;
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);
  if (!stream) return null;
  const isLarge = size === "large";
  const wrapperClass = `overflow-hidden rounded-2xl bg-black/60 ring-1 transition-all ${
    isSelected ? "ring-2 ring-emerald-400" : "ring-white/10"
  } ${onClick ? "cursor-pointer hover:ring-white/30" : ""} ${isLarge ? "size-full flex flex-col min-h-0" : ""}`;
  const content = (
    <>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={isLarge ? "size-full min-h-0 object-contain" : "h-40 w-auto object-contain"}
      />
      {!isLarge && <p className="px-3 py-2 text-xs text-white/60">{label}</p>}
    </>
  );
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper type={onClick ? "button" : undefined} onClick={onClick} className={wrapperClass}>
      {content}
    </Wrapper>
  );
}

function VoiceChannelModal({
  isOpen,
  onClose,
  channel,
  participants = [],
  profiles = {},
  isJoined,
  speakingUserIds = [],
  voicePingMs,
  isSharingScreen,
  onStartScreenShare,
  onStopScreenShare,
  localScreenStream,
  isCameraEnabled,
  onStartCamera,
  onStopCamera,
  localCameraStream,
  remoteStreams = {},
  onJoin,
  onLeave,
  onOpenSoundSettings
}) {
  const [gifStaticFrames, setGifStaticFrames] = useState({}); // avatarUrl -> dataURL (first frame)
  const [expandedVideoKey, setExpandedVideoKey] = useState(null); // 'local-screen' | 'local-camera' | `remote-${userId}` | null

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Capture first frame of each GIF avatar (when CORS allows) so we can show static when not speaking
  useEffect(() => {
    if (!isOpen || !participants.length) return;
    const gifUrls = participants
      .map((p) => profiles[p.id]?.avatarUrl)
      .filter(Boolean)
      .filter(isGifUrl);
    gifUrls.forEach((avatarUrl) => {
      if (gifStaticFrames[avatarUrl]) return;
      const img = new Image();
      // Only set crossOrigin for cross-origin URLs; same-origin works without it
      try {
        const u = new URL(avatarUrl, window.location.origin);
        if (u.origin !== window.location.origin) img.crossOrigin = "anonymous";
      } catch {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/png");
          setGifStaticFrames((prev) => ({ ...prev, [avatarUrl]: dataUrl }));
        } catch {
          // tainted canvas (CORS); we'll show initials when not speaking
        }
      };
      img.onerror = () => {};
      img.src = avatarUrl;
    });
  }, [isOpen, participants, profiles]);

  if (!isOpen || !channel) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-gray-950 via-violet-950/40 to-gray-950"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-room-title"
    >
      {/* Subtle noise / grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Top bar */}
      <header className="relative flex flex-shrink-0 items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 id="voice-room-title" className="text-xl font-semibold tracking-tight text-white">
            {channel.name}
          </h1>
          {isJoined && voicePingMs != null && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
              {voicePingMs} ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onOpenSoundSettings && (
            <button
              type="button"
              onClick={onOpenSoundSettings}
              className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Sound settings"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2.5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main: big avatars + screen shares */}
      <main className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-auto px-6 py-8">
        {/* Participant avatars - large circles */}
        <div className="flex flex-wrap justify-center gap-10 max-w-4xl">
          {participants.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 px-12 py-16 text-center">
              <p className="text-white/50 text-lg">No one in the call yet</p>
              <p className="mt-1 text-white/40 text-sm">Join to start talking</p>
            </div>
          ) : (
            participants.map((p) => {
              const profile = profiles[p.id];
              const avatarUrl = profile?.avatarUrl || null;
              const name = p.displayName || profile?.displayName || `User ${p.id}`;
              const initials = name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "?";
              const isSpeaking = speakingUserIds.includes(String(p.id));

              return (
                <div
                  key={p.id}
                  className="flex flex-col items-center gap-3"
                >
                  <div
                    className={`relative flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full text-3xl font-semibold text-white transition-all duration-300 ${
                      isSpeaking ? "ring-4 ring-emerald-400 voice-speaking-glow" : "ring-2 ring-white/20 shadow-xl"
                    }`}
                  >
                    <div className="h-full w-full overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600">
                      {avatarUrl ? (
                        isGifUrl(avatarUrl) ? (
                          // GIF: only show animated GIF when speaking; otherwise static frame or initials
                          isSpeaking ? (
                            <img key="gif" src={avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : gifStaticFrames[avatarUrl] ? (
                            <img key="static" src={gifStaticFrames[avatarUrl]} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">{initials}</span>
                          )
                        ) : (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">{initials}</span>
                      )}
                    </div>
                    {isSpeaking && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full border-2 border-gray-950 bg-emerald-500 animate-pulse"
                        title="Speaking"
                      />
                    )}
                  </div>
                  <span className="max-w-[10rem] truncate text-center text-sm font-medium text-white/90" title={name}>
                    {name}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Screen shares + camera - when in call: stage (large) + thumbnails */}
        {isJoined && (() => {
          const videoEntries = [];
          if (localScreenStream) videoEntries.push({ key: "local-screen", type: "local", stream: localScreenStream, label: "Your screen" });
          if (localCameraStream) videoEntries.push({ key: "local-camera", type: "local", stream: localCameraStream, label: "Your camera" });
          Object.entries(remoteStreams).forEach(([userId, stream]) => {
            if (!stream || typeof stream.getVideoTracks !== "function" || !stream.getVideoTracks().length) return;
            const participant = participants.find((p) => String(p.id) === String(userId));
            const displayName = participant?.displayName ?? participant?.name ?? `User ${userId}`;
            videoEntries.push({ key: `remote-${userId}`, type: "remote", stream, displayName });
          });
          if (videoEntries.length === 0) return null;
          const selectedKey = expandedVideoKey && videoEntries.some((e) => e.key === expandedVideoKey) ? expandedVideoKey : videoEntries[0].key;
          const selectedEntry = videoEntries.find((e) => e.key === selectedKey);
          return (
            <div className="flex w-full max-w-6xl flex-1 min-h-0 flex-col gap-4 px-2">
              <p className="text-center text-xs font-medium uppercase tracking-wider text-white/50">Video — click a tile to show larger</p>
              {/* Large stage: ~80% of viewport, full shared content scaled to fit (object-contain) */}
              <div className="relative flex-1 min-h-0 w-full flex flex-col items-center justify-center">
                <div className="relative w-[80vw] h-[80vh] max-w-full max-h-[80vh] rounded-2xl bg-black/80 ring-1 ring-white/10 overflow-hidden">
                  <div className="absolute inset-0">
                    {selectedEntry && selectedEntry.type === "local" && (
                      <LocalVideoTile stream={selectedEntry.stream} label={selectedEntry.label} size="large" />
                    )}
                    {selectedEntry && selectedEntry.type === "remote" && (
                      <RemoteVideoTile stream={selectedEntry.stream} displayName={selectedEntry.displayName} size="large" />
                    )}
                  </div>
                </div>
              </div>
              {/* Thumbnail strip */}
              <div className="flex flex-wrap justify-center gap-3">
                {videoEntries.map((entry) =>
                  entry.type === "local" ? (
                    <LocalVideoTile
                      key={entry.key}
                      stream={entry.stream}
                      label={entry.label}
                      isSelected={selectedKey === entry.key}
                      onClick={() => setExpandedVideoKey(selectedKey === entry.key ? null : entry.key)}
                    />
                  ) : (
                    <RemoteVideoTile
                      key={entry.key}
                      stream={entry.stream}
                      displayName={entry.displayName}
                      isSelected={selectedKey === entry.key}
                      onClick={() => setExpandedVideoKey(selectedKey === entry.key ? null : entry.key)}
                    />
                  )
                )}
              </div>
            </div>
          );
        })()}
      </main>

      {/* Bottom bar: Join / Leave, Camera, Share screen */}
      <footer className="relative flex flex-shrink-0 items-center justify-center gap-4 border-t border-white/10 bg-black/20 px-6 py-5">
        {isJoined ? (
          <>
            <button
              type="button"
              onClick={() => {
                onStopScreenShare?.();
                onLeave?.();
                onClose?.();
              }}
              className="rounded-xl bg-red-500/90 px-6 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors"
            >
              Leave call
            </button>
            <button
              type="button"
              onClick={isCameraEnabled ? onStopCamera : onStartCamera}
              className={`rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                isCameraEnabled
                  ? "bg-sky-500/90 text-white hover:bg-sky-500"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {isCameraEnabled ? "Camera off" : "Camera on"}
            </button>
            <button
              type="button"
              onClick={isSharingScreen ? onStopScreenShare : onStartScreenShare}
              className={`rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                isSharingScreen
                  ? "bg-amber-500/90 text-white hover:bg-amber-500"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {isSharingScreen ? "Stop sharing" : "Share screen"}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              onJoin?.();
              onClose?.();
            }}
            className="rounded-xl bg-emerald-500 px-8 py-3 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors"
          >
            Join call
          </button>
        )}
      </footer>
    </div>
  );
}

export default VoiceChannelModal;
