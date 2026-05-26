const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  receiverId:     { type: String, required: true },  // who receives it
  senderId:       { type: String, required: true },  // who triggered it
  senderUsername: { type: String },
  senderAvatar:   { type: String },
  type:           {
    type: String,
    enum: ["cheer", "follow", "comment", "message"],
    required: true
  },
  message:  { type: String },  // human readable e.g. "Alex cheered your post"
  postId:   { type: String, default: null },
  read:     { type: Boolean, default: false },
  createdAt:{ type: Date, default: Date.now }
});

module.exports = mongoose.model("Notification", notificationSchema);