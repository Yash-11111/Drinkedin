const express = require("express");
const router = express.Router();
const Post = require("../models/Post");
const User = require("../models/User");
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");
const cloudinary = require("../config/cloudinary");
const { uploadPostImage } = require("../config/multer");
// ===== GET ALL POSTS =====
router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching posts" });
  }
});

// ===== GET MY POSTS (profile) =====
router.get("/my-posts", auth, async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json({
      username: req.user.username,
      totalPosts: posts.length,
      posts
    });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching profile" });
  }
});

// ===== CREATE POST =====
router.post("/", auth, uploadPostImage.single("image"), async (req, res) => {
  try {
    if (!req.body.story || !req.body.story.trim()) {
      return res.status(400).json({ msg: "Story text is required" });
    }
    const user = await User.findById(req.user.userId);
    const post = new Post({
      userId: req.user.userId,
      username: req.user.username,
      avatarUrl: user?.avatarUrl || null,
      story: req.body.story.trim(),
      imageUrl: req.file ? req.file.path : null,
      imagePublicId: req.file ? req.file.filename : null,
      tags: req.body.tags ? JSON.parse(req.body.tags) : []
    });
    const saved = await post.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ msg: "Error creating post" });
  }
});

// ===== UPVOTE =====
router.put("/:id/upvote", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const userId = req.user.userId;

    // toggle upvote
    const idx = post.upvotedBy.indexOf(userId);
    const wasUpvoted = idx !== -1; // true = removing cheer, false = adding cheer

    if (wasUpvoted) {
      // already upvoted → remove
      post.upvotedBy.splice(idx, 1);
      post.upvotes = Math.max(0, post.upvotes - 1);
    } else {
      post.upvotedBy.push(userId);
      post.upvotes += 1;
    }

    await post.save();
    const io = req.io;
    if (!wasUpvoted && post.userId !== req.user.userId) {
      const sender = await require("../models/User")
        .findById(req.user.userId)
        .select("username avatarUrl");

      // Save to DB
      await Notification.create({
        receiverId: post.userId,
        senderId: req.user.userId,
        senderUsername: sender?.username,
        senderAvatar: sender?.avatarUrl,
        type: "cheer",
        message: `${sender?.username} cheered your post 🥂`,
        postId: post._id.toString()
      });

      // Emit via socket
      if (io) {
        io.emit("cheer_notification", {
          receiverId: post.userId,
          senderId: req.user.userId,
          senderUsername: sender?.username,
          senderAvatar: sender?.avatarUrl,
          postId: post._id
        });
      }
    }
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error upvoting" });
  }
});
// ===== ADD COMMENT =====
router.post("/:id/comment", auth, async (req, res) => {
  try {
    if (!req.body.text || !req.body.text.trim()) {
      return res.status(400).json({ msg: "Comment text required" });
    }
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    post.comments.unshift({
      userId: req.user.userId,
      username: req.user.username,
      text: req.body.text.trim()
    });

    await post.save();
    // Notify post owner
    if (post.userId !== req.user.userId) {
      const sender = await require("../models/User")
        .findById(req.user.userId)
        .select("username avatarUrl");

      await Notification.create({
        receiverId: post.userId,
        senderId: req.user.userId,
        senderUsername: sender?.username,
        senderAvatar: sender?.avatarUrl,
        type: "comment",
        message: `${sender?.username} commented on your post 💬`,
        postId: post._id.toString()
      });

      if (req.io) {
        req.io.emit("comment_notification", {
          receiverId: post.userId,
          senderUsername: sender?.username,
          senderAvatar: sender?.avatarUrl
        });
      }
    }
    res.json(post);
  } catch (err) {
    res.status(500).json({ msg: "Error commenting" });
  }
});

// ── DELETE COMMENT ──
router.delete("/:postId/comment/:commentId", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ msg: "Comment not found" });

    if (comment.userId !== req.user.userId)
      return res.status(403).json({ msg: "Not authorized" });

    post.comments.pull({ _id: req.params.commentId });
    await post.save();

    res.json({ msg: "Comment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error deleting comment" });
  }
});

// ===== EDIT POST =====
router.put("/:id", auth, uploadPostImage.single("image"), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });
    if (post.userId !== req.user.userId)
      return res.status(403).json({ msg: "Not authorized" });

    // Update story
    if (req.body.story) post.story = req.body.story.trim();

    // Update tags
    if (req.body.tags) {
      try { post.tags = JSON.parse(req.body.tags); }
      catch { post.tags = []; }
    }

    // Replace image
    if (req.file) {
      if (post.imagePublicId) await cloudinary.uploader.destroy(post.imagePublicId);
      post.imageUrl = req.file.path;
      post.imagePublicId = req.file.filename;
    }

    // Remove image
    if (req.body.removeImage === "true" && post.imagePublicId) {
      await cloudinary.uploader.destroy(post.imagePublicId);
      post.imageUrl = null;
      post.imagePublicId = null;
    }

    await post.save();
    res.json(post);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating post" });
  }
});

// ===== DELETE POST =====
router.delete("/:id", auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ msg: "Post not found" });
    if (post.userId !== req.user.userId) return res.status(403).json({ msg: "Not authorized" });
    if (post.imagePublicId) await cloudinary.uploader.destroy(post.imagePublicId);
    await post.deleteOne();
    res.json({ msg: "Post deleted" });
  } catch (err) {
    res.status(500).json({ msg: "Error deleting post" });
  }
});

// ── EXPLORE — GET POSTS BY CATEGORY ──
router.get("/explore", async (req, res) => {
  try {
    const { category, tag, search } = req.query;

    let query = {};

    // Filter by drink category (emoji in story)
    if (category && category !== "all") {
      const categoryMap = {
        whiskey: ["🥃", "whiskey", "scotch", "bourbon", "malt"],
        beer: ["🍺", "beer", "ipa", "ale", "lager", "stout", "brew"],
        wine: ["🍷", "wine", "merlot", "chardonnay", "rosé", "rose"],
        cocktail: ["🍹", "cocktail", "mojito", "margarita", "negroni", "gin"],
        bubbly: ["🍾", "champagne", "prosecco", "sparkling", "bubbly"],
      };

      const keywords = categoryMap[category] || [];
      query.$or = keywords.map(k => ({
        story: { $regex: k, $options: "i" }
      }));
    }

    // Filter by tag
    if (tag) {
      query.tags = { $regex: tag, $options: "i" };
    }

    // Search by keyword
   if (search) {
  const searchLower = search.trim().toLowerCase();

  // Map common drink names to their emoji + related keywords
  const categoryMap = {
    whiskey:  ["🥃", "whiskey", "scotch", "bourbon", "malt"],
    beer:     ["🍺", "beer", "ipa", "ale", "lager", "stout", "brew"],
    wine:     ["🍷", "wine", "merlot", "chardonnay", "rosé", "rose"],
    cocktail: ["🍹", "cocktail", "mojito", "margarita", "negroni", "gin"],
    bubbly:   ["🍾", "champagne", "prosecco", "sparkling", "bubbly"]
  };

  // Find if search term matches a category — get all its related keywords + emoji
  let expandedTerms = [search];
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => k.toLowerCase() === searchLower) || cat === searchLower) {
      expandedTerms = [...expandedTerms, ...keywords];
      break;
    }
  }

  // Build $or across story, username, tags using all expanded terms
  const orConditions = [];
  expandedTerms.forEach(term => {
    orConditions.push({ story:    { $regex: term, $options: "i" } });
    orConditions.push({ username: { $regex: term, $options: "i" } });
    orConditions.push({ tags:     { $regex: term, $options: "i" } });
  });

  query.$or = orConditions;
}

    const posts = await Post.find(query).sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error fetching explore posts" });
  }
});

// ── TRENDING TAGS ──
router.get("/trending-tags", async (req, res) => {
  try {
    const posts = await Post.find({ tags: { $exists: true, $ne: [] } });

    // Count tag frequency
    const tagCount = {};
    posts.forEach(post => {
      (post.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // Sort by frequency
    const sorted = Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching trending tags" });
  }
});
// ── GET POSTS BY USER ID ──
router.get("/user/:userId", auth, async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });
    res.json({ posts, totalPosts: posts.length });
  } catch (err) {
    res.status(500).json({ msg: "Error fetching user posts" });
  }
});
module.exports = router;
