import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

const API_BASE = import.meta.env.VITE_BACKEND_HTTP_URL || "http://localhost:4000";

function UserProfileModal({ isOpen, onClose, user, initialProfile, anchorPosition = "center", activity }) {
  const [profile, setProfile] = useState(initialProfile || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    if (initialProfile && initialProfile.id === user.id) {
      setProfile(initialProfile);
      return;
    }
    setLoading(true);
    setProfile(null);
    fetch(`${API_BASE}/api/profile/${user.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setProfile(data);
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [isOpen, user?.id, initialProfile]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = profile?.displayName || user?.displayName || user?.name || "Meeps User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "MU";

  const isBottomLeft = anchorPosition === "bottom-left";
  const wrapperClass = isBottomLeft
    ? "fixed inset-0 z-50 flex items-end justify-start bg-black/50 p-4 pb-24 pl-6"
    : "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4";

  return (
    <div className={wrapperClass}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          )}

          {!loading && profile && (
            <>
              {/* Banner */}
              <div className="h-28 w-full bg-gradient-to-br from-indigo-400 to-sky-500 relative overflow-hidden">
                {profile.bannerUrl ? (
                  <img
                    src={profile.bannerUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-sky-500" />
                )}
              </div>
              <div className="px-4 pb-4 -mt-10 relative">
                {/* Avatar */}
                <div className="h-20 w-20 rounded-full border-4 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 overflow-hidden shadow-lg flex-shrink-0">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-2xl font-semibold text-white flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                </div>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </h3>

                {activity?.name && profile?.activityLoggingEnabled !== false && (
                  <p
                    className="mt-1 text-sm text-gray-500 dark:text-gray-400 truncate"
                    title={activity.details || activity.name}
                  >
                    {activity.type === "game" ? "Playing " : "In "}
                    {activity.name}
                  </p>
                )}

                {profile.bio && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                      Bio
                    </h4>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
                      <ReactMarkdown>{profile.bio}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {Array.isArray(profile.achievements) && profile.achievements.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                      Achievements
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.achievements.map((ach, idx) => (
                        <span
                          key={idx}
                          className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200"
                        >
                          {ach}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !profile && user && (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              <p>Could not load profile for {user.displayName || user.name || "this user"}.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserProfileModal;
