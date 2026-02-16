const GIPHY_API_KEY = process.env.GIPHY_API_KEY || "";
const GIPHY_API_URL = "https://api.giphy.com/v1/gifs/search";

// Simple in-memory cache: query -> { timestamp, data }
const CACHE_TTL_MS = 60 * 1000; // 1 minute
const cache = new Map();

function getCached(query) {
  const entry = cache.get(query);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(query);
    return null;
  }
  return entry.data;
}

function setCached(query, data) {
  cache.set(query, { timestamp: Date.now(), data });
}

exports.searchGifs = async (req, res, next) => {
  const query = (req.query.query || "").toString().trim();

  if (!query) {
    return res.status(400).json({ message: "query parameter is required" });
  }

  if (!GIPHY_API_KEY) {
    return res.status(500).json({
      message:
        "GIPHY_API_KEY is not configured on the server. Set it in your environment."
    });
  }

  const cached = getCached(query);
  if (cached) {
    return res.json(cached);
  }

  try {
    const url = `${GIPHY_API_URL}?api_key=${encodeURIComponent(
      GIPHY_API_KEY
    )}&q=${encodeURIComponent(query)}&limit=24&rating=pg-13&lang=en`;

    // Requires Node 18+ for global fetch
    const response = await fetch(url);
    if (!response.ok) {
      return res
        .status(502)
        .json({ message: "Failed to fetch GIFs from provider" });
    }

    const json = await response.json();
    const gifs =
      Array.isArray(json.data) &&
      json.data.map((item) => {
        const images = item.images || {};
        const fixed = images.fixed_width || images.original || {};
        const preview =
          images.fixed_width_small || images.fixed_width_downsampled || fixed;

        return {
          id: item.id,
          title: item.title || "",
          url: fixed.url,
          previewUrl: preview.url || fixed.url,
          width: Number(fixed.width) || null,
          height: Number(fixed.height) || null
        };
      });

    const payload = { gifs: gifs || [] };
    setCached(query, payload);
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
};

