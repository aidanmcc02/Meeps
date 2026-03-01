import React from "react";

const SECTIONS = [
  {
    id: "chat",
    title: "Chat",
    description:
      "Text channels, messages, and mentions. Use the sidebar to switch between #general, #dev-chat, #Builds, #matches, and #board-activity.",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    accent: "indigo",
  },
  {
    id: "board",
    title: "Board",
    description:
      "Project board with To Do, In Progress, and Done columns. Track issues and sync with GitHub.",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 17V7m0 10a2 2 0 01-2 2H9a2 2 0 01-2-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 01-2 2h-2a2 2 0 01-2-2m0-10V7"
        />
      </svg>
    ),
    accent: "amber",
  },
  {
    id: "games",
    title: "Games",
    description:
      "Diana integration: match history, ranks, and stats for League of Legends.",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    accent: "emerald",
  },
  {
    id: "voice",
    title: "Voice",
    description:
      "Join voice channels from the sidebar. See who's in call and manage your mic and speakers.",
    icon: (
      <svg
        className="h-8 w-8"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    accent: "violet",
  },
];

const ACCENT_CLASSES = {
  indigo:
    "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300",
  amber:
    "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-300",
  emerald:
    "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300",
  violet:
    "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-300",
};

function Dashboard({ onNavigate }) {
  return (
    <div className="grid h-full min-h-0 grid-cols-2 grid-rows-2 gap-2 p-2 sm:gap-3 sm:p-3">
      {SECTIONS.map((section) => (
        <article
          key={section.id}
          className="flex min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/80 sm:p-5"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border sm:h-12 sm:w-12 ${ACCENT_CLASSES[section.accent]}`}
            >
              {section.icon}
            </div>
            <div className="min-w-0 flex-1 flex flex-col">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg">
                {section.title}
              </h2>
              <p className="mt-1 flex-1 overflow-y-auto text-sm text-gray-600 dark:text-gray-300">
                {section.description}
              </p>
              {section.id !== "voice" && (
                <button
                  type="button"
                  onClick={() => onNavigate(section.id)}
                  className="mt-3 inline-flex flex-shrink-0 items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                >
                  Go to {section.title}
                </button>
              )}
              {section.id === "voice" && (
                <p className="mt-3 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  Use the sidebar to join a voice channel.
                </p>
              )}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default Dashboard;
