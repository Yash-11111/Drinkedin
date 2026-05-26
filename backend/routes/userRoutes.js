const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Post = require("../models/Post");
const auth = require("../middleware/auth");
const Notification = require("../models/Notification");
const cloudinary = require("../config/cloudinary");
const { uploadAvatar } = require("../config/multer");
const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "DRINKEDIN_SECRET_KEY";
const { sendFollowEmail } = require("../utils/sendEmail");

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-otp -otpExpiry");
    if (!user) return res.status(404).json({ msg: "User not found" });
    res.json(user);
  } catch { res.status(500).json({ msg: "Error fetching user" }); }
});

router.put("/avatar", auth, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: "No image uploaded" });
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });
    if (user.avatarPublicId) await cloudinary.uploader.destroy(user.avatarPublicId);
    user.avatarUrl = req.file.path;
    user.avatarPublicId = req.file.filename;
    await user.save();
    // Update avatarUrl in all posts by this user
    await Post.updateMany(
      { userId: req.user.userId },
      { $set: { avatarUrl: user.avatarUrl } }
    );
    res.json({ msg: "Avatar updated", avatarUrl: user.avatarUrl });
  } catch { res.status(500).json({ msg: "Error uploading avatar" }); }
});

// ── SET DEFAULT AVATAR URL (no file upload) ──
router.put("/avatar-url", auth, async (req, res) => {
  try {
    const { avatarUrl, avatarType } = req.body;
    if (!avatarUrl) return res.status(400).json({ msg: "Avatar URL required" });

    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // Delete old Cloudinary avatar if exists
    if (user.avatarPublicId) {
      const cloudinary = require("../config/cloudinary");
      await cloudinary.uploader.destroy(user.avatarPublicId);
      user.avatarPublicId = null;
    }

    user.avatarUrl = avatarUrl;
    user.avatarType = avatarType || "default";
    await user.save();

    // Update all posts with new avatar
    const Post = require("../models/Post");
    await Post.updateMany(
      { userId: req.user.userId },
      { $set: { avatarUrl } }
    );

    res.json({ msg: "Avatar updated", avatarUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating avatar" });
  }
});


router.put("/update-profile", auth, async (req, res) => {
  try {
    const { username, headline, location, bio } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    if (username) user.username = username.trim();
    if (headline) user.headline = headline.trim();
    if (location) user.location = location.trim();
    if (bio) user.bio = bio.trim();

    await user.save();
    if (username) {
      const Post = require("../models/Post");

      // Update posts
      await Post.updateMany(
        { userId: req.user.userId },
        { $set: { username: username.trim() } }
      );

      // Update comments made by this user inside other posts
      await Post.updateMany(
        { "comments.userId": req.user.userId },
        { $set: { "comments.$[elem].username": username.trim() } },
        { arrayFilters: [{ "elem.userId": req.user.userId }] }
      );
    }
    const newToken = jwt.sign(
      { userId: user._id.toString(), username: user.username },
      SECRET,
      { expiresIn: "7d" }
    );
    res.json({ msg: "Profile updated", user, token: newToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error updating profile" });
  }
});

// ── GET ALL USERS (for suggestions) ──
router.get("/all", auth, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user.userId } }
    ).select("-otp -otpExpiry -avatarPublicId");
    res.json(users);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching users" });
  }
});

// ── FOLLOW / UNFOLLOW ──
router.put("/follow/:targetId", auth, async (req, res) => {
  try {
    if (req.user.userId === req.params.targetId)
      return res.status(400).json({ msg: "You can't follow yourself" });

    const me = await User.findById(req.user.userId);
    const target = await User.findById(req.params.targetId);

    if (!me || !target)
      return res.status(404).json({ msg: "User not found" });

    const isFollowing = me.following.includes(req.params.targetId);

    if (isFollowing) {
      // ── UNFOLLOW ──
      me.following = me.following.filter(id => id !== req.params.targetId);
      target.followers = target.followers.filter(id => id !== req.user.userId);

      await me.save();
      await target.save();

      res.json({
        following: false,
        followerCount: target.followers.length,
        followingCount: me.following.length
      });

    } else {
      // ── FOLLOW ──
      me.following.push(req.params.targetId);
      target.followers.push(req.user.userId);

      await me.save();
      await target.save();

      // Save notification to DB
      await Notification.create({
        receiverId: req.params.targetId,
        senderId: req.user.userId,
        senderUsername: me.username,
        senderAvatar: me.avatarUrl,
        type: "follow",
        message: `${me.username} started following you 🍻`
      });

      // Emit via socket
      if (req.io) {
        req.io.emit("follow_notification", {
          receiverId: req.params.targetId,
          senderId: req.user.userId,
          senderUsername: me.username,
          senderAvatar: me.avatarUrl
        });
      }

      // Send email (fire and forget)
      User.findById(req.params.targetId).then(targetUser => {
        if (targetUser?.email) {
          sendFollowEmail(targetUser.email, me.username, me.avatarUrl)
            .catch(err => console.error("Follow email error:", err));
        }
      });



      res.json({
        following: true,
        followerCount: target.followers.length,
        followingCount: me.following.length
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error following user" });
  }
});


// ── GET FOLLOWERS LIST ──
router.get("/followers", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId);
    const followers = await User.find(
      { _id: { $in: me.followers } }
    ).select("username avatarUrl headline");
    res.json(followers);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching followers" });
  }
});

// ── GET FOLLOWING LIST ──
router.get("/following", auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.userId);
    const following = await User.find(
      { _id: { $in: me.following } }
    ).select("username avatarUrl headline");
    res.json(following);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching following" });
  }
});

// ── SAVE / UNSAVE POST ──
router.put("/save/:postId", auth, async (req, res) => {
  try {
    const user   = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const postId    = req.params.postId;
    const isSaved   = user.savedPosts.includes(postId);

    if (isSaved) {
      user.savedPosts = user.savedPosts.filter(id => id !== postId);
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();
    res.json({ saved: !isSaved, savedPosts: user.savedPosts });
  } catch (err) {
    res.status(500).json({ msg: "Error saving post" });
  }
});

// ── GET SAVED POSTS ──
router.get("/saved-posts", auth, async (req, res) => {
  try {
    const user  = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ msg: "User not found" });

    const Post  = require("../models/Post");
    const posts = await Post.find({
      _id: { $in: user.savedPosts }
    }).sort({ createdAt: -1 });

    res.json(posts);
  } catch (err) {
    res.status(500).json({ msg: "Error fetching saved posts" });
  }
});

module.exports = router;

