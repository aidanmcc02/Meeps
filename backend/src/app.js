const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const messageRoutes = require("./routes/messageRoutes");
const gifRoutes = require("./routes/gifRoutes");
const buildNotifyRoutes = require("./routes/buildNotifyRoutes");
const dianaNotifyRoutes = require("./routes/dianaNotifyRoutes");
const boardRoutes = require("./routes/boardRoutes");
const pushRoutes = require("./routes/pushRoutes");
const valorantRoutes = require("./routes/valorantRoutes");
const uploadController = require("./controllers/uploadController");
const { authenticate } = require("./middleware/authMiddleware");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(
  cors({
    origin: "*"
  })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "meeps-backend" });
});

// Upload routes registered explicitly so POST /api/upload always matches (avoids router mount path issues)
// Require authentication for upload. Downloads are protected by short‑lived, signed URLs.
app.post("/api/upload", authenticate, uploadController.getMulterUpload(), uploadController.uploadFiles);
app.get("/api/files/:id", uploadController.serveFile);

app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", messageRoutes);
app.use("/api", gifRoutes);
app.use("/api", buildNotifyRoutes);
app.use("/api", dianaNotifyRoutes);
app.use("/api", boardRoutes);
app.use("/api", pushRoutes);
app.use("/api", valorantRoutes);

// Debug: Print all registered routes
function routeMethodLabel(route) {
  if (route.method) return route.method.toUpperCase();
  if (route.methods && typeof route.methods === 'object') {
    return Object.keys(route.methods).join(',').toUpperCase();
  }
  return '?';
}
console.log("Registered routes:");
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`Route: ${routeMethodLabel(middleware.route)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    console.log(`Router mounted at: ${middleware.regexp}`);
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`  Route: ${routeMethodLabel(handler.route)} ${handler.route.path}`);
      }
    });
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

