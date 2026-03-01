import React, { useEffect, useState } from "react";

const GAMES = [
  {
    id: "league",
    label: "League of Legends",
    placeholder: "GameName#TAG",
    description: "Used for Diana match embeds",
  },
];

function GamerTagsModal({ isOpen, onClose, leagueUsername = "", onSave }) {
  const [league, setLeague] = useState("");

  useEffect(() => {
    if (isOpen) setLeague(leagueUsername || "");
  }, [isOpen, leagueUsername]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave?.({ leagueUsername: league.trim() || "" });
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 z-[71] flex items-end justify-center sm:items-center sm:justify-center px-0 sm:px-4"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingRight: "env(safe-area-inset-right)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingLeft: "env(safe-area-inset-left)",
        }}
      >
        <div
          className="w-full max-w-md rounded-t-2xl border border-gray-800 bg-gray-950/95 shadow-2xl backdrop-blur sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-800 px-4 py-3">
            <h2 className="text-base font-semibold text-white sm:text-sm">
              Gamer Tags
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-800 hover:text-gray-200"
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

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {GAMES.map((game) => (
              <div key={game.id} className="space-y-1.5">
                <label className="text-[11px] font-medium text-gray-300">
                  {game.label}
                  {game.description && (
                    <span className="ml-1 text-[10px] font-normal text-gray-500">
                      ({game.description})
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={game.id === "league" ? league : ""}
                  onChange={(e) =>
                    game.id === "league" && setLeague(e.target.value)
                  }
                  className="w-full min-h-[44px] rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2.5 text-base text-gray-100 outline-none placeholder-gray-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500/60 sm:min-h-0 sm:py-1.5 sm:text-xs"
                  placeholder={game.placeholder}
                />
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full border border-gray-600 bg-gray-900/80 px-4 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-full bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default GamerTagsModal;
