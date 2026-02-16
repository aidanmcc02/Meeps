const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const messageRoutes = require("./routes/messageRoutes");
const gifRoutes = require("./routes/gifRoutes");
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

app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", messageRoutes);
app.use("/api", gifRoutes);

// Debug: Print all registered routes
console.log("Registered routes:");
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    console.log(`Route: ${middleware.route.method.toUpperCase()} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    console.log(`Router mounted at: ${middleware.regexp}`);
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`  Route: ${handler.route.method.toUpperCase()} ${handler.route.path}`);
      }
    });
  }
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;

