const express       = require("express");
const router        = express.Router();
const Notification  = require("../models/Notification");
const auth          = require("../middleware/auth");

// ── GET MY NOTIFICATIONS ──
router.get("/", auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      receiverId: req.user.userId
    }).sort({ createdAt: -1 }).limit(50);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching notifications" });
  }
});

// ── GET UNREAD COUNT ──
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      receiverId: req.user.userId,
      read: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching count" });
  }
});

// ── MARK ALL AS READ ──
router.put("/mark-all-read", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { receiverId: req.user.userId, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: "All marked as read" });
  } catch (err) {
    res.status(500).json({ msg: "Error marking as read" });
  }
});

// ── MARK ONE AS READ ──
router.put("/:id/read", auth, async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ msg: "Marked as read" });
  } catch (err) {
    res.status(500).json({ msg: "Error marking as read" });
  }
});

// ── DELETE ONE ──
router.delete("/:id", auth, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ msg: "Deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting" });
  }
});

// ── CLEAR ALL ──
router.delete("/", auth, async (req, res) => {
  try {
    await Notification.deleteMany({ receiverId: req.user.userId });
    res.json({ msg: "All cleared" });
  } catch (err) {
    res.status(500).json({ msg: "Error clearing" });
  }
});

module.exports = router;