import React from "react";

function TextChannels({ channels, selectedChannelId, onSelectChannel }) {
  return (
    <ul className="space-y-0.5 text-sm">
      {channels.map((ch) => {
        const isActive = ch.id === selectedChannelId;
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
            <span className="text-gray-400 dark:text-gray-500">#</span>
            <span className="truncate">{ch.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

export default TextChannels;
