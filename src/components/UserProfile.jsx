import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import GifPickerModal from "./GifPickerModal";

const API_BASE = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";

function UserProfile({ profile, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerHovered, setBannerHovered] = useState(false);
  const [gifTarget, setGifTarget] = useState(null); // "banner" | "avatar" | null

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "Meeps User");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatarUrl || "");
    setBannerUrl(profile.bannerUrl || "");
    setAchievementsText(
      Array.isArray(profile.achievements)
        ? profile.achievements.join("\n")
        : ""
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
      bannerUrl: bannerUrl || null
    });
    setIsEditing(false);
  };

  const handlePickGif = (gif) => {
    if (!gif) return;
    const url = gif.url || gif.previewUrl;
    if (!url) return;
    if (gifTarget === "banner") setBannerUrl(url);
    if (gifTarget === "avatar") setAvatarUrl(url);
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
    <div className="group rounded-xl border border-gray-200 bg-gray-900/80 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-900/80 overflow-hidden px-0 pt-0 pb-0 relative">
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
      <div className={`px-3 pt-2 pb-2 ${!hasBanner ? "bg-gray-50 dark:bg-gray-800/80" : ""}`}>
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
                <div className={`h-full w-full transition-opacity duration-300 ${bannerHovered ? "opacity-100" : "opacity-80"}`} />
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
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 bg-emerald-500 shadow-sm z-10" aria-hidden />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold text-gray-100 dark:text-white">
                  {profile.displayName || "Meeps User"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-gray-400/70 bg-black/20 px-2 py-0.5 text-[10px] font-medium text-gray-100 hover:bg-white/10 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Edit profile
            </button>
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
                        // eslint-disable-next-line react/no-array-index-key
                        key={idx}
                        className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                      >
                        {ach}
                      </span>
                    ))}
                  </div>
                )}
            </div>
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
              paddingLeft: "env(safe-area-inset-left)"
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
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                    Live preview
                  </p>
                  <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80">
                    <div className="h-20 w-full overflow-hidden bg-gradient-to-br from-indigo-500 to-sky-500">
                      {bannerUrl ? (
                        <img
                          src={bannerUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="px-3 pb-3 -mt-6 flex items-end gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full border-4 border-gray-900 bg-gray-800 flex-shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-sky-500 text-sm font-semibold text-white">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {displayName || "Meeps User"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="space-y-3"
                >
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-300">
                      Display name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full min-h-[44px] rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                      placeholder="What should people call you?"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-300">
                      Bio
                      <span className="ml-1 text-[10px] font-normal text-gray-500">
                        • Markdown supported
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      className="w-full min-h-[80px] rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                      placeholder="I climb in League of Legends, main support..."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-gray-300">
                      Achievements
                      <span className="ml-1 text-[10px] font-normal text-gray-500">
                        • one per line
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={achievementsText}
                      onChange={(e) => setAchievementsText(e.target.value)}
                      className="w-full min-h-[80px] rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                      placeholder={"League of Legends – Diamond IV\nValorant – Immortal I"}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-gray-300">
                        Banner
                        <span className="ml-1 text-[10px] font-normal text-gray-500">
                          (image or GIF)
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          className="min-h-[44px] min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                          placeholder="https://example.com/banner.gif"
                        />
                        <button
                          type="button"
                          onClick={() => setGifTarget("banner")}
                          className="touch-manipulation shrink-0 rounded-md border border-indigo-500/70 bg-indigo-600/20 px-3 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 min-h-[44px] sm:min-h-0 sm:py-1.5 sm:text-[11px]"
                        >
                          Pick GIF
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-gray-300">
                        Avatar
                        <span className="ml-1 text-[10px] font-normal text-gray-500">
                          (optional)
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={avatarUrl}
                          onChange={(e) => setAvatarUrl(e.target.value)}
                          className="min-h-[44px] min-w-0 flex-1 rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                          placeholder="https://example.com/avatar.png"
                        />
                        <button
                          type="button"
                          onClick={() => setGifTarget("avatar")}
                          className="touch-manipulation shrink-0 rounded-md border border-indigo-500/70 bg-indigo-600/20 px-3 py-2.5 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30 min-h-[44px] sm:min-h-0 sm:py-1.5 sm:text-[11px]"
                        >
                          Pick GIF
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 border-t border-gray-800 pt-4 sm:mt-3 sm:flex-row sm:items-center sm:justify-between sm:pt-3">
                    <p className="text-xs text-gray-500 sm:text-[10px]">
                      GIFs work for both banner and avatar.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="touch-manipulation min-h-[44px] flex-1 rounded-full border border-gray-600 bg-gray-900/80 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800 sm:min-h-0 sm:flex-none sm:px-2.5 sm:py-1 sm:text-[10px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="touch-manipulation min-h-[44px] flex-1 rounded-full bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 sm:min-h-0 sm:flex-none sm:px-3 sm:py-1 sm:text-[10px]"
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                </form>
              </div>
              </div>
            </div>
          </div>

          <GifPickerModal
            isOpen={gifTarget !== null}
            onClose={() => setGifTarget(null)}
            onSelectGif={handlePickGif}
            apiBase={API_BASE.replace(/\/$/, "")}
          />
        </>
      )}
    </div>
  );
}

export default UserProfile;
