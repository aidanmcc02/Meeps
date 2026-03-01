// 404 handler
function notFound(req, res, _next) {
  res.status(404).json({ message: "Not found" });
}

// Generic error handler

function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({ message: "Internal server error" });
}

module.exports = { notFound, errorHandler };
