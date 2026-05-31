const API_EVENTS = `${BASE_URL}/api/events`;
const API_USERS = `${BASE_URL}/api/users`;

if (!localStorage.getItem("token")) window.location.href = "login.html";

function getToken() { return localStorage.getItem("token"); }
function authHeaders() { return { "Authorization": "Bearer " + getToken() }; }
function getCurrentUser() {
  try { return JSON.parse(atob(getToken().split(".")[1])); }
  catch { return null; }
}
function escapeHtml(t = "") {
  const d = document.createElement("div"); d.textContent = t; return d.innerHTML;
}
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 2600);
}
// ── GLOBAL USER SEARCH WITH SUGGESTIONS ──
let searchTimeout;

async function handleGlobalSearch(query) {
  const dropdown = document.getElementById("searchDropdown");
  if (!dropdown) return;

  const q = query.trim();

  if (!q) {
    dropdown.innerHTML = "";
    dropdown.classList.remove("open");
    return;
  }

  // Show loading state
  dropdown.innerHTML = `<div class="search-loading">🔍 Searching...</div>`;
  dropdown.classList.add("open");

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API_USERS}/search?q=${encodeURIComponent(q)}`, {
        headers: authHeaders()
      });
      const users = await res.json();

      if (!users.length) {
        dropdown.innerHTML = `
          <div class="search-no-results">
            <span>😕</span>
            <p>No users found for "<strong>${escapeHtml(q)}</strong>"</p>
          </div>`;
        return;
      }

      dropdown.innerHTML = "";

      // Header
      const header = document.createElement("div");
      header.className = "search-dropdown-header";
      header.textContent = `👥 Users matching "${q}"`;
      dropdown.appendChild(header);

      users.forEach(user => {
        // Highlight matching part of username
        const highlighted = highlightMatch(user.username, q);

        const item = document.createElement("div");
        item.className = "search-result-item";
        item.innerHTML = `
          <img src="${user.avatarUrl || `https://i.pravatar.cc/36?u=${encodeURIComponent(user.username)}`}"
               alt="${escapeHtml(user.username)}"/>
          <div class="search-result-info">
            <strong>${highlighted}</strong>
            <small>${escapeHtml(user.headline || "DrinkedIn Member")}</small>
          </div>
          <div class="search-result-meta">
            <span>${user.followers?.length || 0} followers</span>
          </div>
        `;

        // Click navigates to their profile
        item.addEventListener("mousedown", (e) => {
          e.preventDefault(); // prevent blur hiding dropdown
          goToUserProfile(user._id, user.username);
        });

        dropdown.appendChild(item);
      });

      // Footer — search all
      const footer = document.createElement("div");
      footer.className = "search-dropdown-footer";
      footer.innerHTML = `<span>Press Enter to search all results</span>`;
      dropdown.appendChild(footer);

    } catch (err) {
      dropdown.innerHTML = `<div class="search-no-results">Error searching</div>`;
    }
  }, 250); // 250ms debounce — fast like Google
}

// ── HIGHLIGHT MATCHING TEXT ──
function highlightMatch(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, "gi");
  return escapeHtml(text).replace(regex, `<mark class="search-highlight">$1</mark>`);
}

// ── HIDE SEARCH RESULTS ──
function hideSearchResults() {
  setTimeout(() => {
    const dropdown = document.getElementById("searchDropdown");
    if (dropdown) {
      dropdown.classList.remove("open");
      dropdown.innerHTML = "";
    }
  }, 150);
}

// ── GO TO USER PROFILE ──
function goToUserProfile(userId, username) {
  // Store target user and go to profile page
  sessionStorage.setItem("viewingUser", JSON.stringify({ userId, username }));
  window.location.href = `profile.html?user=${userId}`;

  const dropdown = document.getElementById("searchDropdown");
  if (dropdown) { dropdown.classList.remove("open"); dropdown.innerHTML = ""; }

  const input = document.getElementById("globalSearchInput");
  if (input) input.value = "";
}

// ── ENTER KEY — search in explore ──
document.addEventListener("keydown", e => {
  const input = document.getElementById("globalSearchInput");
  if (e.key === "Enter" && document.activeElement === input) {
    const q = input.value.trim();
    if (q) window.location.href = `explore.html?search=${encodeURIComponent(q)}`;
  }
});
function logout() { localStorage.removeItem("token"); window.location.href = "login.html"; }
function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = isLight ? "🌙" : "☀️";
}
function loadTheme() {
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");
  const btn = document.getElementById("themeToggle");
  if (btn) btn.textContent = document.body.classList.contains("light-mode") ? "🌙" : "☀️";
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatEventDate(date) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// ── STATE ──
let drinkTags = [];
let selectedInvitees = [];

// ── LOAD EVENTS ──
async function loadEvents() {
  try {
    const res = await fetch(`${API_EVENTS}/my-events`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    renderCreatedEvents(data.created || []);
    renderInvitedEvents(data.invited || []);
  } catch (err) {
    console.error(err);
    showToast("Could not load events.");
  }
}

// ── RENDER CREATED EVENTS ──
function renderCreatedEvents(events) {
  const container = document.getElementById("createdEventsList");
  if (!container) return;

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:40px">
        <span class="empty-icon">🎪</span>
        <h3>No events yet</h3>
        <p>Create your first drinking event and invite your crew!</p>
        <button class="btn-primary" onclick="openCreateEventModal()">+ Create Event</button>
      </div>`;
    return;
  }

  container.innerHTML = "";
  events.forEach(event => container.appendChild(buildEventCard(event, true)));
}

// ── RENDER INVITED EVENTS ──
function renderInvitedEvents(events) {
  const container = document.getElementById("invitedEventsList");
  if (!container) return;

  if (!events.length) {
    container.innerHTML = `
      <div class="empty-state" style="margin-top:40px">
        <span class="empty-icon">📬</span>
        <h3>No invitations yet</h3>
        <p>When someone invites you to an event it will appear here.</p>
      </div>`;
    return;
  }

  container.innerHTML = "";
  const me = getCurrentUser();
  events.forEach(event => {
    const myInvite = event.invitees.find(i => i.userId === me?.userId);
    container.appendChild(buildEventCard(event, false, myInvite?.status));
  });
}

// ── BUILD EVENT CARD ──
function buildEventCard(event, isOwner, myStatus) {
  const card = document.createElement("div");
  card.className = "event-card";
  card.id = "event-" + event._id;

  const isPast = new Date(event.date) < new Date();
  const statusMap = { pending: "⏳ Pending", accepted: "✅ Accepted", declined: "❌ Declined" };

  const drinksHTML = (event.drinks || []).map(d =>
    `<span class="post-tag">${escapeHtml(d)}</span>`
  ).join("");

  const inviteesHTML = (event.invitees || []).slice(0, 5).map(i => `
    <img src="${i.avatarUrl || `https://i.pravatar.cc/28?u=${encodeURIComponent(i.username)}`}"
         title="${escapeHtml(i.username)}" alt="${escapeHtml(i.username)}"
         class="invitee-avatar"/>
  `).join("");

  const extraInvitees = event.invitees.length > 5
    ? `<span class="invitee-extra">+${event.invitees.length - 5}</span>` : "";

  const actionBtns = isOwner ? `
    <button class="btn-outline event-action-btn" onclick="openEventDetail('${event._id}')">👁️ View</button>
    <button class="btn-outline event-action-btn del-btn" onclick="deleteEvent('${event._id}')">🗑️ Delete</button>
  ` : `
    ${myStatus === "pending" ? `
      <button class="btn-primary event-action-btn" onclick="respondToEvent('${event._id}', 'accepted')">✅ Accept</button>
      <button class="btn-outline event-action-btn del-btn" onclick="respondToEvent('${event._id}', 'declined')">❌ Decline</button>
    ` : `<span class="event-status-badge">${statusMap[myStatus] || ""}</span>`}
    <button class="btn-outline event-action-btn" onclick="openEventDetail('${event._id}')">👁️ View</button>
  `;

  card.innerHTML = `
    <div class="event-card-header">
      <div class="event-card-date ${isPast ? 'past' : ''}">
        <span class="event-month">${new Date(event.date).toLocaleString("en-US", { month: "short" })}</span>
        <span class="event-day">${new Date(event.date).getDate()}</span>
      </div>
      <div class="event-card-info">
        <h3>${escapeHtml(event.title)}</h3>
        <p class="event-meta">📍 ${escapeHtml(event.location)}</p>
        <p class="event-meta">🕐 ${formatEventDate(event.date)}</p>
        ${event.description ? `<p class="event-desc">${escapeHtml(event.description)}</p>` : ""}
      </div>
      <div class="event-card-creator">
        <img src="${event.creatorAvatar || `https://i.pravatar.cc/32?u=${encodeURIComponent(event.creatorUsername)}`}"
             alt="${escapeHtml(event.creatorUsername)}"/>
        <small>${escapeHtml(event.creatorUsername)}</small>
      </div>
    </div>
    ${drinksHTML ? `<div class="event-drinks">${drinksHTML}</div>` : ""}
    <div class="event-card-footer">
      <div class="event-invitees">
        ${inviteesHTML}${extraInvitees}
        <span class="invitees-count">${event.invitees.length} invited</span>
      </div>
      <div class="event-actions">${actionBtns}</div>
    </div>
  `;

  return card;
}

// ── OPEN EVENT DETAIL ──
async function openEventDetail(id) {
  try {
    const res = await fetch(`${API_EVENTS}/${id}`, { headers: authHeaders() });
    const event = await res.json();
    if (!res.ok) return;

    const acceptedCount = event.invitees.filter(i => i.status === "accepted").length;
    const declinedCount = event.invitees.filter(i => i.status === "declined").length;
    const pendingCount = event.invitees.filter(i => i.status === "pending").length;

    const inviteesDetailHTML = event.invitees.map(i => `
      <div class="follow-user-item">
        <img src="${i.avatarUrl || `https://i.pravatar.cc/38?u=${encodeURIComponent(i.username)}`}" alt="${escapeHtml(i.username)}"/>
        <div>
          <strong>${escapeHtml(i.username)}</strong>
          <small>${i.status === "accepted" ? "✅ Going" : i.status === "declined" ? "❌ Can't make it" : "⏳ Awaiting response"}</small>
        </div>
      </div>
    `).join("");

    document.getElementById("eventDetailContent").innerHTML = `
      <div class="modal-header">
        <h3>🎉 ${escapeHtml(event.title)}</h3>
        <button class="modal-close" onclick="closeEventDetail()">✕</button>
      </div>
      <div class="modal-body" style="flex-direction:column;gap:16px;padding:24px;">
        <div class="event-detail-info">
          <p>📍 <strong>${escapeHtml(event.location)}</strong></p>
          <p>🕐 <strong>${formatEventDate(event.date)}</strong></p>
          <p>👤 Hosted by <strong>${escapeHtml(event.creatorUsername)}</strong></p>
          ${event.description ? `<p style="color:var(--text-sub);margin-top:8px">${escapeHtml(event.description)}</p>` : ""}
        </div>
        <div class="event-rsvp-stats">
          <div class="rsvp-stat"><strong>${acceptedCount}</strong><span>Going ✅</span></div>
          <div class="rsvp-stat"><strong>${declinedCount}</strong><span>Can't go ❌</span></div>
          <div class="rsvp-stat"><strong>${pendingCount}</strong><span>Pending ⏳</span></div>
        </div>
        ${event.invitees.length ? `
          <div>
            <h4 class="widget-title" style="margin-bottom:12px">Guest List</h4>
            ${inviteesDetailHTML}
          </div>` : ""}
      </div>
    `;

    document.getElementById("eventDetailModal").classList.add("open");
    document.body.style.overflow = "hidden";
  } catch (err) {
    showToast("Could not load event.");
  }
}

function closeEventDetail() {
  document.getElementById("eventDetailModal").classList.remove("open");
  document.body.style.overflow = "";
}

// ── RESPOND TO EVENT ──
async function respondToEvent(id, status) {
  try {
    const res = await fetch(`${API_EVENTS}/${id}/respond`, {
      method: "PUT",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.msg || "Error"); return; }

    showToast(status === "accepted" ? "You're going! 🎉" : "RSVP declined");
    loadEvents();
  } catch {
    showToast("Could not reach server.");
  }
}

// ── DELETE EVENT ──
async function deleteEvent(id) {
  if (!confirm("Delete this event?")) return;
  try {
    const res = await fetch(`${API_EVENTS}/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (res.ok) {
      showToast("Event deleted 🗑️");
      const el = document.getElementById("event-" + id);
      if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }
    }
  } catch {
    showToast("Could not reach server.");
  }
}

// ── CREATE EVENT MODAL ──
function openCreateEventModal() {
  drinkTags = [];
  selectedInvitees = [];
  document.getElementById("eventTitle").value = "";
  document.getElementById("eventDesc").value = "";
  document.getElementById("eventLocation").value = "";
  document.getElementById("eventDate").value = "";
  document.getElementById("drinkTagsList").innerHTML = "";
  document.getElementById("inviteesList").innerHTML = "";
  document.getElementById("inviteeSearchResults").innerHTML = "";
  document.getElementById("inviteeSearch").value = "";

  // Set min date to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById("eventDate").min = now.toISOString().slice(0, 16);

  document.getElementById("createEventModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCreateEventModal() {
  document.getElementById("createEventModal").classList.remove("open");
  document.body.style.overflow = "";
}

// ── DRINK TAGS ──
function addDrinkTag(tag) {
  if (!tag || drinkTags.includes(tag)) return;
  drinkTags.push(tag);
  renderDrinkTags();
}
function removeDrinkTag(tag) {
  drinkTags = drinkTags.filter(t => t !== tag);
  renderDrinkTags();
}
function renderDrinkTags() {
  const el = document.getElementById("drinkTagsList");
  if (!el) return;
  el.innerHTML = drinkTags.map(t => `
    <span class="tag-chip">${t} <button onclick="removeDrinkTag('${t}')">✕</button></span>
  `).join("");
}

// ── INVITEE SEARCH ──
let inviteeSearchTimeout;
async function searchInvitees(query) {
  clearTimeout(inviteeSearchTimeout);
  const results = document.getElementById("inviteeSearchResults");
  if (!query.trim()) { results.innerHTML = ""; return; }

  inviteeSearchTimeout = setTimeout(async () => {
    try {
      const res = await fetch(`${API_USERS}/all`, { headers: authHeaders() });
      const users = await res.json();
      const me = getCurrentUser();

      const filtered = users.filter(u =>
        u.username.toLowerCase().includes(query.toLowerCase()) &&
        u._id !== me?.userId &&
        !selectedInvitees.find(i => i._id === u._id)
      );

      results.innerHTML = "";
      filtered.slice(0, 5).forEach(user => {
        const item = document.createElement("div");
        item.className = "user-search-item";
        item.innerHTML = `
          <img src="${user.avatarUrl || `https://i.pravatar.cc/36?u=${encodeURIComponent(user.username)}`}" alt="${escapeHtml(user.username)}"/>
          <div><strong>${escapeHtml(user.username)}</strong><small>${escapeHtml(user.headline || "DrinkedIn Member")}</small></div>
          <button class="btn-follow" onclick="addInvitee('${user._id}', '${encodeURIComponent(user.username)}', '${user.avatarUrl || ''}')">+ Invite</button>
        `;
        results.appendChild(item);
      });

      if (!filtered.length) results.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:8px">No users found</p>`;
    } catch { }
  }, 400);
}

function addInvitee(id, username, avatarUrl) {
  const decodedUsername = decodeURIComponent(username);
  if (selectedInvitees.find(i => i._id === id)) return;

  selectedInvitees.push({ _id: id, username: decodedUsername, avatarUrl: avatarUrl || null });
  renderInvitees();

  document.getElementById("inviteeSearch").value = "";
  document.getElementById("inviteeSearchResults").innerHTML = "";
}

function removeInvitee(id) {
  selectedInvitees = selectedInvitees.filter(i => i._id !== id);
  renderInvitees();
}

function renderInvitees() {
  const el = document.getElementById("inviteesList");
  if (!el) return;
  el.innerHTML = selectedInvitees.map(i => `
    <div class="selected-invitee">
      <img src="${i.avatarUrl || `https://i.pravatar.cc/28?u=${encodeURIComponent(i.username)}`}" alt="${escapeHtml(i.username)}"/>
      <span>${escapeHtml(i.username)}</span>
      <button onclick="removeInvitee('${i._id}')">✕</button>
    </div>
  `).join("");
}

// ── CREATE EVENT ──
async function submitNewEvent() {
  const title = document.getElementById("eventTitle")?.value.trim();
  const desc = document.getElementById("eventDesc")?.value.trim();
  const location = document.getElementById("eventLocation")?.value.trim();
  const date = document.getElementById("eventDate")?.value;
  const isPublic = document.getElementById("eventPublic")?.checked;

  if (!title) { showToast("Event title is required"); return; }
  if (!location) { showToast("Location is required"); return; }
  if (!date) { showToast("Date & time is required"); return; }

  const btn = document.getElementById("createEventBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

  try {
    const res = await fetch(API_EVENTS, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description: desc, location, date,
        drinks: drinkTags,
        inviteeIds: selectedInvitees.map(i => i._id),
        isPublic
      })
    });
    const data = await res.json();

    if (!res.ok) { showToast(data.msg || "Error creating event"); return; }

    showToast(`Event created! ${selectedInvitees.length} invitation${selectedInvitees.length !== 1 ? "s" : ""} sent 🎉`);
    closeCreateEventModal();
    loadEvents();
  } catch {
    showToast("Could not reach server.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Send Invitations 🎉"; }
  }
}

// ── TABS ──
function switchEventsTab(name, btn) {
  document.querySelectorAll(".events-tab").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".events-tab-content").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  const el = document.getElementById("tab-" + name);
  if (el) el.classList.add("active");
}

// ── SOCKET ──
function initSocket() {
  const me = getCurrentUser();
  if (!me) return;

  const socket = io(BASE_URL);
  socket.emit("user_online", me.userId);

  socket.on("event_notification", ({ receiverId, senderUsername, eventTitle }) => {
    if (receiverId === me.userId) {
      showToast(`🎉 ${senderUsername} invited you to "${eventTitle}"!`);
      loadEvents();
    }
  });

  socket.on("event_response", ({ receiverId, senderUsername, status, eventTitle }) => {
    if (receiverId === me.userId) {
      showToast(`${senderUsername} ${status === "accepted" ? "accepted ✅" : "declined ❌"} "${eventTitle}"`);
      loadEvents();
    }
  });
}

// ── NAV AVATAR ──
async function loadNavAvatar() {
  try {
    const res = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const user = await res.json();
    if (user.avatarUrl) {
      document.querySelectorAll(".nav-avatar").forEach(img => img.src = user.avatarUrl);
    }
  } catch { }
}

// ── NAVBAR SCROLL ──
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (nav) nav.style.boxShadow = window.scrollY > 8 ? "0 4px 28px rgba(0,0,0,0.55)" : "none";
}, { passive: true });

// ── INIT ──
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadNavAvatar();
  initSocket();
  loadEvents();

  // Drink tag input
  const drinkInput = document.getElementById("drinkTagInput");
  if (drinkInput) {
    drinkInput.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); addDrinkTag(drinkInput.value.trim()); drinkInput.value = ""; }
    });
  }
});