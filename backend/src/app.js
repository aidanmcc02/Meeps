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

app.use(notFound);
app.use(errorHandler);

module.exports = app;

