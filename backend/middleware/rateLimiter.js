const rateLimit = require("express-rate-limit");

// ── GENERAL API LIMIT ──
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { msg: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

// ── AUTH LIMIT ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { msg: "Too many login attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

// ── POST LIMIT ──
const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  message:  { msg: "Slow down! Too many posts." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

// ── MESSAGE LIMIT ──
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      30,
  message:  { msg: "Slow down! Too many messages." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

// ── SEARCH LIMIT ──
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      60,
  message:  { msg: "Too many searches. Please slow down." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

// ── AI LIMIT ──
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max:      20,
  message:  { msg: "AI recommendation limit reached. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => req.ip
});

module.exports = { generalLimiter, authLimiter, postLimiter, messageLimiter, searchLimiter, aiLimiter };