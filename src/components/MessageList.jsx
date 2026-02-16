import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const SCROLL_THRESHOLD = 100;

function MessageList({
  messages,
  currentUserName,
  currentUserId,
  profiles = {},
  senderNameToAvatar = {},
  onEditMessage,
  onDeleteMessage
}) {
  const containerRef = useRef(null);
  const prevCountRef = useRef(0);
  const lastMessageKeyRef = useRef(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

  const checkAtBottom = (el) => {
    if (!el) return true;
    const { scrollTop, scrollHeight, clientHeight } = el;
    return scrollHeight - scrollTop - clientHeight <= SCROLL_THRESHOLD;
  };

  const handleScroll = () => {
    setShowJumpToBottom(!checkAtBottom(containerRef.current));
  };

  const jumpToBottom = () => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
    }
  };

  // Only scroll to bottom when new messages are added or channel changed, not on every parent re-render
  // (e.g. when profiles load, channelMessages gets a new array reference and would otherwise scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const count = messages.length;
    const lastMsg = count > 0 ? messages[count - 1] : null;
    const lastKey = lastMsg ? (lastMsg.id ?? `${lastMsg.sender}-${lastMsg.createdAt}`) : null;
    const hadNewMessages = count > prevCountRef.current;
    const channelOrContentChanged = lastKey !== lastMessageKeyRef.current;
    prevCountRef.current = count;
    lastMessageKeyRef.current = lastKey;
    if (hadNewMessages || channelOrContentChanged) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
    }
  }, [messages]);

  return (
    <div className="relative flex-1 flex flex-col min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
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
        const canManage = isSelf && msg.id != null && onEditMessage && onDeleteMessage;
        const isEditing = editingId === msg.id;
        const profile = msg.senderId != null ? profiles[msg.senderId] : null;
        const avatarUrl = profile?.avatarUrl ?? senderNameToAvatar[msg.sender] ?? null;
        const initials = (msg.sender || "?")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "?";
        return (
          <div
            key={msg.id ?? `${msg.sender}-${msg.createdAt}-${msg.content}`}
            className={`flex gap-2 rounded-lg transition-colors ${canManage ? "group hover:bg-gray-100 dark:hover:bg-gray-800/60" : ""}`}
          >
            <div className="mt-1 h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-semibold text-white flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-1 min-w-0">
                <span className="text-xs font-semibold shrink-0">
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
                {canManage && (
                  <div className="ml-auto relative" ref={openMenuId === msg.id ? menuRef : null}>
                    <button
                      type="button"
                      onClick={() => {
                        if (openMenuId === msg.id) setOpenMenuId(null);
                        else setOpenMenuId(msg.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 focus:opacity-100 focus:outline-none transition-opacity"
                      aria-label="Message options"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="8" cy="3" r="1.5" />
                        <circle cx="8" cy="8" r="1.5" />
                        <circle cx="8" cy="13" r="1.5" />
                      </svg>
                    </button>
                    {openMenuId === msg.id && (
                      <div className="absolute right-0 top-full mt-1 py-1 w-36 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setEditingId(msg.id);
                            setEditContent(msg.content || "");
                            setOpenMenuId(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            if (window.confirm("Delete this message?")) {
                              onDeleteMessage(msg.id);
                            }
                            setOpenMenuId(null);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="mt-1 space-y-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = editContent.trim();
                        if (trimmed) onEditMessage(msg.id, trimmed);
                        setEditingId(null);
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_img]:my-1 [&_img]:max-h-48 [&_img]:rounded-lg">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        );
      })}
      </div>
      {showJumpToBottom && (
        <button
          type="button"
          onClick={jumpToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900 dark:focus:ring-offset-gray-950"
          aria-label="Jump to bottom"
        >
          Jump to bottom
        </button>
      )}
    </div>
  );
}

export default MessageList;

