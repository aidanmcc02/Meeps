import React from "react";

function TextChannels({ channels, selectedChannelId, unreadChannelIds, onSelectChannel }) {
  const hasUnread = (channelId) =>
    unreadChannelIds && (unreadChannelIds instanceof Set ? unreadChannelIds.has(channelId) : unreadChannelIds.includes(channelId));

  return (
    <ul className="space-y-0.5 text-sm">
      {channels.map((ch) => {
        const isActive = ch.id === selectedChannelId;
        const unread = hasUnread(ch.id);
        return (
          <li
            key={ch.id}
            onClick={() => onSelectChannel?.(ch.id)}
            className={[
              "flex items-center gap-2 cursor-pointer rounded-md px-2 py-1",
              "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
              isActive ? "bg-gray-200 dark:bg-gray-800" : ""
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {unread ? (
              <span
                className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"
                title="Unread messages"
                aria-hidden="true"
              />
            ) : (
              <span className="w-2 flex-shrink-0" aria-hidden="true" />
            )}
            <span className="text-gray-400 dark:text-gray-500">#</span>
            <span className="truncate flex-1 min-w-0">{ch.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default TextChannels;
