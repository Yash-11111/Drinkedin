const express      = require("express");
const router       = express.Router();
const Event        = require("../models/Event");
const User         = require("../models/User");
const Notification = require("../models/Notification");
const auth         = require("../middleware/auth");

// ── CREATE EVENT ──
router.post("/", auth, async (req, res) => {
  try {
    const { title, description, location, date, drinks, inviteeIds, isPublic } = req.body;

    if (!title || !location || !date)
      return res.status(400).json({ msg: "Title, location and date required" });

    const creator = await User.findById(req.user.userId);
    if (!creator) return res.status(404).json({ msg: "User not found" });

    // Build invitees list
    const invitees = [];
    if (inviteeIds && inviteeIds.length) {
      const users = await User.find({ _id: { $in: inviteeIds } });
      users.forEach(u => invitees.push({
        userId:    u._id.toString(),
        username:  u.username,
        avatarUrl: u.avatarUrl,
        status:    "pending"
      }));
    }

    const event = new Event({
      creatorId:       req.user.userId,
      creatorUsername: creator.username,
      creatorAvatar:   creator.avatarUrl,
      title,
      description,
      location,
      date:     new Date(date),
      drinks:   drinks || [],
      invitees,
      isPublic: isPublic || false
    });

    await event.save();

    // Send notifications + socket to all invitees
    const io = req.io;
    for (const invitee of invitees) {
      await Notification.create({
        receiverId:     invitee.userId,
        senderId:       req.user.userId,
        senderUsername: creator.username,
        senderAvatar:   creator.avatarUrl,
        type:           "event",
        message:        `${creator.username} invited you to "${title}" 🎉`,
        postId:         event._id.toString()
      });

      if (io) {
        io.emit("event_notification", {
          receiverId:     invitee.userId,
          senderUsername: creator.username,
          eventId:        event._id,
          eventTitle:     title
        });
      }
    }

    res.status(201).json(event);
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ msg: "Error creating event" });
  }
});

// ── GET MY EVENTS (created + invited) ──
router.get("/my-events", auth, async (req, res) => {
  try {
    const created = await Event.find({ creatorId: req.user.userId }).sort({ date: 1 });
    const invited = await Event.find({
      "invitees.userId": req.user.userId
    }).sort({ date: 1 });

    res.json({ created, invited });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching events" });
  }
});

// ── GET SINGLE EVENT ──
router.get("/:id", auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    res.json(event);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching event" });
  }
});

// ── RESPOND TO INVITATION ──
router.put("/:id/respond", auth, async (req, res) => {
  try {
    const { status } = req.body; // "accepted" or "declined"
    if (!["accepted", "declined"].includes(status))
      return res.status(400).json({ msg: "Invalid status" });

    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });

    const invitee = event.invitees.find(i => i.userId === req.user.userId);
    if (!invitee) return res.status(403).json({ msg: "Not invited" });

    invitee.status = status;
    await event.save();

    // Notify creator
    const responder = await User.findById(req.user.userId);
    await Notification.create({
      receiverId:     event.creatorId,
      senderId:       req.user.userId,
      senderUsername: responder?.username,
      senderAvatar:   responder?.avatarUrl,
      type:           "event",
      message:        `${responder?.username} ${status === "accepted" ? "accepted 🎉" : "declined 😔"} your invitation to "${event.title}"`
    });

    if (req.io) {
      req.io.emit("event_response", {
        receiverId:     event.creatorId,
        senderUsername: responder?.username,
        status,
        eventTitle:     event.title
      });
    }

    res.json(event);
  } catch (err) {
    res.status(500).json({ msg: "Error responding to event" });
  }
});

// ── DELETE EVENT ──
router.delete("/:id", auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ msg: "Event not found" });
    if (event.creatorId !== req.user.userId)
      return res.status(403).json({ msg: "Not authorized" });

    await event.deleteOne();
    res.json({ msg: "Event deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting event" });
  }
});

module.exports = router;