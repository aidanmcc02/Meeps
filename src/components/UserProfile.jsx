import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

function UserProfile({ profile, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [achievementsText, setAchievementsText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || "Meeps User");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatarUrl || "");
    setAchievementsText(
      Array.isArray(profile.achievements)
        ? profile.achievements.join("\n")
        : ""
    );
  }, [profile]);

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
      avatarUrl: avatarUrl || null
    });
    setIsEditing(false);
  };

  const initials =
    (profile?.displayName || "Meeps User")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "MU";

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-sm dark:border-gray-700 dark:bg-gray-800/80">
      {!profile && (
        <div className="animate-pulse h-10 bg-gray-200 dark:bg-gray-700 rounded-md" />
      )}

      {profile && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 rounded-full overflow-hidden">
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
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-gray-900 bg-emerald-500" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-xs font-semibold">
                  {profile.displayName || "Meeps User"}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                  {profile.email || "demo@meeps.app"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing((prev) => !prev)}
              className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {isEditing ? "Cancel" : "Edit"}
            </button>
          </div>

          {!isEditing && (
            <div className="mt-2 space-y-2">
              <div className="text-[11px] text-gray-600 dark:text-gray-300 max-h-20 overflow-y-auto">
                {bio ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none">
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
          )}

          {isEditing && (
            <form onSubmit={handleSubmit} className="mt-2 space-y-2">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Display name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Bio (Markdown supported)
                </label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="I climb in League of Legends, main support..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Achievements (one per line, e.g. ranks)
                </label>
                <textarea
                  rows={3}
                  value={achievementsText}
                  onChange={(e) => setAchievementsText(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  placeholder={"League of Legends – Diamond IV\nValorant – Immortal I"}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Avatar URL (optional)
                </label>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                  placeholder="https://example.com/avatar.png"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-indigo-500 px-3 py-0.5 text-[10px] font-medium text-white hover:bg-indigo-600"
                >
                  Save
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default UserProfile;
