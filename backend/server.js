require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const path      = require("path");
const http      = require("http");
const { Server } = require("socket.io");

const app    = express();
const server = http.createServer(app);
const FRONTEND_URL = process.env.FRONTEND_URL ;

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});
app.use(cors());

const PORT      = process.env.PORT      || 8000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/drinkedin";

// ── MIDDLEWARE ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── SERVE FRONTEND ──
app.use(express.static(path.join(__dirname, "../frontend")));

// ── SHARE io WITH ROUTES ──
app.use((req, res, next) => { req.io = io; next(); });

// ── API ROUTES ──
app.use("/api/auth",     require("./routes/AuthRoutes"));
app.use("/api/posts",    require("./routes/postRoutes"));
app.use("/api/users",    require("./routes/userRoutes"));
app.use("/api/messages", require("./routes/messageRoutes"));
app.use("/api/notifications", require("./routes/notificationRoutes"));
app.use("/api/recommend", require("./routes/recommendRoutes"));

// ── HEALTH CHECK ──
app.get("/api", (req, res) => res.json({ status: "DrinkedIn API running 🍸" }));

// ── GLOBAL ERROR HANDLER ──
app.use((err, req, res, next) => {
  if (err.message?.includes("Only image files"))
    return res.status(400).json({ msg: err.message });
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(400).json({ msg: "Image too large." });
  console.error(err.stack);
  res.status(500).json({ msg: "Something went wrong" });
});

// ── SOCKET.IO ──
// Store online users: { userId → socketId }
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // User comes online
  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
    console.log(`✅ User online: ${userId}`);
  });

  // Join a private room for DMs
  socket.on("join_room", (roomId) => {
    socket.join(roomId);
    console.log(`📥 Socket joined room: ${roomId}`);
  });

  // Leave a room
  socket.on("leave_room", (roomId) => {
    socket.leave(roomId);
  });

  // Typing indicator
  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user_typing", { username });
  });

  socket.on("stop_typing", ({ roomId }) => {
    socket.to(roomId).emit("user_stop_typing");
  });

  // Disconnect
  socket.on("disconnect", () => {
    onlineUsers.forEach((socketId, userId) => {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`❌ User offline: ${userId}`);
      }
    });
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});

// Export io for use in routes
module.exports.io = io;

// ── DB + SERVER ──
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS:          45000,
})
  .then(() => {
    console.log("✅ MongoDB connected");
    server.listen(PORT, () => {
      console.log(`🍸 DrinkedIn running → http://localhost:${PORT}`);
    });

    // Keep Render free tier awake (pings every 14 mins)
    setInterval(() => {
  fetch(`${process.env.FRONTEND_URL ? `https://drinkedin-ez8u.onrender.com` : `http://localhost:${PORT}`}/api`)
    .catch(() => {});
}, 14 * 60 * 1000);
  })
  .catch(err => {
    console.error("❌ DB Error:", err.message);
    process.exit(1);
  });