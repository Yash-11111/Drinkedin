const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "DRINKEDIN_SECRET_KEY";

module.exports = function (req, res, next) {
  const authHeader = req.headers.authorization;

  // Accept both "Bearer <token>" and raw "<token>"
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({ msg: "No token, access denied" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ msg: "Invalid or expired token" });
  }
};
