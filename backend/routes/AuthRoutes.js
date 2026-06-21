const express = require("express");
const router  = express.Router();
const User    = require("../models/User");
const jwt     = require("jsonwebtoken");
const { sendOTPEmail } = require("../utils/sendEmail");

const otpAttempts = new Map();
const SECRET      = process.env.JWT_SECRET;

// ===== SEND OTP =====
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ msg: "Email required" });

    const otp    = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    let user = await User.findOne({ email });
    if (!user) user = new User({ email });

    user.otp       = otp;
    user.otpExpiry = expiry;
    await user.save();

    await sendOTPEmail(email, otp);

    res.json({ msg: "OTP sent to email" });
  } catch (err) {
    console.error("OTP send error:", err);
    res.status(500).json({ msg: "Failed to send OTP" });
  }
});

// ===== VERIFY OTP =====
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    // ── Fetch user  ──
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    // ── Check brute force attempts ──
    const attempts = otpAttempts.get(user._id.toString()) || 0;
    if (attempts >= 5) {
      return res.status(429).json({ msg: "Too many failed attempts. Request a new OTP." });
    }

    // ── Validate OTP ──
    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      otpAttempts.set(user._id.toString(), attempts + 1);
      return res.status(400).json({ msg: "Invalid or expired OTP" });
    }

    // ── OTP correct — clear attempts ──
    otpAttempts.delete(user._id.toString());

    // ── Clear OTP from DB ──
    user.otp       = null;
    user.otpExpiry = null;

    // ── Auto-assign username on first login ──
    if (!user.username) {
      user.username = "user_" + user._id.toString().slice(-5);
    }

    await user.save();

    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ msg: "Verification failed" });
  }
});

module.exports = router;