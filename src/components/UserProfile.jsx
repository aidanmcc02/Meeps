import React, { useEffect, useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import GifPickerModal from "./GifPickerModal";
import GamerTagsModal from "./GamerTagsModal";

const API_BASE =
  import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";

const STATUS_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "idle", label: "Idle" },
  { value: "do_not_disturb", label: "Do not disturb" },
];

const STATUS_DOT_CLASS = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  do_not_disturb: "bg-red-500",
  offline: "bg-gray-500",
};

function UserProfile({
  profile,
  onSave,
  activity,
  editable = true,
  userStatus,
  onUserStatusChange,
  onLogout,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [winGifUrl, setWinGifUrl] = useState("");
  const [loseGifUrl, setLoseGifUrl] = useState("");
  const [leagueUsername, setLeagueUsername] = useState("");
  const [bannerHovered, setBannerHovered] = useState(false);
  const [gifTarget, setGifTarget] = useState(null); // "banner" | "avatar" | "win" | "lose" | null
  const [gamerTagsOpen, setGamerTagsOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarUploadError, setAvatarUploadError] = useState(null);
  const [avatarChangeOpen, setAvatarChangeOpen] = useState(false);
  const [bannerChangeOpen, setBannerChangeOpen] = useState(false);
  const avatarFileInputRef = useRef(null);
  const errorTimeoutMs = 30 * 1000;

  useEffect(() => {
    if (!avatarUploadError) return;
    const timeoutId = setTimeout(
      () => setAvatarUploadError(null),
      errorTimeoutMs,
    );
    return () => clearTimeout(timeoutId);
  }, [avatarUploadError, errorTimeoutMs]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "Meeps User");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatarUrl || "");
    setBannerUrl(profile.bannerUrl || "");
    setWinGifUrl(profile.winGifUrl || "");
    setLoseGifUrl(profile.loseGifUrl || "");
    setLeagueUsername(profile.leagueUsername || "");
    setAchievementsText(
      Array.isArray(profile.achievements)
        ? profile.achievements.join("\n")
        : "",
    );
  }, [profile]);

  // Lock body scroll when Edit Profile modal is open (PWA / mobile)
  useEffect(() => {
    if (!isEditing) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setGamerTagsOpen(false);
      setAvatarChangeOpen(false);
      setBannerChangeOpen(false);
    }
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) setStatusOpen(false);
  }, [isEditing]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!onSave || !profile) return;

    const achievements = achievementsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    onSave({
      id: profile.id,
      displayName: displayName || "Meeps User",
      bio,
      achievements,
      avatarUrl: avatarUrl || null,
      bannerUrl: bannerUrl || null,
      winGifUrl: winGifUrl || null,
      loseGifUrl: loseGifUrl || null,
      leagueUsername: leagueUsername.trim() || "",
    });
    setIsEditing(false);
  };

  const handleAvatarUpload = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const base = (API_BASE || "").replace(/\/$/, "");
    if (!base) {
      setAvatarUploadError("API URL not configured");
      return;
    }
    setAvatarUploadError(null);
    setAvatarUploading(true);
    const formData = new FormData();
    // Only take the first file for avatar.
    formData.append("files", files[0]);
    const uploadUrl = `${base}/api/upload`;
    try {
      const token = window.localStorage.getItem("meeps_token");
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          data.message || res.statusText || `Upload failed: ${res.status}`;
        setAvatarUploadError(msg);
        return;
      }
      const data = await res.json();
      const uploads = data.uploads || [];
      const first = uploads[0];
      if (!first || !first.publicId) {
        setAvatarUploadError("Upload did not return an image id");
        return;
      }
      // Store a stable, unsigned /api/files/:publicId URL so the backend can
      // detect and pin this upload, preventing it from being cleaned up.
      const avatarPath = `/api/files/${first.publicId}`;
      setAvatarUrl(avatarPath);
    } catch (err) {
      setAvatarUploadError(err.message || "Upload failed (network error)");
    } finally {
      setAvatarUploading(false);
    }
  };

  const handlePickGif = (gif) => {
    if (!gif) return;
    const url = gif.url || gif.previewUrl;
    if (!url) return;
    if (gifTarget === "banner") setBannerUrl(url);
    if (gifTarget === "avatar") setAvatarUrl(url);
    if (gifTarget === "win") setWinGifUrl(url);
    if (gifTarget === "lose") setLoseGifUrl(url);
    setGifTarget(null);
  };

  const initials =
    (profile?.displayName || "Meeps User")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MU";

  const hasBanner = !!bannerUrl;

  return (
    <div className="group rounded-xl border border-gray-200 bg-gray-900 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900 overflow-hidden px-0 pt-0 pb-0 relative">
      {hasBanner && (
        <div className="relative h-16 w-full overflow-hidden">
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent" />
        </div>
      )}
      <div
        className={`px-3 pt-2 pb-2 ${!hasBanner ? "bg-gray-50 dark:bg-gray-800" : ""}`}
      >
        {!profile && (
          <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-md" />
        )}

        {profile && (
          <>
            {!hasBanner && (
              <div
                className="mb-2 h-14 w-full overflow-hidden rounded-lg bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-sky-500 opacity-80"
                onMouseEnter={() => setBannerHovered(true)}
                onMouseLeave={() => setBannerHovered(false)}
              >
                <div
                  className={`h-full w-full transition-opacity duration-300 ${bannerHovered ? "opacity-100" : "opacity-80"}`}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="relative h-9 w-9 flex-shrink-0">
                  <div className="h-full w-full rounded-full overflow-hidden ring-2 ring-white/80 dark:ring-gray-900/80">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-xs font-semibold text-white flex items-center justify-center">
                        {initials}
                      </div>
                    )}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm z-10 ${userStatus ? STATUS_DOT_CLASS[userStatus] || STATUS_DOT_CLASS.online : "bg-emerald-500"}`}
                    aria-hidden
                  />
                </div>
                <div className="flex flex-col leading-tight min-w-0 flex-1">
                  <span className="text-xs font-semibold text-gray-100 dark:text-white">
                    {profile.displayName || "Meeps User"}
                  </span>
                  {onUserStatusChange && userStatus != null && (
                    <div className="relative mt-1">
                      <button
                        type="button"
                        onClick={() => setStatusOpen((o) => !o)}
                        className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 dark:text-gray-500 dark:hover:text-gray-300"
                        aria-haspopup="listbox"
                        aria-expanded={statusOpen}
                        aria-label="Change status"
                      >
                        <span className="capitalize">
                          {userStatus === "do_not_disturb"
                            ? "Do not disturb"
                            : userStatus}
                        </span>
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {statusOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            aria-hidden
                            onClick={() => setStatusOpen(false)}
                          />
                          <ul
                            role="listbox"
                            className="absolute left-0 bottom-full mb-1 z-20 min-w-[10rem] rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <li
                                key={opt.value}
                                role="option"
                                aria-selected={userStatus === opt.value}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUserStatusChange(opt.value);
                                    setStatusOpen(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${userStatus === opt.value ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30" : "text-gray-700 dark:text-gray-200"}`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT_CLASS[opt.value] || "bg-gray-400"}`}
                                  />
                                  {opt.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                  {activity?.name &&
                    profile?.activityLoggingEnabled !== false && (
                      <span
                        className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5 block"
                        title={
                          activity.type === "hidden"
                            ? activity.name
                            : activity.details || activity.name
                        }
                      >
                        {activity.type === "hidden"
                          ? activity.name
                          : (activity.type === "game" ? "Playing " : "In ") +
                            activity.name}
                      </span>
                    )}
                </div>
              </div>
              {editable && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200 dark:text-gray-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                  aria-label="Edit profile"
                >
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
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              )}
            </div>

            <div className="mt-2 space-y-2">
              <div className="text-[11px] text-gray-200 dark:text-gray-200 max-h-20 overflow-y-auto">
                {bio ? (
                  <div className="prose prose-xs prose-invert max-w-none">
                    <ReactMarkdown>{bio}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="italic text-gray-400">
                    Add a short bio using Markdown…
                  </span>
                )}
              </div>

              {Array.isArray(profile.achievements) &&
                profile.achievements.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {profile.achievements.map((ach, idx) => (
                      <span
                        key={`${ach}-${idx}`}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                      >
                        {ach}
                      </span>
                    ))}
                  </div>
                )}
            </div>
            {onLogout && (
              <div className="mt-2 border-t border-gray-800 pt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Account</span>
                <button
                  type="button"
                  onClick={onLogout}
                  className="text-[11px] font-medium text-red-500 hover:text-red-400"
                >
                  Logout
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {isEditing && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={() => setIsEditing(false)}
          />
          <div
            className="fixed inset-0 z-[61] flex items-end justify-center sm:items-center sm:justify-center px-0 sm:px-4"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              paddingRight: "env(safe-area-inset-right)",
              paddingBottom: "env(safe-area-inset-bottom)",
              paddingLeft: "env(safe-area-inset-left)",
            }}
          >
            <div
              className="flex h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl border border-gray-800 bg-gray-950/95 shadow-2xl backdrop-blur sm:h-auto sm:max-h-[85vh] sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-white sm:text-sm">
                    Edit profile
                  </h2>
                  <p className="text-xs text-gray-400 sm:text-[11px]">
                    Update how your profile looks across Meeps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="touch-manipulation flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  aria-label="Close"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-3 order-2 sm:order-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                      Live preview
                    </p>
                    <div className="overflow-hidden rounded-xl border border-gray-700/80 bg-gray-900/80 shadow-lg">
                      <button
                        type="button"
                        onClick={() => setBannerChangeOpen(true)}
                        className="block w-full h-24 overflow-hidden bg-gradient-to-br from-indigo-600 via-fuchsia-600 to-sky-600 hover:opacity-95 transition-opacity focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset"
                        aria-label="Change banner"
                      >
                        {bannerUrl ? (
                          <img
                            src={bannerUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
                              <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                />
                              </svg>
                              <span>Click to add banner</span>
                            </div>
                          </div>
                        )}
                      </button>
                      <div className="px-4 pb-4 -mt-7 flex items-end gap-3">
                        <button
                          type="button"
                          onClick={() => setAvatarChangeOpen(true)}
                          className="relative h-14 w-14 overflow-hidden rounded-full border-4 border-gray-900 bg-gray-800 flex-shrink-0 ring-2 ring-indigo-500/50 hover:ring-indigo-400 transition-shadow focus:outline-none focus:ring-2 focus:ring-indigo-400 group/av"
                          aria-label="Change avatar"
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 text-base font-semibold text-white">
                              {initials}
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity pointer-events-none rounded-full">
                            <svg
                              className="h-6 w-6 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                              />
                            </svg>
                          </div>
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white drop-shadow-sm">
                            {displayName || "Meeps User"}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Click avatar or banner to change
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-4 order-1 sm:order-2"
                  >
                    <div className="space-y-4 rounded-xl border border-gray-800/80 bg-gray-900/50 p-4">
                      <h3 className="text-xs font-semibold text-gray-300 border-b border-gray-800 pb-2">
                        About you
                      </h3>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400">
                          Display name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full min-h-[44px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 sm:min-h-0"
                          placeholder="What should people call you?"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400">
                          Bio{" "}
                          <span className="text-[10px] text-gray-500">
                            (Markdown supported)
                          </span>
                        </label>
                        <textarea
                          rows={3}
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          className="w-full min-h-[72px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 sm:min-h-0 resize-none"
                          placeholder="I climb in League of Legends, main support..."
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-gray-400">
                          Achievements{" "}
                          <span className="text-[10px] text-gray-500">
                            (one per line)
                          </span>
                        </label>
                        <textarea
                          rows={2}
                          value={achievementsText}
                          onChange={(e) => setAchievementsText(e.target.value)}
                          className="w-full min-h-[56px] rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 sm:min-h-0 resize-none"
                          placeholder={
                            "League of Legends – Diamond IV\nValorant – Immortal I"
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-gray-800/80 bg-gray-900/50 p-4">
                      <h3 className="text-xs font-semibold text-gray-300 border-b border-gray-800 pb-2">
                        Gaming
                      </h3>
                      <button
                        type="button"
                        onClick={() => setGamerTagsOpen(true)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-800/80 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <svg
                            className="h-5 w-5 text-gray-500 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                            />
                          </svg>
                          Gamer Tags
                          {leagueUsername ? (
                            <span
                              className="text-indigo-400 truncate max-w-[140px]"
                              title={leagueUsername}
                            >
                              {leagueUsername}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-500">
                              Add your usernames
                            </span>
                          )}
                        </span>
                        <svg
                          className="h-4 w-4 text-gray-500 shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                      <div className="space-y-2 pt-2 border-t border-gray-800">
                        <p className="text-[11px] font-medium text-gray-500">
                          League match banners
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400">
                              Win GIF
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={winGifUrl}
                                onChange={(e) => setWinGifUrl(e.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 outline-none"
                                placeholder="https://..."
                              />
                              <button
                                type="button"
                                onClick={() => setGifTarget("win")}
                                className="shrink-0 rounded-lg border border-emerald-500/50 bg-emerald-500/20 px-2.5 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30"
                              >
                                GIF
                              </button>
                            </div>
                            {winGifUrl && (
                              <div className="h-12 rounded-lg overflow-hidden border border-gray-700">
                                <img
                                  src={winGifUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[11px] text-gray-400">
                              Lose GIF
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={loseGifUrl}
                                onChange={(e) => setLoseGifUrl(e.target.value)}
                                className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-xs text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 outline-none"
                                placeholder="https://..."
                              />
                              <button
                                type="button"
                                onClick={() => setGifTarget("lose")}
                                className="shrink-0 rounded-lg border border-rose-500/50 bg-rose-500/20 px-2.5 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/30"
                              >
                                GIF
                              </button>
                            </div>
                            {loseGifUrl && (
                              <div className="h-12 rounded-lg overflow-hidden border border-gray-700">
                                <img
                                  src={loseGifUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-500">
                          Shown behind your Diana match embeds in #matches when
                          your League username matches
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="touch-manipulation min-h-[44px] flex-1 sm:flex-none rounded-xl border border-gray-600 bg-gray-800/80 px-5 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-700/80 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="touch-manipulation min-h-[44px] flex-1 sm:flex-none rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors"
                      >
                        Save changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {avatarChangeOpen && (
            <div
              className="fixed inset-0 z-[62] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={() => setAvatarChangeOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Change avatar
                  </h3>
                  <button
                    type="button"
                    onClick={() => setAvatarChangeOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex justify-center mb-4">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-4 border-gray-700 bg-gray-800">
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 text-xl font-semibold text-white">
                          {initials}
                        </div>
                      )}
                    </div>
                  </div>
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const { files } = e.target;
                      if (files && files.length > 0) {
                        handleAvatarUpload(files);
                      }
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-4 py-3 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 transition-colors disabled:opacity-60"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    {avatarUploading ? "Uploading…" : "Upload from device"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGifTarget("avatar");
                      setAvatarChangeOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-gray-600 bg-gray-800/80 px-4 py-3 text-sm font-medium text-gray-200 hover:bg-gray-700/80 transition-colors"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Pick a GIF
                  </button>
                  <div className="space-y-1.5 pt-2 border-t border-gray-800">
                    <label className="text-[11px] font-medium text-gray-500">
                      Or paste image URL
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 outline-none"
                      placeholder="https://example.com/avatar.png"
                    />
                  </div>
                  {avatarUploadError && (
                    <p className="text-xs text-red-400">{avatarUploadError}</p>
                  )}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl("");
                        setAvatarUploadError(null);
                      }}
                      className="w-full text-xs font-medium text-gray-500 hover:text-red-400 transition-colors py-1"
                    >
                      Remove avatar
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {bannerChangeOpen && (
            <div
              className="fixed inset-0 z-[62] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={() => setBannerChangeOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">
                    Change banner
                  </h3>
                  <button
                    type="button"
                    onClick={() => setBannerChangeOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                    aria-label="Close"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="h-20 rounded-xl overflow-hidden border border-gray-700 bg-gray-800">
                    {bannerUrl ? (
                      <img
                        src={bannerUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-500 text-xs">
                        No banner
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGifTarget("banner");
                      setBannerChangeOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-500/20 px-4 py-3 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 transition-colors"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    Pick a GIF
                  </button>
                  <div className="space-y-1.5 pt-2 border-t border-gray-800">
                    <label className="text-[11px] font-medium text-gray-500">
                      Or paste image URL
                    </label>
                    <input
                      type="url"
                      value={bannerUrl}
                      onChange={(e) => setBannerUrl(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 outline-none"
                      placeholder="https://example.com/banner.gif"
                    />
                  </div>
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => setBannerUrl("")}
                      className="w-full text-xs font-medium text-gray-500 hover:text-red-400 transition-colors py-1"
                    >
                      Remove banner
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <GifPickerModal
            isOpen={gifTarget !== null}
            onClose={() => setGifTarget(null)}
            onSelectGif={handlePickGif}
            apiBase={API_BASE.replace(/\/$/, "")}
          />

          <GamerTagsModal
            isOpen={gamerTagsOpen}
            onClose={() => setGamerTagsOpen(false)}
            leagueUsername={leagueUsername}
            onSave={(payload) => {
              if (payload.leagueUsername !== undefined)
                setLeagueUsername(payload.leagueUsername);
              onSave?.({ id: profile?.id, ...payload });
              setGamerTagsOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

export default UserProfile;
