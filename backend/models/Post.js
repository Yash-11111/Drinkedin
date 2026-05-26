const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  userId:    String,
  username:  String,
  text:      String,
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  userId:    String,
  username:  String,
  avatarUrl: { type: String, default: null },
  story:     { type: String, required: true },
  imageUrl:{ type: String, default: null },
  imagePublicId: { type: String, default: null },
  tags:{ type: [String], default: [] },
  upvotes:   { type: Number, default: 0 },
  upvotedBy: [String],
  comments:  [commentSchema],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Post", postSchema);
