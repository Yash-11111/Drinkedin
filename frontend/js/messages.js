const API_MSG   = `${BASE_URL}/api/messages`;
const API_USERS = `${BASE_URL}/api/users`;

if (!localStorage.getItem("token")) window.location.href = "login.html";

function getToken()    { return localStorage.getItem("token"); }
function authHeaders() { return { "Authorization": "Bearer " + getToken() }; }

function getCurrentUser() {
  try { return JSON.parse(atob(getToken().split(".")[1])); }
  catch { return null; }
}

function escapeHtml(text = "") {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 2600);
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)  return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = document.body.classList.contains("light-mode") ? "🌙" : "☀️";
}
function loadTheme() {
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");
  updateThemeIcon();
}

// ── STATE ──
let currentPartnerId   = null;
let currentPartnerName = null;
let currentRoomId      = null;
let allConversations   = [];
let socket             = null;
let isTyping           = false;
let typingTimeout      = null;

// ── INIT SOCKET ──
function initSocket() {
  const me = getCurrentUser();
  if (!me) return;

  socket = io(BASE_URL);

  socket.on("connect", () => {
    console.log("🔌 Socket connected");
    socket.emit("user_online", me.userId);
  });

  // New message received
  socket.on("new_message", (message) => {
    const roomId = [me.userId, currentPartnerId].sort().join("_");
    if (message.senderId === currentPartnerId || message.receiverId === currentPartnerId) {
      appendMessage(message);
    }
    loadConversations(); // refresh inbox
  });

  // Message deleted
  socket.on("message_deleted", ({ messageId }) => {
    const el = document.getElementById("msg-" + messageId);
    if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }
  });

  // Typing indicator
  socket.on("user_typing", ({ username }) => {
    const el = document.getElementById("typingIndicator");
    if (el) { el.textContent = `${username} is typing…`; el.style.display = "block"; }
  });

  socket.on("user_stop_typing", () => {
    const el = document.getElementById("typingIndicator");
    if (el) el.style.display = "none";
  });

  // Message notification (from other pages)
  socket.on("message_notification", ({ receiverId, senderUsername }) => {
    if (receiverId === me.userId && senderUsername !== currentPartnerName) {
      showToast(`💬 New message from ${senderUsername}`);
      loadConversations();
    }
  });

  // Online users
  socket.on("online_users", (userIds) => {
    updateOnlineStatus(userIds);
  });

  socket.on("disconnect", () => {
    console.log("❌ Socket disconnected");
  });
}

// ── UPDATE ONLINE STATUS ──
function updateOnlineStatus(onlineUserIds) {
  document.querySelectorAll(".conversation-item").forEach(el => {
    const partnerId = el.dataset.partnerId;
    const dot       = el.querySelector(".online-dot");
    if (dot) dot.style.display = onlineUserIds.includes(partnerId) ? "block" : "none";
  });
}

// ── LOAD CONVERSATIONS ──
async function loadConversations() {
  try {
    const res  = await fetch(`${API_MSG}/conversations`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    allConversations = data;
    renderConversations(data);

    const totalUnread = data.reduce((sum, c) => sum + c.unreadCount, 0);
    const badge = document.getElementById("unreadBadge");
    if (badge) {
      badge.textContent   = totalUnread;
      badge.style.display = totalUnread > 0 ? "flex" : "none";
    }
  } catch (err) {
    console.error("Conversations error:", err);
  }
}

function renderConversations(conversations) {
  const list = document.getElementById("conversationsList");
  if (!list) return;

  if (!conversations.length) {
    list.innerHTML = `<p class="inbox-empty">No conversations yet.<br/>Start one! 🍸</p>`;
    return;
  }

  list.innerHTML = "";
  conversations.forEach(({ partner, lastMessage, unreadCount }) => {
    const item = document.createElement("div");
    item.className         = "conversation-item" + (currentPartnerId === partner._id.toString() ? " active" : "");
    item.dataset.partnerId = partner._id.toString();
    item.onclick           = () => openConversation(partner._id, partner.username, partner.avatarUrl, partner.headline);

    item.innerHTML = `
      <div class="avatar-status-wrap">
        <img src="${partner.avatarUrl || `https://i.pravatar.cc/44?u=${encodeURIComponent(partner.username)}`}"
             alt="${escapeHtml(partner.username)}"/>
        <span class="online-dot" style="display:none"></span>
      </div>
      <div class="convo-info">
        <div class="convo-top">
          <strong>${escapeHtml(partner.username)}</strong>
          <small>${lastMessage ? timeAgo(lastMessage.createdAt) : ""}</small>
        </div>
        <p class="convo-preview">${lastMessage ? escapeHtml(lastMessage.text) : "Start a conversation"}</p>
      </div>
      ${unreadCount > 0 ? `<span class="unread-dot">${unreadCount}</span>` : ""}
    `;
    list.appendChild(item);
  });
}

function filterConversations(query) {
  const filtered = allConversations.filter(c =>
    c.partner.username.toLowerCase().includes(query.toLowerCase())
  );
  renderConversations(filtered);
}

// ── OPEN CONVERSATION ──
async function openConversation(partnerId, partnerName, partnerAvatar, partnerHeadline) {
  // Leave old room
  if (currentRoomId && socket) socket.emit("leave_room", currentRoomId);

  currentPartnerId   = partnerId.toString();
  currentPartnerName = partnerName;
  currentRoomId      = [getCurrentUser()?.userId, currentPartnerId].sort().join("_");

  // Join new room
  if (socket) socket.emit("join_room", currentRoomId);

  // Update UI
  document.getElementById("chatEmptyState").style.display  = "none";
  document.getElementById("chatHeader").style.display      = "flex";
  document.getElementById("chatMessages").style.display    = "flex";
  document.getElementById("chatInputArea").style.display   = "flex";

  document.getElementById("chatPartnerName").textContent     = partnerName;
  document.getElementById("chatPartnerHeadline").textContent = partnerHeadline || "DrinkedIn Member";
  document.getElementById("chatPartnerAvatar").src =
    partnerAvatar || `https://i.pravatar.cc/44?u=${encodeURIComponent(partnerName)}`;

  // Highlight active
  document.querySelectorAll(".conversation-item").forEach(el => el.classList.remove("active"));
  document.querySelector(`[data-partner-id="${currentPartnerId}"]`)?.classList.add("active");

  await loadMessages();
  loadConversations();
}

// ── LOAD MESSAGES ──
async function loadMessages() {
  if (!currentPartnerId) return;
  try {
    const res      = await fetch(`${API_MSG}/${currentPartnerId}`, { headers: authHeaders() });
    const messages = await res.json();
    if (!res.ok) return;
    renderMessages(messages);
  } catch (err) {
    console.error("Load messages error:", err);
  }
}

function renderMessages(messages) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const me = getCurrentUser();
  container.innerHTML = "";

  if (!messages.length) {
    container.innerHTML = `<p class="no-messages">No messages yet. Say hello! 🍸</p>`;
    return;
  }

  messages.forEach(msg => appendMessage(msg, false));
  container.scrollTop = container.scrollHeight;
}

// ── APPEND SINGLE MESSAGE ──
function appendMessage(msg, scroll = true) {
  const container = document.getElementById("chatMessages");
  if (!container) return;

  const me     = getCurrentUser();
  const isMine = msg.senderId === me?.userId;

  // Remove "no messages" placeholder
  const placeholder = container.querySelector(".no-messages");
  if (placeholder) placeholder.remove();

  // Don't duplicate
  if (document.getElementById("msg-" + msg._id)) return;

  const div     = document.createElement("div");
  div.className = "message-bubble-wrap " + (isMine ? "mine" : "theirs");
  div.id        = "msg-" + msg._id;

  div.innerHTML = `
    <div class="message-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}">
      <p>${escapeHtml(msg.text)}</p>
      <small>${timeAgo(msg.createdAt)}</small>
    </div>
    ${isMine ? `<button class="del-msg-btn" onclick="deleteMessage('${msg._id}')">🗑️</button>` : ""}
  `;

  container.appendChild(div);
  if (scroll) container.scrollTop = container.scrollHeight;
}

// ── SEND MESSAGE ──
async function sendMessage() {
  const input = document.getElementById("chatInput");
  const text  = input?.value.trim();
  if (!text || !currentPartnerId) return;

  input.value = "";

  // Stop typing indicator
  if (socket && currentRoomId) {
    socket.emit("stop_typing", { roomId: currentRoomId });
  }

  try {
    const res  = await fetch(`${API_MSG}/send`, {
      method:  "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body:    JSON.stringify({ receiverId: currentPartnerId, text })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.msg || "Error sending"); return; }
    // Message will appear via socket event
  } catch {
    showToast("Could not send message.");
  }
}

// ── TYPING INDICATOR ──
function handleTyping() {
  if (!socket || !currentRoomId) return;
  const me = getCurrentUser();

  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", { roomId: currentRoomId, username: me?.username });
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit("stop_typing", { roomId: currentRoomId });
  }, 1500);
}

// ── DELETE MESSAGE ──
async function deleteMessage(id) {
  try {
    const res = await fetch(`${API_MSG}/${id}`, {
      method:  "DELETE",
      headers: authHeaders()
    });
    if (!res.ok) { const d = await res.json(); showToast(d.msg || "Error"); }
    // Removal handled by socket event
  } catch {
    showToast("Could not reach server.");
  }
}

// ── NEW MESSAGE MODAL ──
function openNewMessageModal() {
  document.getElementById("newMessageModal").classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("userSearch").focus();
}

function closeNewMessageModal() {
  document.getElementById("newMessageModal").classList.remove("open");
  document.body.style.overflow = "";
  document.getElementById("userSearch").value            = "";
  document.getElementById("userSearchResults").innerHTML = "";
}

async function searchUsers(query) {
  const results = document.getElementById("userSearchResults");
  if (!query.trim()) { results.innerHTML = ""; return; }

  try {
    const res   = await fetch(`${API_USERS}/all`, { headers: authHeaders() });
    const users = await res.json();

    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(query.toLowerCase())
    );

    if (!filtered.length) {
      results.innerHTML = `<p style="color:var(--text-muted);font-size:13px">No users found</p>`;
      return;
    }

    results.innerHTML = "";
    filtered.forEach(user => {
      const item     = document.createElement("div");
      item.className = "user-search-item";
      item.innerHTML = `
        <img src="${user.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(user.username)}`}"
             alt="${escapeHtml(user.username)}"/>
        <div>
          <strong>${escapeHtml(user.username)}</strong>
          <small>${escapeHtml(user.headline || "DrinkedIn Member")}</small>
        </div>
      `;
      item.onclick = () => {
        closeNewMessageModal();
        openConversation(user._id, user.username, user.avatarUrl, user.headline);
        loadConversations();
      };
      results.appendChild(item);
    });
  } catch {
    results.innerHTML = `<p style="color:var(--text-muted)">Error searching</p>`;
  }
}

// ── NAVBAR SCROLL ──
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (nav) nav.style.boxShadow = window.scrollY > 8 ? "0 4px 28px rgba(0,0,0,0.55)" : "none";
}, { passive: true });

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  initSocket();
  loadConversations();
});