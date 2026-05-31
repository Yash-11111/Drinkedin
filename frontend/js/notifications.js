const API_NOTIF = `${BASE_URL}/api/notifications`;
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
function resetSessionTimer() {
  localStorage.setItem("sessionExpiry", Date.now() + (3 * 60 * 60 * 1000));
}
function checkSessionExpiry() {
  const expiry = localStorage.getItem("sessionExpiry");
  if (expiry && Date.now() > parseInt(expiry)) {
    localStorage.removeItem("token");
    localStorage.removeItem("sessionExpiry");
    window.location.href = "login.html";
  }
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
async function loadNavAvatar() {
  try {
    const res  = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const user = await res.json();
    if (!res.ok) return;
    if (user.avatarUrl) {
      document.querySelectorAll(".nav-avatar").forEach(img => img.src = user.avatarUrl);
    }
  } catch {}
}

// ── STATE ──
let allNotifications = [];
let currentFilter    = "all";

// ── LOAD NOTIFICATIONS ──
async function loadNotifications() {
  try {
    const res  = await fetch(API_NOTIF, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    allNotifications = data;
    renderNotifications();
  } catch (err) {
    console.error(err);
    showToast("Could not load notifications.");
  }
}

// ── RENDER ──
function renderNotifications() {
  const list = document.getElementById("notifList");
  if (!list) return;

  const filtered = currentFilter === "all"
    ? allNotifications
    : allNotifications.filter(n => n.type === currentFilter);

  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state" style="margin-top:40px">
        <span class="empty-icon">🔔</span>
        <h3>No notifications yet</h3>
        <p>When someone cheers, follows or messages you — it'll show here.</p>
        <a href="index.html" class="btn-primary">Go to Feed</a>
      </div>`;
    return;
  }

  list.innerHTML = "";
  filtered.forEach(notif => {
    const el     = document.createElement("div");
    el.className = `notif-item ${notif.read ? "" : "unread"}`;
    el.id        = "notif-" + notif._id;

    const iconMap = {
      cheer:   "🥂",
      follow:  "🍻",
      comment: "💬",
      message: "✉️",
      event:   "🎉" 
    };

    const linkMap = {
      cheer:   "index.html",
      follow:  "profile.html",
      comment: "index.html",
      message: "messages.html",
      event: "events.html"
    };

    el.innerHTML = `
      <div class="notif-content" onclick="markRead('${notif._id}'); window.location='${linkMap[notif.type]}'">
        <div class="notif-avatar-wrap">
          <img src="${notif.senderAvatar ||
            `https://i.pravatar.cc/44?u=${encodeURIComponent(notif.senderUsername || "user")}`}"
               alt="${escapeHtml(notif.senderUsername || "")}"/>
          <span class="notif-type-icon">${iconMap[notif.type]}</span>
        </div>
        <div class="notif-body">
          <p>${escapeHtml(notif.message)}</p>
          <small>${timeAgo(notif.createdAt)}</small>
        </div>
        ${!notif.read ? '<div class="notif-unread-dot"></div>' : ""}
      </div>
      <button class="notif-delete-btn" onclick="deleteNotif('${notif._id}')">✕</button>
    `;

    list.appendChild(el);
  });
}

// ── FILTER ──
function filterNotifs(type, btn) {
  currentFilter = type;
  document.querySelectorAll(".notif-tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderNotifications();
}

// ── MARK ONE READ ──
async function markRead(id) {
  try {
    await fetch(`${API_NOTIF}/${id}/read`, {
      method:  "PUT",
      headers: authHeaders()
    });
    const notif = allNotifications.find(n => n._id === id);
    if (notif) notif.read = true;
    renderNotifications();
  } catch {}
}

// ── MARK ALL READ ──
async function markAllRead() {
  try {
    await fetch(`${API_NOTIF}/mark-all-read`, {
      method:  "PUT",
      headers: authHeaders()
    });
    allNotifications.forEach(n => n.read = true);
    renderNotifications();
    showToast("All marked as read ✓");
  } catch {
    showToast("Could not reach server.");
  }
}

// ── DELETE ONE ──
async function deleteNotif(id) {
  try {
    await fetch(`${API_NOTIF}/${id}`, {
      method:  "DELETE",
      headers: authHeaders()
    });
    allNotifications = allNotifications.filter(n => n._id !== id);
    const el = document.getElementById("notif-" + id);
    if (el) { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 300); }
    showToast("Deleted");
  } catch {
    showToast("Could not reach server.");
  }
}

// ── CLEAR ALL ──
async function clearAll() {
  if (!confirm("Clear all notifications?")) return;
  try {
    await fetch(API_NOTIF, { method: "DELETE", headers: authHeaders() });
    allNotifications = [];
    renderNotifications();
    showToast("All cleared 🗑️");
  } catch {
    showToast("Could not reach server.");
  }
}

// ── SOCKET — live notifications ──
function initSocket() {
  const me     = getCurrentUser();
  if (!me) return;

  const socket = io(BASE_URL);
  socket.emit("user_online", me.userId);

  const events = ["cheer_notification", "follow_notification", "comment_notification", "message_notification", "event_notification"];

  events.forEach(event => {
    socket.on(event, async (data) => {
      if (data.receiverId === me.userId) {
        // Reload notifications to show new one
        await loadNotifications();
        showToast(
          event === "cheer_notification"   ? `🥂 ${data.senderUsername} cheered your post!`  :
          event === "follow_notification"  ? `🍻 ${data.senderUsername} followed you!`        :
          event === "comment_notification" ? `💬 ${data.senderUsername} commented on your post` :
          event === "event_notification"   ? `🎉 ${data.senderUsername} invited you to "${data.eventTitle}"!` :
          `✉️ New message from ${data.senderUsername}`
        );
      }
    });
  });
}

// ── NAVBAR SCROLL ──
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (nav) nav.style.boxShadow = window.scrollY > 8 ? "0 4px 28px rgba(0,0,0,0.55)" : "none";
}, { passive: true });

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  resetSessionTimer();
  checkSessionExpiry();
  loadNavAvatar();
  initSocket();
  loadNotifications();
});
