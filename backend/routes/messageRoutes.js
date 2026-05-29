const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

// ── GET CONVERSATIONS ──
router.get("/conversations", auth, async (req, res) => {
  try {
    const myId = req.user.userId;

    const messages = await Message.find({
      $or: [{ senderId: myId }, { receiverId: myId }]
    }).sort({ createdAt: -1 });

    const partnerIds = [...new Set(
      messages.map(m => m.senderId === myId ? m.receiverId : m.senderId)
    )];

    const partners = await User.find(
      { _id: { $in: partnerIds } }
    ).select("username avatarUrl headline");

    const conversations = partners.map(partner => {
      const convoMessages = messages.filter(m =>
        m.senderId === partner._id.toString() ||
        m.receiverId === partner._id.toString()
      );
      const lastMsg = convoMessages[0];
      const unread = convoMessages.filter(
        m => m.receiverId === myId && !m.read
      ).length;
      return { partner, lastMessage: lastMsg, unreadCount: unread };
    });

    res.json(conversations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching conversations" });
  }
});

// ── GET MESSAGES WITH A USER ──
router.get("/:partnerId", auth, async (req, res) => {
  try {
    const myId = req.user.userId;
    const partnerId = req.params.partnerId;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: partnerId },
        { senderId: partnerId, receiverId: myId }
      ]
    }).sort({ createdAt: 1 });

    await Message.updateMany(
      { senderId: partnerId, receiverId: myId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching messages" });
  }
});

// ── SEND MESSAGE ──
router.post("/send", auth, async (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!receiverId || !text?.trim())
      return res.status(400).json({ msg: "Receiver and text required" });

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ msg: "User not found" });

     const sender = await User.findById(req.user.userId).select("username avatarUrl");

    const message = new Message({
      senderId: req.user.userId,
      receiverId,
      text: text.trim()
    });
    await message.save();
    // Save notification
    await Notification.create({
      receiverId: receiverId,
      senderId: req.user.userId,
      senderUsername: sender.username,
      senderAvatar: sender.avatarUrl,
      type: "message",
      message: `${sender.username} sent you a message 💬`
    });

    // ── EMIT via Socket.io ──
    const io = req.io;
    const roomId = [req.user.userId, receiverId].sort().join("_");

   

    io.to(roomId).emit("new_message", {
      ...message.toObject(),
      senderUsername: sender.username,
      senderAvatar: sender.avatarUrl
    });

    // Notify receiver if not in the room (new conversation indicator)
    io.emit("message_notification", {
      receiverId,
      senderId: req.user.userId,
      senderUsername: sender.username,
      senderAvatar: sender.avatarUrl,
      text: text.trim()
    });

    res.status(201).json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error sending message" });
  }
});

// ── DELETE MESSAGE ──
router.delete("/:messageId", auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message) return res.status(404).json({ msg: "Message not found" });
    if (message.senderId !== req.user.userId)
      return res.status(403).json({ msg: "Not authorized" });

    await message.deleteOne();

    // Notify room that message was deleted
    const io = req.io;
    const roomId = [req.user.userId, message.receiverId].sort().join("_");
    io.to(roomId).emit("message_deleted", { messageId: req.params.messageId });

    res.json({ msg: "Message deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting message" });
  }
});

module.exports = router;