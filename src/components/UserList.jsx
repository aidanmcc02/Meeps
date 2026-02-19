import React from "react";

const statusColor = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  offline: "bg-gray-500"
};

function UserList({ users, onUserClick, profiles = {} }) {
  const safeUsers = users && users.length > 0 ? users : [];

  return (
    <ul className="flex flex-col flex-1 min-h-0 text-sm gap-1">
      {safeUsers.map((user) => {
        const status = user.status || "offline";
        const name = user.displayName || user.name || "Meeps User";
        const profile = user.id != null ? profiles[user.id] : null;
        const avatarUrl = profile?.avatarUrl || null;
        const bannerUrl = profile?.bannerUrl || null;
        const initials =
          name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "MU";

        return (
          <li
            key={user.id}
            role="button"
            tabIndex={0}
            onClick={() => onUserClick?.(user)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onUserClick?.(user);
              }
            }}
            className="group relative cursor-pointer overflow-hidden rounded-lg flex-1 min-h-0 flex flex-col"
          >
            {bannerUrl && (
              <div className="pointer-events-none absolute inset-0">
                <img
                  src={bannerUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-70 transition-transform duration-300 ease-out group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
              </div>
            )}
            <div
              className={`relative flex-1 min-h-0 flex items-center justify-center gap-3 px-3 py-2 ${
                bannerUrl
                  ? "text-white hover:bg-white/5"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <div className="relative h-10 w-10 flex-shrink-0">
                <div className="h-full w-full rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-semibold text-white flex items-center justify-center ring-1 ring-black/10">
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
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 shadow-sm z-10 ${
                    statusColor[status] || statusColor.offline
                  }`}
                  aria-hidden
                />
              </div>
              <div className="flex flex-col items-start justify-center leading-tight min-w-0 flex-1">
                <span className="text-sm font-medium truncate w-full">
                  {name}
                </span>
                <span className="text-[11px] capitalize opacity-80">
                  {status}
                </span>
                {user.activity?.name && (
                  <span
                    className="text-[10px] opacity-70 truncate w-full mt-0.5"
                    title={user.activity.details || user.activity.name}
                  >
                    {user.activity.type === "game" ? "Playing " : "In "}
                    {user.activity.name}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}

      {safeUsers.length === 0 && (
        <li className="flex items-center justify-center flex-1 min-h-0 text-[11px] text-gray-400 dark:text-gray-500 px-2 py-4">
          No users online yet.
        </li>
      )}
    </ul>
  );
}

export default UserList;
