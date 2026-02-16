import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";

function MessageList({ messages, currentUserName }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-3 text-sm space-y-3"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 dark:text-gray-500">
          <p className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
            No messages yet
          </p>
          <p className="max-w-md text-xs">
            Start the conversation by sending a message. Markdown is supported.
          </p>
        </div>
      )}

      {messages.map((msg) => {
        const isSelf = msg.sender === currentUserName;
        return (
          <div
            key={msg.id ?? `${msg.sender}-${msg.createdAt}-${msg.content}`}
            className="flex gap-2"
          >
            <div className="mt-1 h-8 w-8 flex items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-semibold text-white">
              {msg.sender?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold">
                  {msg.sender || "Unknown"}
                  {isSelf && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-indigo-400">
                      you
                    </span>
                  )}
                </span>
                {msg.createdAt && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-500">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                )}
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_img]:my-1 [&_img]:max-h-48 [&_img]:rounded-lg">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default MessageList;

