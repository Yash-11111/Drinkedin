const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  creatorId:       { type: String, required: true },
  creatorUsername: { type: String, required: true },
  creatorAvatar:   { type: String, default: null },
  title:           { type: String, required: true },
  description:     { type: String, default: "" },
  location:        { type: String, required: true },
  date:            { type: Date, required: true },
  drinks:          { type: [String], default: [] },
  invitees: [{
    userId:    String,
    username:  String,
    avatarUrl: String,
    status:    { type: String, enum: ["pending", "accepted", "declined"], default: "pending" }
  }],
  isPublic:  { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Event", eventSchema);