import React from "react";

function VoiceChannels({
  channels,
  joinedChannelId,
  onOpenChannelView,
  onJoinChannel,
  onLeaveChannel,
}) {
  if (!channels.length) return null;

  const ch = channels[0];
  const isJoined = joinedChannelId === ch.id;

  const handleCardClick = () => {
    onOpenChannelView?.(ch.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="voice-channel-card group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-transparent bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-500/20 p-[2px] transition-all duration-300 hover:from-violet-500/40 hover:via-fuchsia-500/20 hover:to-cyan-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:from-violet-400/25 dark:via-fuchsia-400/15 dark:to-cyan-400/25 dark:hover:from-violet-400/35 dark:hover:via-fuchsia-400/25 dark:hover:to-cyan-400/35 dark:focus-visible:ring-offset-gray-900"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
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
            backgroundSize: "20px 20px",
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
              <svg
                className="h-5 w-5"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4zm0 14c-1.1 0-2 .9-2 2v2h4v-2c0-1.1-.9-2-2-2zm8-6V8a1 1 0 0 0-2 0v2h-2a1 1 0 0 0 0 2h2v2a1 1 0 0 0 2 0v-2h2a1 1 0 0 0 0-2h-2z" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
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
          </div>

          {/* Join / Leave call */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (isJoined) onLeaveChannel?.();
              else onJoinChannel?.(ch.id);
            }}
            className={`flex-shrink-0 rounded-lg p-1.5 transition-colors ${
              isJoined
                ? "text-red-500 hover:bg-red-100 hover:text-red-600 dark:text-red-400 dark:hover:bg-red-900/40 dark:hover:text-red-300"
                : "text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-300"
            }`}
            aria-label={isJoined ? "Leave call" : "Join call"}
          >
            {isJoined ? (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.517l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VoiceChannels;
