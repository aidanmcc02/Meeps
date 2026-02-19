const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const db = require("../config/db");
const multer = require("multer");

const UPLOADS_PATH = process.env.UPLOADS_PATH || path.join(process.cwd(), "uploads");
const UPLOAD_MAX_AGE_DAYS = 3;
const UPLOAD_MAX_AGE_MS = UPLOAD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES = 5;

// Ensure uploads directory exists
async function ensureUploadsDir() {
  const dir = path.join(UPLOADS_PATH, "files");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      const dir = await ensureUploadsDir();
      cb(null, dir);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    cb(null, `${base}-${unique}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    // Basic safety: avoid executable types if you want; for now allow common docs/images
    cb(null, true);
  }
});

exports.getMulterUpload = () => upload.array("files", MAX_FILES);

exports.uploadFiles = async (req, res, next) => {
  const userId = req.userId || null;

  if (!req.files || req.files.length === 0) {
    console.warn("[uploads] Rejecting upload with no files", {
      userId,
      ip: req.ip
    });
    return res.status(400).json({ message: "No files uploaded" });
  }
  if (req.files.length > MAX_FILES) {
    console.warn("[uploads] Rejecting upload over file limit", {
      userId,
      ip: req.ip,
      fileCount: req.files.length,
      maxFiles: MAX_FILES
    });
    return res.status(400).json({ message: `Maximum ${MAX_FILES} files per upload` });
  }

  const apiBase = `${req.protocol}://${req.get("host")}`;
  const results = [];

  console.log("[uploads] Starting upload", {
    userId,
    ip: req.ip,
    fileCount: req.files.length,
    totalBytes: req.files.reduce((sum, f) => sum + (f.size || 0), 0)
  });

  try {
    for (const file of req.files) {
      const relativePath = path.relative(UPLOADS_PATH, file.path);
      const publicId = crypto.randomBytes(16).toString("hex");
      const result = await db.query(
        `INSERT INTO uploads (filename, storage_path, mime_type, size_bytes, created_at, public_id)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)
         RETURNING id, filename, mime_type, size_bytes, created_at, public_id`,
        [
          file.originalname,
          relativePath.replace(/\\/g, "/"),
          file.mimetype || null,
          file.size,
          publicId
        ]
      );
      const row = result.rows[0];
      results.push({
        id: row.id,
        filename: row.filename,
        mimeType: row.mime_type,
        size: row.size_bytes,
        publicId: row.public_id,
        url: `${apiBase}/api.files/${row.public_id}`,
        createdAt: row.created_at
      });

      console.log("[uploads] Stored file", {
        userId,
        uploadId: row.id,
        publicId: row.public_id,
        filename: row.filename,
        mimeType: row.mime_type,
        size: row.size_bytes,
        storagePath: relativePath.replace(/\\/g, "/")
      });
    }

    console.log("[uploads] Upload complete", {
      userId,
      ip: req.ip,
      uploadedCount: results.length
    });

    return res.status(201).json({ uploads: results });
  } catch (err) {
    console.error("[uploads] Upload failed", {
      userId,
      ip: req.ip,
      error: err.message
    });
    return next(err);
  }
};

exports.serveFile = async (req, res, next) => {
  const token = req.params.id;
  const userId = req.userId || null;

  if (!token || typeof token !== "string") {
    console.warn("[uploads] Invalid file token on download", {
      userId,
      ip: req.ip
    });
    return res.status(404).end();
  }

  try {
    // Prefer lookup by public_id (non-guessable). Fall back to numeric id for
    // backward compatibility with any older clients that still use integer IDs.
    let result = await db.query(
      "SELECT id, filename, storage_path, mime_type, created_at FROM uploads WHERE public_id = $1",
      [token]
    );
    let row = result.rows[0];

    if (!row) {
      const asInt = parseInt(token, 10);
      if (!Number.isNaN(asInt)) {
        const legacyResult = await db.query(
          "SELECT id, filename, storage_path, mime_type, created_at FROM uploads WHERE id = $1",
          [asInt]
        );
        row = legacyResult.rows[0];
      }
    }

    if (!row) {
      console.warn("[uploads] File not found on download", {
        userId,
        ip: req.ip,
        token
      });
      return res.status(404).json({ message: "File not found" });
    }

    const createdAt = new Date(row.created_at).getTime();
    if (Date.now() - createdAt > UPLOAD_MAX_AGE_MS) {
      console.info("[uploads] File expired on download", {
        userId,
        ip: req.ip,
        uploadId: row.id,
        token
      });
      return res.status(410).json({ message: "File expired" });
    }

    const filePath = path.join(UPLOADS_PATH, row.storage_path);
    try {
      await fs.access(filePath);
    } catch (_) {
      console.warn("[uploads] Missing file on disk", {
        userId,
        ip: req.ip,
        uploadId: row.id,
        token,
        storagePath: row.storage_path
      });
      return res.status(404).json({ message: "File not found" });
    }

    console.log("[uploads] Serving file", {
      userId,
      ip: req.ip,
      uploadId: row.id,
      token,
      filename: row.filename,
      mimeType: row.mime_type,
      storagePath: row.storage_path
    });

    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(row.filename)}"`);
    if (row.mime_type) {
      res.setHeader("Content-Type", row.mime_type);
    }
    res.sendFile(path.resolve(filePath), (err) => {
      if (err && !res.headersSent) {
        console.error("[uploads] Error while streaming file", {
          userId,
          ip: req.ip,
          uploadId: row.id,
          token,
          error: err.message
        });
        next(err);
      }
    });
  } catch (err) {
    console.error("[uploads] Unexpected error on download", {
      userId,
      ip: req.ip,
      token,
      error: err.message
    });
    return next(err);
  }
};

exports.UPLOADS_PATH = UPLOADS_PATH;
exports.UPLOAD_MAX_AGE_MS = UPLOAD_MAX_AGE_MS;

/** Delete uploads older than UPLOAD_MAX_AGE_DAYS and their files. Call periodically (e.g. every hour). */
exports.cleanupExpiredUploads = async () => {
  try {
    const cutoff = new Date(Date.now() - UPLOAD_MAX_AGE_MS);
    const result = await db.query(
      "SELECT id, storage_path FROM uploads WHERE created_at < $1",
      [cutoff]
    );
    for (const row of result.rows) {
      const filePath = path.join(UPLOADS_PATH, row.storage_path);
      try {
        await fs.unlink(filePath);
      } catch (_) {
        // ignore missing file
      }
      await db.query("DELETE FROM uploads WHERE id = $1", [row.id]);
    }
    if (result.rows.length > 0) {
      console.log(`[uploads] Cleaned up ${result.rows.length} expired file(s)`);
    }
  } catch (err) {
    if (err.code !== "42P01") {
      console.error("[uploads] Cleanup failed:", err.message);
    }
  }
};
