import React, { useEffect, useState } from "react";

function GifPickerModal({ isOpen, onClose, onSelectGif, apiBase }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      setLoading(false);
      setError("");
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSearch = async (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${apiBase}/api/search-gifs?query=${encodeURIComponent(trimmed)}`
      );
      if (!res.ok) {
        setError("Failed to fetch GIFs. Please try again.");
        setResults([]);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResults(Array.isArray(data.gifs) ? data.gifs : []);
    } catch (_err) {
      setError("Something went wrong while searching for GIFs.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (gif) => {
    onSelectGif?.(gif);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center sm:py-4">
      <div
        className="relative flex h-[90dvh] max-h-[90vh] w-full max-w-3xl flex-col rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border-t"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)"
        }}
      >
        <div className="flex flex-shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            Search GIFs
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="touch-manipulation rounded-full px-4 py-2.5 text-base text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex flex-shrink-0 gap-2 px-4 pb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search GIFs…"
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-3 text-base text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
            style={{ fontSize: "16px" }}
          />
          <button
            type="submit"
            className="touch-manipulation flex-shrink-0 rounded-xl bg-indigo-500 px-4 py-3 text-base font-medium text-white hover:bg-indigo-600 active:bg-indigo-700"
          >
            Search
          </button>
        </form>

        {error && (
          <p className="flex-shrink-0 px-4 pb-2 text-sm text-red-500 dark:text-red-400">
            {error}
          </p>
        )}

        {loading && (
          <p className="flex-shrink-0 px-4 pb-2 text-sm text-gray-500 dark:text-gray-400">
            Loading GIFs…
          </p>
        )}

        {!loading && !error && results.length === 0 && query.trim() !== "" && (
          <p className="flex-shrink-0 px-4 pb-2 text-sm text-gray-500 dark:text-gray-400">
            No GIFs found for &quot;{query.trim()}&quot;.
          </p>
        )}

        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleSelect(gif)}
                className="touch-manipulation group relative aspect-square w-full overflow-hidden rounded-xl border border-transparent bg-gray-100 hover:border-indigo-500 hover:bg-indigo-50 active:scale-[0.98] dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <img
                  src={gif.previewUrl || gif.url}
                  alt={gif.title || "GIF"}
                  className="h-full w-full object-cover transition-transform duration-150 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/10" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default GifPickerModal;

