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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
      <div className="relative w-full max-w-3xl max-h-[80vh] rounded-2xl border border-gray-200 bg-white px-4 pb-4 pt-3 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            Search GIFs
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSearch} className="mb-3 flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a GIF (e.g. 'league of legends', 'hype')"
            className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-950 dark:text-gray-100"
          />
          <button
            type="submit"
            className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
          >
            Search
          </button>
        </form>

        {error && (
          <p className="mb-2 text-xs text-red-500 dark:text-red-400">{error}</p>
        )}

        {loading && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Loading GIFs…
          </p>
        )}

        {!loading && !error && results.length === 0 && query.trim() !== "" && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No GIFs found for &quot;{query.trim()}&quot;.
          </p>
        )}

        <div className="mt-2 max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {results.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleSelect(gif)}
                className="group relative overflow-hidden rounded-lg border border-transparent bg-gray-100 hover:border-indigo-500 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                <img
                  src={gif.previewUrl || gif.url}
                  alt={gif.title || "GIF"}
                  className="h-24 w-full object-cover transition-transform duration-150 group-hover:scale-105"
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

