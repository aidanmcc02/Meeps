const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

exports.authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring("Bearer ".length);
  } else if (
    req.query &&
    typeof req.query.token === "string" &&
    req.query.token
  ) {
    // Allow JWT via query string for use-cases like <img src="..."> where headers cannot be set easily.
    token = req.query.token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "missing or invalid authorization token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "invalid or expired token" });
  }
};
