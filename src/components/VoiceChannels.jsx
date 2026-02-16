import React from "react";

function VoiceChannels({
  channels,
  joinedChannelId,
  onJoinChannel,
  onLeaveChannel
}) {
  const handleClick = (id) => {
    if (joinedChannelId === id) {
      onLeaveChannel?.();
    } else {
      onJoinChannel?.(id);
    }
  };

  return (
    <ul className="space-y-0.5 text-sm">
      {channels.map((ch) => {
        const isJoined = joinedChannelId === ch.id;
        return (
          <li
            key={ch.id}
            onClick={() => handleClick(ch.id)}
            className={[
              "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1",
              "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
              isJoined ? "bg-emerald-500/10 dark:bg-emerald-500/20" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isJoined ? "bg-emerald-500" : "bg-gray-400 dark:bg-gray-600"
              }`}
            />
            <span className="truncate">{ch.name}</span>
            <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {isJoined ? "Connected" : "Join"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default VoiceChannels;
