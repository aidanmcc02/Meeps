import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DianaEmbed, { parseLegacyDianaMarkdown } from "./DianaEmbed";

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

// Match @mention (e.g. @person1, @everyone, @Person_One)
const MENTION_PATTERN = /@(\S+)/g;
/** Split content into segments: { type: 'text', value } or { type: 'mention', slug } - so we never render mentions as links */
function splitContentSegments(content) {
  if (!content || typeof content !== "string") return [{ type: "text", value: "" }];
  const segments = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_PATTERN.source, "g");
  let match;
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", slug: match[1] || "" });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }
  return segments.length ? segments : [{ type: "text", value: content }];
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

/** Mention as a plain span only - never a link. */
function MentionSpan({ slug, mentionSlugToName = {}, onMentionHover, onMentionLeave }) {
  const displayName = mentionSlugToName[slug] ?? slug.replace(/_/g, " ");
  const stopInteraction = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <span
      data-mention={slug}
      role="button"
      tabIndex={-1}
      className="mention inline-flex items-center rounded px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 font-medium cursor-pointer select-none"
      onMouseDown={stopInteraction}
      onClick={stopInteraction}
      onMouseEnter={(e) => {
        if (onMentionHover) onMentionHover(slug, e.currentTarget.getBoundingClientRect());
      }}
      onMouseLeave={() => {
        if (onMentionLeave) onMentionLeave();
      }}
    >
      @{displayName}
    </span>
  );
}

/** Renders only real URLs as links. Mention-like hrefs render as MentionSpan (never <a>). */
function MessageLink({
  href,
  children,
  mentionSlugToName = {},
  onMentionHover,
  onMentionLeave
}) {
  const isMention = href && typeof href === "string" && /mention:/i.test(href) && !href.startsWith("http");
  if (isMention) {
    const slug = (href.replace(/^[^:]*mention:/i, "").trim() || href.slice(8).trim());
    return (
      <MentionSpan
        slug={slug}
        mentionSlugToName={mentionSlugToName}
        onMentionHover={onMentionHover}
        onMentionLeave={onMentionLeave}
      />
    );
  }
  // External links: open in default browser (Tauri: shell.open; web: target=_blank)
  const isExternal = href?.startsWith("http://") || href?.startsWith("https://");
  const handleClick = async (e) => {
    if (!isExternal || !href) return;
    if (window.__TAURI__) {
      e.preventDefault();
      try {
        const { open } = await import("@tauri-apps/api/shell");
        await open(href);
      } catch (err) {
        console.warn("Failed to open link in browser:", err);
        window.open(href, "_blank", "noopener,noreferrer");
      }
    }
  };
  return (
    <a
      href={href}
      target={isExternal && !window.__TAURI__ ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      onClick={handleClick}
      className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium break-all"
    >
      {children}
    </a>
  );
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
  apiBase = "",
  onSenderClick
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
  const [hoveredMention, setHoveredMention] = useState(null);
  const mentionHandlersRef = useRef({ setHoveredMention: () => {}, resolveMentionProfile: () => null });

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
    if (hoveredMention) {
      setHoveredMention(null);
    }
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

  const resolveMentionProfile = (slug) => {
    if (!slug) return null;
    const displayName =
      mentionSlugToName[slug] ??
      slug.replace(/_/g, " ");
    if (!displayName) return null;
    const trimmed = displayName.trim();
    const lower = trimmed.toLowerCase();
    const allProfiles = Object.values(profiles || {});
    const byDisplayName = allProfiles.find(
      (p) => (p?.displayName || "").trim().toLowerCase() === lower
    );
    return (
      byDisplayName || {
        displayName: trimmed || null,
        avatarUrl: null,
        bannerUrl: null
      }
    );
  };

  const handleMentionHover = (slug, rect) => {
    const profile = resolveMentionProfile(slug);
    if (!profile || !rect) {
      setHoveredMention(null);
      return;
    }
    const centerX = rect.left + rect.width / 2;
    const top = rect.bottom + 8;
    setHoveredMention({
      slug,
      profile,
      position: {
        top,
        left: centerX
      }
    });
  };

  const handleMentionLeave = () => {
    setHoveredMention(null);
  };

  mentionHandlersRef.current = {
    setHoveredMention,
    resolveMentionProfile
  };

  useEffect(() => {
    const onDocMousedown = (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-mention]") || target.closest("a[href^='mention:']")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onDocClick = (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      if (target.closest("[data-mention]") || target.closest("a[href^='mention:']")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onDocMouseOver = (e) => {
      const el = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-mention]") : null;
      if (!el) {
        mentionHandlersRef.current.setHoveredMention(null);
        return;
      }
      const slug = el.getAttribute("data-mention");
      if (!slug) return;
      const rect = el.getBoundingClientRect();
      const profile = mentionHandlersRef.current.resolveMentionProfile(slug);
      if (!profile) {
        mentionHandlersRef.current.setHoveredMention(null);
        return;
      }
      const centerX = rect.left + rect.width / 2;
      mentionHandlersRef.current.setHoveredMention({
        slug,
        profile,
        position: { top: rect.bottom + 8, left: centerX }
      });
    };
    const onDocMouseOut = (e) => {
      const from = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-mention]") : null;
      const to = e.relatedTarget && typeof e.relatedTarget.closest === "function" ? e.relatedTarget.closest("[data-mention]") : null;
      if (from && !to) mentionHandlersRef.current.setHoveredMention(null);
    };
    document.addEventListener("mousedown", onDocMousedown, true);
    document.addEventListener("click", onDocClick, true);
    document.addEventListener("mouseover", onDocMouseOver, true);
    document.addEventListener("mouseout", onDocMouseOut, true);
    return () => {
      document.removeEventListener("mousedown", onDocMousedown, true);
      document.removeEventListener("click", onDocClick, true);
      document.removeEventListener("mouseover", onDocMouseOver, true);
      document.removeEventListener("mouseout", onDocMouseOut, true);
    };
  }, []);

  const handleRootClickCapture = (e) => {
    const mentionEl = e.target?.closest?.("[data-mention]");
    const mentionLink = e.target?.closest?.("a[href^='mention:']");
    if (mentionEl || mentionLink) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleRootMouseOver = (e) => {
    const mentionEl = e.target?.closest?.("[data-mention]");
    const mentionLink = e.target?.closest?.("a[href^='mention:']");
    const el = mentionEl || mentionLink;
    if (!el) {
      if (hoveredMention) handleMentionLeave();
      return;
    }
    const slug = mentionEl
      ? (mentionEl.getAttribute("data-mention") || "")
      : (() => {
          const h = (mentionLink.getAttribute("href") || "").replace(/^mention:/i, "");
          return h;
        })();
    if (!slug) {
      if (hoveredMention) handleMentionLeave();
      return;
    }
    const rect = el.getBoundingClientRect();
    handleMentionHover(slug, rect);
  };

  return (
    <div className="relative flex-1 flex min-h-0 flex-col overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClickCapture={handleRootClickCapture}
        onMouseOver={handleRootMouseOver}
        onMouseLeave={handleMentionLeave}
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
              onSenderClick && (first.senderId != null || first.sender) ? (
                <button
                  type="button"
                  onClick={() => onSenderClick({
                    id: first.senderId ?? first.sender,
                    displayName: first.sender || profile?.displayName,
                    name: first.sender
                  })}
                  className="mt-1 h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 text-xs font-semibold text-white flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </button>
              ) : (
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
              )
            ) : (
              <div className="w-8 flex-shrink-0 self-stretch min-h-[2px]" aria-hidden="true" />
            )}
            <div className="flex-1 min-w-0">
              {showHeader ? (
              <div className="flex items-baseline gap-2 flex-1 min-w-0">
                <span className="text-xs font-semibold shrink-0 flex items-center gap-1 flex-wrap">
                  {onSenderClick && (first.senderId != null || first.sender) ? (
                    <button
                      type="button"
                      onClick={() => onSenderClick({
                        id: first.senderId ?? first.sender,
                        displayName: first.sender || profile?.displayName,
                        name: first.sender
                      })}
                      className="text-left hover:underline focus:outline-none focus:underline cursor-pointer text-gray-900 dark:text-white"
                    >
                      {msg.sender || "Unknown"}
                    </button>
                  ) : (
                    <span>{msg.sender || "Unknown"}</span>
                  )}
                  {profile?.userType === "bot" && (
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                      Bot
                    </span>
                  )}
                  {isSelf && (
                    <span className="text-[10px] uppercase tracking-wide text-indigo-400">
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
                      <div className="absolute right-0 bottom-full mb-1 flex gap-0.5 py-1 px-1 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                        <button
                          type="button"
                          className="p-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => {
                            setEditingId(msg.id);
                            setEditContent(msg.content || "");
                            setOpenMenuId(null);
                          }}
                          aria-label="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="p-2 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            if (window.confirm("Delete this message?")) {
                              onDeleteMessage(msg.id);
                            }
                            setOpenMenuId(null);
                          }}
                          aria-label="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
                    <div className="absolute right-0 bottom-full mb-1 flex gap-0.5 py-1 px-1 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      <button
                        type="button"
                        className="p-2 rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => {
                          setEditingId(msg.id);
                          setEditContent(msg.content || "");
                          setOpenMenuId(null);
                        }}
                        aria-label="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="p-2 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => {
                          if (window.confirm("Delete this message?")) {
                            onDeleteMessage(msg.id);
                          }
                          setOpenMenuId(null);
                        }}
                        aria-label="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
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
                  {msg.embed ? (
                    <DianaEmbed embed={msg.embed} />
                  ) : msg.sender === "Diana" && msg.content ? (
                    (() => {
                      const legacyEmbed = parseLegacyDianaMarkdown(msg.content, msg.createdAt);
                      return legacyEmbed ? (
                        <DianaEmbed embed={legacyEmbed} />
                      ) : (
                        <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_img]:my-1 [&_img]:max-h-48 [&_img]:rounded-lg [&_.mention]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_strong]:text-inherit [&_em]:italic [&_del]:line-through [&_a]:text-indigo-600 [&_a]:dark:text-indigo-400 [&_a]:hover:underline">
                          {splitContentSegments(msg.content).map((seg, i) =>
                            seg.type === "mention" ? (
                              <MentionSpan
                                key={i}
                                slug={seg.slug}
                                mentionSlugToName={mentionSlugToName}
                                onMentionHover={handleMentionHover}
                                onMentionLeave={handleMentionLeave}
                              />
                            ) : (
                              <ReactMarkdown
                                key={i}
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  a: ({ href, children }) => (
                                    <MessageLink
                                      href={href}
                                      mentionSlugToName={mentionSlugToName}
                                      onMentionHover={handleMentionHover}
                                      onMentionLeave={handleMentionLeave}
                                    >
                                      {children}
                                    </MessageLink>
                                  ),
                                  p: ({ children }) => <span className="inline">{children}</span>
                                }}
                              >
                                {seg.value}
                              </ReactMarkdown>
                            )
                          )}
                        </div>
                      );
                    })()
                  ) : (msg.content?.trim() || "") !== "" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_img]:my-1 [&_img]:max-h-48 [&_img]:rounded-lg [&_.mention]:font-medium [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-bold [&_strong]:text-inherit [&_em]:italic [&_del]:line-through [&_a]:text-indigo-600 [&_a]:dark:text-indigo-400 [&_a]:hover:underline">
                      {splitContentSegments(msg.content).map((seg, i) =>
                        seg.type === "mention" ? (
                          <MentionSpan
                            key={i}
                            slug={seg.slug}
                            mentionSlugToName={mentionSlugToName}
                            onMentionHover={handleMentionHover}
                            onMentionLeave={handleMentionLeave}
                          />
                        ) : (
                          <ReactMarkdown
                            key={i}
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => (
                                <MessageLink
                                  href={href}
                                  mentionSlugToName={mentionSlugToName}
                                  onMentionHover={handleMentionHover}
                                  onMentionLeave={handleMentionLeave}
                                >
                                  {children}
                                </MessageLink>
                              ),
                              p: ({ children }) => <span className="inline">{children}</span>
                            }}
                          >
                            {seg.value}
                          </ReactMarkdown>
                        )
                      )}
                    </div>
                  ) : null}
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
      {hoveredMention && hoveredMention.profile && (
        <div
          className="pointer-events-none fixed z-[100]"
          style={{
            top: hoveredMention.position.top,
            left: (() => {
              const cardWidth = 256;
              const centerX = hoveredMention.position.left;
              const left = centerX - cardWidth / 2;
              const maxLeft = typeof window !== "undefined" ? window.innerWidth - cardWidth - 16 : left;
              return Math.max(8, Math.min(maxLeft, left));
            })()
          }}
        >
          <div className="pointer-events-auto w-64 rounded-xl border border-gray-200 bg-gray-900 text-xs text-gray-100 shadow-xl dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
            {hoveredMention.profile.bannerUrl && (
              <div className="h-16 w-full overflow-hidden">
                <img
                  src={hoveredMention.profile.bannerUrl}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
              </div>
            )}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 flex-shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-sky-500 text-[11px] font-semibold text-white flex items-center justify-center">
                  {hoveredMention.profile.avatarUrl ? (
                    <img
                      src={hoveredMention.profile.avatarUrl}
                      alt={hoveredMention.profile.displayName || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (hoveredMention.profile.displayName || "")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "MU"
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">
                    {hoveredMention.profile.displayName || "Meeps User"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessageList;

