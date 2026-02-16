import React from "react";

const statusColor = {
  online: "bg-emerald-500",
  idle: "bg-amber-400",
  offline: "bg-gray-500"
};

function UserList({ users }) {
  const safeUsers = users && users.length > 0 ? users : [];

  return (
    <ul className="space-y-0.5 text-sm">
      {safeUsers.map((user) => {
        const status = user.status || "offline";
        const name = user.displayName || user.name || "Meeps User";
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
            className="flex items-center gap-2 rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <div className="relative h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[10px] font-semibold text-white flex items-center justify-center">
              {initials}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-gray-900 ${
                  statusColor[status] || statusColor.offline
                }`}
              />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-medium truncate">{name}</span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                {status}
              </span>
            </div>
          </li>
        );
      })}

      {safeUsers.length === 0 && (
        <li className="text-[11px] text-gray-400 dark:text-gray-500 px-2 py-1">
          No users online yet.
        </li>
      )}
    </ul>
  );
}

export default UserList;
