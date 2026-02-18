import React, { useRef, useState, useEffect } from "react";

function slugFromName(name) {
  if (!name || typeof name !== "string") return "";
  return name.replace(/\s+/g, "_").trim();
}

function buildMentionOptions(presenceUsers, currentUser, profiles) {
  const options = [{ slug: "everyone", displayName: "everyone", type: "everyone" }];
  const seen = new Set(["everyone"]);
  const add = (displayName, id) => {
    const slug = slugFromName(displayName);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    options.push({ slug, displayName, id, type: "user" });
  };
  const curName = currentUser?.displayName;
  if (curName) add(curName, currentUser?.id);
  (presenceUsers || []).forEach((u) => add(u.displayName || u.name, u.id));
  Object.values(profiles || {}).forEach((p) => add(p?.displayName, p?.id));
  return options;
}

function MessageInput({
  value,
  onChange,
  onSend,
  onGifClick,
  placeholder,
  presenceUsers,
  currentUser,
  profiles,
  disabled,
  apiBase
}) {
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const mentionOptions = buildMentionOptions(presenceUsers, currentUser, profiles);
  const filteredOptions = mentionQuery
    ? mentionOptions.filter(
        (o) =>
          o.slug.toLowerCase().startsWith(mentionQuery.toLowerCase()) ||
          o.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : mentionOptions;
  const hasOptions = filteredOptions.length > 0;

  useEffect(() => {
    if (filteredOptions.length > 0) {
      setSelectedIndex((i) => Math.min(i, filteredOptions.length - 1));
    }
  }, [filteredOptions.length]);

  // When value or cursor changes, detect if we're in a @ mention context
  useEffect(() => {
    const v = value || "";
    const caret = textareaRef.current?.selectionStart ?? v.length;
    const textBeforeCaret = v.slice(0, caret);
    const lastAt = textBeforeCaret.lastIndexOf("@");
    if (lastAt === -1) {
      setShowMentions(false);
      return;
    }
    const afterAt = textBeforeCaret.slice(lastAt + 1);
    if (/\s/.test(afterAt)) {
      setShowMentions(false);
      return;
    }
    const isCompleteMention = mentionOptions.some((o) => o.slug === afterAt);
    setMentionStartIndex(lastAt);
    setMentionQuery(afterAt);
    setShowMentions(!isCompleteMention);
    setSelectedIndex(0);
  }, [value]);

  const handleFileSelect = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const base = (apiBase || "").replace(/\/$/, "");
    if (!base) {
      setUploadError("API URL not configured");
      e.target.value = "";
      return;
    }
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    for (let i = 0; i < Math.min(files.length, 5); i++) {
      formData.append("files", files[i]);
    }
    const uploadUrl = `${base}/api/upload`;
    try {
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || res.statusText || `Upload failed: ${res.status}`;
        if (res.status === 404) {
          setUploadError(
            "Upload endpoint not found (404). Restart the backend if running locally, or redeploy on Railway to enable file uploads."
          );
        } else {
          setUploadError(msg);
        }
        return;
      }
      const data = await res.json();
      const uploads = data.uploads || [];
      setPendingAttachments((prev) => [
        ...prev,
        ...uploads.map((u) => ({ id: u.id, filename: u.filename, url: u.url }))
      ]);
    } catch (err) {
      setUploadError(err.message || "Upload failed (network error)");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removePendingAttachment = (id) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSendClick = () => {
    const trimmed = (value || "").trim();
    const ids = pendingAttachments.map((a) => a.id);
    if (!trimmed && ids.length === 0) return;
    onSend(trimmed || (ids.length > 0 ? " " : ""), ids);
    setPendingAttachments([]);
  };

  const insertMention = (slug) => {
    const el = textareaRef.current;
    if (!el) return;
    const v = value || "";
    const start = mentionStartIndex;
    const end = el.selectionStart ?? start + 1;
    const before = v.slice(0, start);
    const after = v.slice(end);
    const next = `${before}@${slug} ${after}`;
    onChange(next);
    setShowMentions(false);
    el.focus();
    setTimeout(() => {
      const newCaret = before.length + slug.length + 2;
      el.setSelectionRange(newCaret, newCaret);
    }, 0);
  };

  useEffect(() => {
    if (!showMentions) return;
    const handleKeyDown = (e) => {
      if (!hasOptions) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredOptions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredOptions.length) % filteredOptions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        const isCompleteMention = mentionOptions.some((o) => o.slug === mentionQuery);
        if (!isCompleteMention) {
          const opt = filteredOptions[selectedIndex];
          if (opt) {
            e.preventDefault();
            insertMention(opt.slug);
          }
        }
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showMentions, hasOptions, filteredOptions, selectedIndex, mentionQuery, mentionOptions]);

  const canSend = (value?.trim() || pendingAttachments.length > 0) && !uploading;

  return (
    <div ref={containerRef} className="px-3 py-2 sm:px-4 sm:py-3 min-w-0">
      {pendingAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {pendingAttachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-1 text-xs"
            >
              <span className="truncate max-w-[120px]" title={a.filename}>{a.filename}</span>
              <button
                type="button"
                onClick={() => removePendingAttachment(a.id)}
                className="shrink-0 text-gray-500 hover:text-red-600 dark:hover:text-gray-400 dark:hover:text-red-400"
                aria-label="Remove attachment"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {uploadError && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-1">{uploadError}</p>
      )}
      <div className="relative flex items-end gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-700 dark:bg-gray-900 min-w-0">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          accept="*/*"
          onChange={handleFileSelect}
        />
        <div className="min-w-0 flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            className="min-h-[32px] max-h-24 min-w-0 w-full resize-none bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                const completingMention = showMentions && hasOptions && !mentionOptions.some((o) => o.slug === mentionQuery);
                if (completingMention) {
                  e.preventDefault();
                  insertMention(filteredOptions[selectedIndex].slug);
                  return;
                }
                e.preventDefault();
                handleSendClick();
              }
            }}
            disabled={disabled}
          />
          {showMentions && hasOptions && (
            <div
              className="absolute bottom-full left-0 mb-1 w-56 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800 py-1 z-50"
              role="listbox"
              aria-label="Mention suggestions"
            >
              {filteredOptions.map((opt, i) => (
                <button
                  key={opt.slug}
                  type="button"
                  role="option"
                  aria-selected={i === selectedIndex}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    i === selectedIndex
                      ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200"
                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(opt.slug);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  {opt.type === "everyone" ? (
                    <span className="font-medium">@everyone</span>
                  ) : (
                    <>
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">@</span>
                      <span>{opt.displayName}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 whitespace-nowrap"
            title="Upload file"
            aria-label="Upload file"
          >
            {uploading ? "…" : "📎"}
          </button>
          <button
            type="button"
            onClick={handleSendClick}
            disabled={!canSend}
            className="inline-flex items-center rounded-full bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            Send
          </button>
          {onGifClick && (
            <button
              type="button"
              onClick={onGifClick}
              className="inline-flex items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 whitespace-nowrap"
            >
              GIF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MessageInput;
