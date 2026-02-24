import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const SCROLL_THRESHOLD = 100;
const SCROLL_TOP_LOAD_OLDER = 150;

function formatMessageTime(createdAt) {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const msAgo = now - d;
  const twentyFourHours = 24 * 60 * 60 * 1000;
  // Use user's local timezone for display (legacy options for broad support)
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (msAgo < twentyFourHours && msAgo >= 0) return timeStr;
  const dateStr = d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
  return `${dateStr}, ${timeStr}`;
}

// Tooltip for message timestamp (avoids dateStyle/timeStyle for older envs)
function formatMessageTimeTooltip(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const sameDay = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();
  if (sameDay) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], {
    month: "long",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined
  });
}

function groupMessagesByDay(messages) {
  const groups = [];
  let currentDate = null;
  let currentGroup = null;
  for (const msg of messages) {
    const createdAt = msg.createdAt;
    const dateKey = createdAt
      ? new Date(createdAt).toISOString().slice(0, 10)
      : "__nodate__";
    if (dateKey !== currentDate) {
      currentDate = dateKey;
      currentGroup = { dateKey, messages: [] };
      groups.push(currentGroup);
    }
    currentGroup.messages.push(msg);
  }
  return groups;
}

const CONSECUTIVE_MESSAGE_GAP_MS = 2 * 60 * 1000; // 2 minutes – show header again if gap is larger

/** Group consecutive messages from the same sender (by senderId or sender name). Splits a new run if more than 2 minutes since previous message. */
function groupConsecutiveBySender(messages) {
  if (!messages.length) return [];
  const runs = [];
  let current = { sender: messages[0].sender, senderId: messages[0].senderId, messages: [messages[0]] };
  for (let i = 1; i < messages.length; i++) {
    const msg = messages[i];
    const sameSender =
      (msg.senderId != null && current.senderId != null && Number(msg.senderId) === Number(current.senderId)) ||
      (msg.sender === current.sender && current.sender != null);
    const lastInRun = current.messages[current.messages.length - 1];
    const lastTime = lastInRun?.createdAt ? new Date(lastInRun.createdAt).getTime() : 0;
    const thisTime = msg.createdAt ? new Date(msg.createdAt).getTime() : 0;
    const gapOk = thisTime - lastTime <= CONSECUTIVE_MESSAGE_GAP_MS;
    if (sameSender && gapOk) {
      current.messages.push(msg);
    } else {
      runs.push(current);
      current = { sender: msg.sender, senderId: msg.senderId, messages: [msg] };
    }
  }
  runs.push(current);
  return runs;
}

// Match @mention (e.g. @person1, @everyone, @Person_One) - turn into markdown links so we can render with custom component
const MENTION_PATTERN = /@(\S+)/g;
function contentWithMentionLinks(content) {
  return content.replace(MENTION_PATTERN, (_, slug) => `[@${slug}](mention:${slug})`);
}

// True if message content mentions the current user (by slug or @everyone)
function messageMentionsCurrentUser(content, currentUserName, mentionSlugToName) {
  if (!content || typeof content !== "string") return false;
  const trimmedName = (currentUserName || "").trim();
  if (!trimmedName) return false;
  const currentSlug = trimmedName.replace(/\s+/g, "_").toLowerCase();

  // Use a fresh regex each time so we don't depend on global lastIndex
  const re = /@(\S+)/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const rawSlug = match[1] || "";
    const slug = rawSlug.toLowerCase();

    // @everyone highlights for everyone
    if (slug === "everyone") return true;

    // Direct slug match (case-insensitive)
    if (slug === currentSlug) return true;

    // Fallback: see if this slug maps to the current user's display name
    if (mentionSlugToName && mentionSlugToName[rawSlug] === trimmedName) {
      return true;
    }
  }
  return false;
}

function MentionLink({ href, children, mentionSlugToName }) {
  if (href?.startsWith("mention:")) {
    const slug = href.slice(8);
    const displayName = mentionSlugToName[slug] ?? slug;
    return (
      <span className="mention inline-flex items-center rounded px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 font-medium">
        @{displayName}
      </span>
    );
  }
  return <a href={href}>{children}</a>;
}

function MessageList({
  messages,
  channelId,
  currentUserName,
  currentUserId,
  profiles = {},
  senderNameToAvatar = {},
  mentionSlugToName = {},
  onEditMessage,
  onDeleteMessage,
  onLoadOlder,
  hasMoreOlder = false,
  loadingOlder = false,
  apiBase = ""
}) {
  const containerRef = useRef(null);
  const prevCountRef = useRef(0);
  const lastMessageKeyRef = useRef(null);
  const prevChannelIdRef = useRef(channelId);
  const savedScrollHeightRef = useRef(null);
  const loadOlderRequestedRef = useRef(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState("");
  const menuRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

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
    const el = containerRef.current;
    if (
      onLoadOlder &&
      hasMoreOlder &&
      !loadingOlder &&
      !loadOlderRequestedRef.current &&
      messages.length > 0 &&
      el &&
      el.scrollTop <= SCROLL_TOP_LOAD_OLDER
    ) {
      const firstId = messages[0].id;
      if (firstId != null) {
        loadOlderRequestedRef.current = true;
        savedScrollHeightRef.current = el.scrollHeight;
        onLoadOlder(firstId);
      }
    }
  };

  useEffect(() => {
    if (!loadingOlder) loadOlderRequestedRef.current = false;
  }, [loadingOlder]);

  const jumpToBottom = () => {
    const el = containerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setShowJumpToBottom(false);
    }
  };

  // When user switches back to this channel, scroll to bottom so new messages (received while away) are visible
  useEffect(() => {
    if (channelId == null || channelId === prevChannelIdRef.current) return;
    prevChannelIdRef.current = channelId;
    const el = containerRef.current;
    if (!el) return;
    const scrollToBottom = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
        setShowJumpToBottom(false);
      }
    };
    scrollToBottom();
    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToBottom);
    });
  }, [channelId]);

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
      const scrollToBottom = () => {
        if (el) {
          el.scrollTop = el.scrollHeight;
          setShowJumpToBottom(false);
        }
      };
      scrollToBottom();
      requestAnimationFrame(() => {
        requestAnimationFrame(scrollToBottom);
      });
    }
  }, [messages]);

  // Restore scroll position after prepending older messages
  useEffect(() => {
    const el = containerRef.current;
    const saved = savedScrollHeightRef.current;
    if (el && saved != null) {
      const delta = el.scrollHeight - saved;
      if (delta > 0) {
        el.scrollTop += delta;
      }
      savedScrollHeightRef.current = null;
    }
  }, [messages]);

  useEffect(() => {
    if (!lightbox) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        setLightbox(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightbox]);

  return (
    <div className="relative flex-1 flex min-h-0 flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 text-sm space-y-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
      {loadingOlder && (
        <div className="flex justify-center py-2 text-gray-500 dark:text-gray-400 text-xs">
          Loading older messages…
        </div>
      )}
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

      {groupMessagesByDay(messages).map(({ dateKey, messages: dayMessages }) => (
        <div key={dateKey} className="space-y-3">
          <div className="flex items-center gap-3 py-2">
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">
              {dateKey === "__nodate__" ? "" : formatDayLabel(dateKey)}
            </span>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-700" />
          </div>
          {groupConsecutiveBySender(dayMessages).map((run) => {
            const first = run.messages[0];
            const runKey = first.id ?? `${run.sender}-${first.createdAt}`;
            const profile = first.senderId != null ? profiles[first.senderId] : null;
            const avatarUrl = profile?.avatarUrl ?? senderNameToAvatar[first.sender] ?? null;
            const initials = (first.sender || "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?";
            return (
              <div key={runKey} className="space-y-0">
                {run.messages.map((msg, runIndex) => {
        const showHeader = runIndex === 0;
        const isSelf = msg.sender === currentUserName;
        const isMentioned = messageMentionsCurrentUser(msg.content, currentUserName, mentionSlugToName);
        const canManage = isSelf && msg.id != null && onEditMessage && onDeleteMessage;
        const isEditing = editingId === msg.id;
        return (
          <div
            key={msg.id ?? `${msg.sender}-${msg.createdAt}-${runIndex}-${msg.content}`}
            className={`flex gap-2 rounded-lg transition-colors px-2 -mx-2 ${showHeader ? "py-1" : "pt-0 pb-0.5"} ${isMentioned ? "bg-amber-100 dark:bg-amber-900/30" : ""} ${canManage && !isMentioned ? "group hover:bg-gray-100 dark:hover:bg-gray-800/60" : canManage && isMentioned ? "group hover:bg-amber-200 dark:hover:bg-amber-900/50" : ""}`}
          >
            {showHeader ? (
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
            ) : (
              <div className="w-8 flex-shrink-0 self-stretch min-h-[2px]" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              {showHeader ? (
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
                  <span
                    className="text-xs text-gray-500 dark:text-gray-400"
                    title={formatMessageTimeTooltip(msg.createdAt)}
                  >
                    {formatMessageTime(msg.createdAt)}
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
              ) : canManage ? (
              <div className="relative h-0 overflow-visible">
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity z-10" ref={openMenuId === msg.id ? menuRef : null}>
                  <button
                    type="button"
                    onClick={() => {
                      if (openMenuId === msg.id) setOpenMenuId(null);
                      else setOpenMenuId(msg.id);
                    }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 focus:opacity-100 focus:outline-none"
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
              </div>
              ) : null}
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
                <>
                  {(msg.content?.trim() || "") !== "" && (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_img]:my-1 [&_img]:max-h-48 [&_img]:rounded-lg [&_.mention]:font-medium">
                      <ReactMarkdown
                        components={{
                          a: ({ href, children }) => (
                            <MentionLink href={href} mentionSlugToName={mentionSlugToName}>
                              {children}
                            </MentionLink>
                          )
                        }}
                      >
                        {contentWithMentionLinks(msg.content)}
                      </ReactMarkdown>
                    </div>
                  )}
                  {msg.attachments?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => {
                        const fileId = att.publicId || att.id;
                        let url = null;
                        if (att.url) {
                          url = att.url.startsWith("http")
                            ? att.url
                            : apiBase
                            ? `${apiBase.replace(/\/$/, "")}${att.url}`
                            : null;
                        } else if (apiBase && fileId) {
                          url = `${apiBase.replace(/\/$/, "")}/api/files/${fileId}`;
                        }
                        const isImage = att.mimeType?.startsWith("image/");
                        return (
                          <div key={att.id} className="flex flex-col">
                            {url ? (
                              isImage ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightbox({
                                      url,
                                      alt: att.filename
                                    })
                                  }
                                  className="block rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 max-w-xs max-h-48 bg-black/5 dark:bg-white/5"
                                >
                                  <img
                                    src={url}
                                    alt={att.filename}
                                    className="max-h-48 w-auto object-contain"
                                  />
                                </button>
                              ) : (
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                                >
                                  <span className="truncate max-w-[180px]" title={att.filename}>{att.filename}</span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">↗</span>
                                </a>
                              )
                            ) : (
                              <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[180px]" title={att.filename}>
                                {att.filename} (expired)
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
                })}
              </div>
            );
          })}
        </div>
      ))}
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
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setLightbox(null)}
          role="presentation"
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightbox.url}
              alt={lightbox.alt || ""}
              className="max-h-[90vh] w-auto max-w-full rounded-lg shadow-2xl object-contain bg-black"
            />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 rounded-full bg-black/70 text-white px-3 py-1 text-xs font-medium hover:bg-black"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageList;

