const rateLimit = require("express-rate-limit");

// ── GENERAL API LIMIT ──
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      100,             // 100 requests per 15 mins
  message:  { msg: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders:   false
});

// ── AUTH LIMIT — strict (prevent OTP brute force) ──
const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max:      10,              // only 10 OTP attempts per 15 mins
  message:  { msg: "Too many login attempts. Please wait 15 minutes." },
  standardHeaders: true,
  legacyHeaders:   false
});

// ── POST CREATION LIMIT ──
const postLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      10,        // 10 posts per minute
  message:  { msg: "Slow down! Too many posts." },
  standardHeaders: true,
  legacyHeaders:   false
});

// ── MESSAGE LIMIT ──
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      30,        // 30 messages per minute
  message:  { msg: "Slow down! Too many messages." },
  standardHeaders: true,
  legacyHeaders:   false
});

// ── SEARCH LIMIT ──
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max:      60,        // 60 searches per minute
  message:  { msg: "Too many searches. Please slow down." },
  standardHeaders: true,
  legacyHeaders:   false
});

// ── AI RECOMMEND LIMIT ──
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:      20,              // 20 AI requests per hour
  message:  { msg: "AI recommendation limit reached. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders:   false
});

module.exports = {
  generalLimiter,
  authLimiter,
  postLimiter,
  messageLimiter,
  searchLimiter,
  aiLimiter
};