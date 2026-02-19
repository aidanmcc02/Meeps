import React, { useState } from "react";
import GifPickerModal from "./GifPickerModal";

const API_BASE = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";

function ProfileSetupPage({ user, onComplete }) {
  const [bannerUrl, setBannerUrl] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [gifTarget, setGifTarget] = useState(null); // "banner" | "avatar" | null

  const displayName = user?.displayName || "Meeps User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "MU";

  const handlePickGif = (gif) => {
    const url = gif.url || gif.previewUrl;
    if (!url) return;
    if (gifTarget === "banner") setBannerUrl(url);
    if (gifTarget === "avatar") setAvatarUrl(url);
    setGifTarget(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/profile/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl: avatarUrl || null,
          bannerUrl: bannerUrl || null
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to save profile");
      }
      const updated = await res.json();
      onComplete?.(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 flex flex-col items-center p-4 overflow-y-auto"
      style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-2xl mt-6 mb-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">
            Set up your profile
          </h1>
          <p className="text-gray-300 mt-1 text-sm">
            Add a banner and avatar. Images and GIFs will show on your profile card, voice sidebar, and users tab.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Form column */}
          <div className="rounded-xl border border-gray-800/60 bg-gray-950/70 backdrop-blur p-6 shadow-lg">
            <form onSubmit={handleSave} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Banner (image or GIF URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://… or pick a GIF"
                    className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => setGifTarget("banner")}
                    className="rounded-md border border-indigo-500/70 bg-indigo-600/20 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30"
                  >
                    Pick GIF
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-100 mb-1">
                  Avatar (image or GIF URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://… or pick a GIF"
                    className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60"
                  />
                  <button
                    type="button"
                    onClick={() => setGifTarget("avatar")}
                    className="rounded-md border border-indigo-500/70 bg-indigo-600/20 px-3 py-2 text-sm font-medium text-indigo-200 hover:bg-indigo-500/30"
                  >
                    Pick GIF
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-md bg-indigo-500 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving…" : "Save and continue"}
              </button>
            </form>
          </div>

          {/* Preview column */}
          <div className="rounded-xl border border-indigo-500/40 bg-gray-950/60 backdrop-blur p-6 shadow-lg">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Preview
            </p>
            <div className="rounded-lg overflow-hidden border border-indigo-500/40 bg-gray-950">
              {/* Banner */}
              <div className="h-24 w-full bg-gradient-to-br from-indigo-400 to-sky-500 relative overflow-hidden">
                {bannerUrl ? (
                  <img
                    src={bannerUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-sky-500" />
                )}
              </div>
              {/* Avatar overlapping + name */}
              <div className="px-3 pb-3 -mt-8 relative">
                <div className="h-16 w-16 rounded-full border-4 border-gray-950 bg-gray-900 overflow-hidden shadow-md flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-lg font-semibold text-white flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {displayName}
                </p>
                <p className="text-xs text-gray-300">
                  {user?.email || "you@example.com"}
                </p>
              </div>
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
    </div>
  );
}

export default ProfileSetupPage;
