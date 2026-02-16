import React from "react";

function isGifUrl(url) {
  return typeof url === "string" && url.toLowerCase().includes(".gif");
}

function VoiceChannels({
  channels,
  joinedChannelId,
  channelParticipants = {},
  profiles = {},
  speakingUserIds = [],
  onOpenChannelView,
  onJoinChannel,
  onLeaveChannel,
  onOpenSoundSettings
}) {
  if (!channels.length) return null;

  const ch = channels[0];
  const isJoined = joinedChannelId === ch.id;
  const participants = channelParticipants[ch.id] || [];
  const count = participants.length;

  return (
    <div
      onClick={() => onOpenChannelView?.(ch.id)}
      className="voice-channel-card group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-transparent bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-500/20 p-[2px] transition-all duration-300 hover:from-violet-500/40 hover:via-fuchsia-500/20 hover:to-cyan-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:from-violet-400/25 dark:via-fuchsia-400/15 dark:to-cyan-400/25 dark:hover:from-violet-400/35 dark:hover:via-fuchsia-400/25 dark:hover:to-cyan-400/35 dark:focus-visible:ring-offset-gray-900"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenChannelView?.(ch.id);
        }
      }}
    >
      <div
        className={`relative rounded-[14px] px-4 py-3.5 transition-colors ${
          isJoined
            ? "bg-emerald-500/10 dark:bg-emerald-500/15"
            : "bg-white/90 dark:bg-gray-900/90"
        }`}
      >
        {/* Subtle grid texture */}
        <div
          className="pointer-events-none absolute inset-0 rounded-[14px] opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: "20px 20px"
          }}
        />

        <div className="relative flex items-center gap-3">
          {/* Icon + status */}
          <div
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
              isJoined
                ? "bg-emerald-500/20 text-emerald-600 dark:bg-emerald-400/25 dark:text-emerald-300"
                : "bg-gradient-to-br from-violet-500/30 to-cyan-500/30 text-violet-600 dark:from-violet-400/40 dark:to-cyan-400/40 dark:text-violet-300"
            }`}
          >
            {isJoined ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zm0 14c-1.1 0-2 .9-2 2v2h4v-2c0-1.1-.9-2-2-2zm8-6V8a1 1 0 0 0-2 0v2h-2a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0v-2h2a1 1 0 0 0 0-2h-2z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-white truncate">
                {ch.name}
              </span>
              {isJoined && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-400/25 dark:text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              {participants.length > 0 ? (
                <>
                  <div className="flex -space-x-2" title={participants.map((p) => p.displayName || `User ${p.id}`).join(", ")}>
                    {participants.slice(0, 3).map((p) => {
                      const profile = profiles[p.id];
                      const avatarUrl = profile?.avatarUrl || null;
                      const name = p.displayName || profile?.displayName || `User ${p.id}`;
                      const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";
                      const isSpeaking = speakingUserIds.includes(String(p.id));
                      return (
                        <div
                          key={p.id}
                          className={`h-6 w-6 rounded-full overflow-hidden border-2 flex items-center justify-center text-[10px] font-semibold transition-all ${
                            isSpeaking
                              ? "border-emerald-400 dark:border-emerald-400 ring-2 ring-emerald-400/80 dark:ring-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.6)] dark:shadow-[0_0_10px_rgba(52,211,153,0.5)]"
                              : "border-white dark:border-gray-900 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                          }`}
                        >
                          {avatarUrl && (isSpeaking || !isGifUrl(avatarUrl)) ? (
                            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">{initials}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {count} {count === 1 ? "person" : "people"} in call
                  </span>
                </>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isJoined ? "Waiting for others…" : "No one in call"}
                </span>
              )}
            </div>
          </div>

          {/* Sound settings */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSoundSettings?.();
            }}
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-200/80 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
            aria-label="Sound settings"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChannels;
