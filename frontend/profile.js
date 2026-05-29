const API_URL   = `${BASE_URL}/api/posts`;
const API_POSTS = `${BASE_URL}/api/posts`;
const API_USERS = `${BASE_URL}/api/users`;

if (!localStorage.getItem("token")) window.location.href = "login.html";

function getToken() { return localStorage.getItem("token"); }
function authHeaders() { return { "Authorization": "Bearer " + getToken() }; }

function triggerAvatarUpload() {
  openAvatarModal();
}

//   before DOMContentLoaded
async function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    document.querySelectorAll(".profile-avatar-xl, .nav-avatar,.sidebar-avatar, #editAvatarPreview")
      .forEach(img => img.src = e.target.result);
  };
  reader.readAsDataURL(file);

  showToast("Uploading… ☁️");

  try {
    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(`${BASE_URL}/api/users/avatar`, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + getToken() },
      body: formData
    });

    const data = await res.json();

    if (res.ok) {
      document.querySelectorAll(".profile-avatar-xl, .nav-avatar,.sidebar-avatar, #editAvatarPreview")
        .forEach(img => img.src = data.avatarUrl);
      showToast("Profile picture updated! 🎉");
    } else {
      showToast(data.msg || "Upload failed");
    }
  } catch (err) {
    console.error(err);
    showToast("Could not reach server.");
  }

  input.value = "";
}

// ... rest of your functions below
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
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return Math.floor(diff / 60) + "m ago";
  if (diff < 86400)  return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  if (diff < 2592000) return Math.floor(diff / 604800) + "w ago";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn     = document.getElementById("themeToggle");
  const isLight = document.body.classList.contains("light-mode");
  if (btn) btn.textContent = isLight ? "🌙" : "☀️";
}

function loadTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") document.body.classList.add("light-mode");
  updateThemeIcon();
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}
// ── AVATAR PICKER STATE ──
let selectedDefaultAvatar = null; // 'male' or 'female'
let selectedCustomFile    = null;

const DEFAULT_AVATARS = {
  male:   "https://i.pinimg.com/736x/8e/40/f8/8e40f83a0f6b6f2e66803af56507b05d.jpg",
  female: "https://i.pinimg.com/736x/72/4b/a5/724ba58551a3e4c577110ab10395508d.jpg"
};

function openAvatarModal() {
  selectedDefaultAvatar = null;
  selectedCustomFile    = null;

  // Clear state
  document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
  const preview = document.getElementById("avatarUploadPreview");
  if (preview) preview.innerHTML = "";
  const fileInput = document.getElementById("avatarModalInput");
  if (fileInput) fileInput.value = "";

  document.getElementById("avatarPickerModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeAvatarModal() {
  document.getElementById("avatarPickerModal").classList.remove("open");
  document.body.style.overflow = "";
}

function selectDefaultAvatar(type, el) {
  selectedDefaultAvatar = type;
  selectedCustomFile    = null;

  // Clear file preview
  const preview = document.getElementById("avatarUploadPreview");
  if (preview) preview.innerHTML = "";
  const fileInput = document.getElementById("avatarModalInput");
  if (fileInput) fileInput.value = "";

  // Highlight selected
  document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");

  // Show preview on profile instantly
  const url = DEFAULT_AVATARS[type];
  document.querySelectorAll(".profile-avatar-xl, .nav-avatar, .sidebar-avatar, #editAvatarPreview, #mainAvatar")
    .forEach(img => img.src = url);
}

function handleAvatarUploadFromModal(input) {
  const file = input.files[0];
  if (!file) return;

  selectedCustomFile    = file;
  selectedDefaultAvatar = null;

  // Clear default selection
  document.querySelectorAll(".avatar-option").forEach(o => o.classList.remove("selected"));

  // Show preview
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById("avatarUploadPreview");
    if (preview) {
      preview.innerHTML = `
        <div class="img-preview-wrap">
          <img src="${e.target.result}" alt="preview" style="max-height:120px"/>
        </div>`;
    }
    // Live preview on profile
    document.querySelectorAll(".profile-avatar-xl, .nav-avatar, .sidebar-avatar, #editAvatarPreview, #mainAvatar")
      .forEach(img => img.src = e.target.result);
  };
  reader.readAsDataURL(file);
}

async function saveSelectedAvatar() {
  const btn = document.getElementById("saveAvatarBtn");

  if (!selectedDefaultAvatar && !selectedCustomFile) {
    showToast("Please select or upload an avatar first");
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  try {
    if (selectedCustomFile) {
      // ── Upload custom photo to Cloudinary ──
      const formData = new FormData();
      formData.append("avatar", selectedCustomFile);

      const res  = await fetch(`${API_USERS}/avatar`, {
        method:  "PUT",
        headers: { "Authorization": "Bearer " + getToken() },
        body:    formData
      });
      const data = await res.json();

      if (res.ok) {
        document.querySelectorAll(".profile-avatar-xl, .nav-avatar, .sidebar-avatar, #editAvatarPreview, #mainAvatar")
          .forEach(img => img.src = data.avatarUrl);
        showToast("Profile picture updated! 🎉");
        closeAvatarModal();
      } else {
        showToast(data.msg || "Upload failed");
      }

    } else if (selectedDefaultAvatar) {
      // ── Save default avatar URL directly ──
      const url = DEFAULT_AVATARS[selectedDefaultAvatar];

      const res  = await fetch(`${API_USERS}/avatar-url`, {
        method:  "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({ avatarUrl: url, avatarType: selectedDefaultAvatar })
      });
      const data = await res.json();

      if (res.ok) {
        document.querySelectorAll(".profile-avatar-xl, .nav-avatar, .sidebar-avatar, #editAvatarPreview, #mainAvatar")
          .forEach(img => img.src = url);
        showToast("Avatar updated! 🎉");
        closeAvatarModal();
      } else {
        showToast(data.msg || "Error saving avatar");
      }
    }
  } catch (err) {
    console.error(err);
    showToast("Could not reach server.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Avatar ✅"; }
  }
}

async function loadProfile() {
  try {
    const res = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const user = await res.json();
    if (!res.ok) return;

    // ── Update profile fields ──
    const nameEl = document.getElementById("username");
    const headlineEl = document.getElementById("profileHeadline");
    const locationEl = document.getElementById("profileLocation");
    const bioEl = document.getElementById("profileBio");

    if (nameEl) nameEl.textContent = user.username || "Unknown";
    if (headlineEl) headlineEl.textContent = user.headline || "🥃 Whiskey Aficionado · Cocktail Crafter";
    if (locationEl) locationEl.textContent = user.location ? "📍 " + user.location : "📍 Mathura, Uttar Pradesh";
    if (bioEl) bioEl.textContent = user.bio || "Passionate about the craft behind every glass.";

    // ── Update avatar if uploaded ──
    if (user.avatarUrl) {
      document.querySelectorAll(".profile-avatar-xl, .nav-avatar,.sidebar-avatar, #editAvatarPreview").forEach(img => {
        img.src = user.avatarUrl;
      });
    }

    // ── Update total pours count ──
    const totalEl = document.getElementById("totalPosts");

    // ── Fetch posts separately ──
    const postsRes = await fetch(`${API_POSTS}/my-posts`, { headers: authHeaders() });
    const postsData = await postsRes.json();
    if (!postsRes.ok) return;

    if (totalEl) totalEl.textContent = postsData.totalPosts ;
    renderMyPosts(postsData.posts || []);

    const followerEl  = document.getElementById("followerCount");
const followingEl = document.getElementById("followingCount");
if (followerEl)  followerEl.textContent  = user.followers?.length  || 0;
if (followingEl) followingEl.textContent = user.following?.length  || 0;

  } catch (err) {
    console.error(err);
    showToast("Could not load profile. Is the backend running?");
  }
}
function renderMyPosts(posts) {
  const container = document.getElementById("myPosts");
  if (!container) return;
  container.innerHTML = "";

  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🍸</span>
        <h3>No pours yet</h3>
        <p>Go to the feed and share your first drinking experience!</p>
        <a href="index.html" class="btn-primary">Go to Feed</a>
      </div>`;
    return;
  }

  posts.forEach((post, i) => {
    const el     = document.createElement("div");
    el.className = "post-card";
    el.style.animationDelay = (i * 0.06) + "s";

    // ── IMAGE ──
    const imageHTML = post.imageUrl ? `
      <div class="post-image-wrap">
        <img src="${post.imageUrl}"
             class="post-image"
             alt="post image"
             loading="lazy"
             onerror="this.parentElement.style.display='none'"
             onclick="openLightbox('${post.imageUrl}')"/>
      </div>` : "";

    // ── TAGS ──
    const tagsHTML = (post.tags && post.tags.length) ? `
      <div class="post-tags-row">
        ${post.tags.map(t => `<span class="post-tag">#${escapeHtml(t)}</span>`).join("")}
      </div>` : "";

    el.innerHTML = `
      <div class="post-header">
        <img src="${post.avatarUrl || `https://i.pravatar.cc/46?u=${encodeURIComponent(post.username)}`}"
             class="post-avatar" alt="${escapeHtml(post.username)}"/>
        <div class="post-meta">
          <strong>${escapeHtml(post.username)}</strong>
          <small>${timeAgo(post.createdAt)}</small>
        </div>
      </div>
      <div class="post-body">
        <p>${escapeHtml(post.story)}</p>
      </div>
      ${imageHTML}
      ${tagsHTML}
      <div class="post-actions">
        <span class="action-btn">🥂 ${post.upvotes || 0} Cheers</span>
        <span class="action-btn">💬 ${(post.comments || []).length} Comments</span>
        <button class="action-btn owner-btn" onclick="editMyPost('${post._id}', this)">✏️ Edit</button>
        <button class="action-btn owner-btn del-btn" onclick="deleteMyPost('${post._id}')">🗑️ Delete</button>
      </div>
    `;

    container.appendChild(el);
  });
}

function openLightbox(url) {
  let lb = document.getElementById("lightbox");
  if (!lb) {
    lb = document.createElement("div");
    lb.id = "lightbox";
    lb.className = "lightbox";
    lb.innerHTML = `
      <div class="lightbox-inner">
        <button class="lb-close" onclick="closeLightbox()">✕</button>
        <img id="lb-img" src="" alt=""/>
      </div>`;
    lb.addEventListener("click", e => { if (e.target === lb) closeLightbox(); });
    document.body.appendChild(lb);
  }
  document.getElementById("lb-img").src = url;
  lb.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (lb) lb.classList.remove("open");
  document.body.style.overflow = "";
}

async function deleteMyPost(id) {
  if (!confirm("Delete this post?")) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
      headers: { "Authorization": "Bearer " + getToken() }
    });
    if (res.ok) { showToast("Deleted 🗑️"); loadProfile(); }
    else { const d = await res.json(); showToast(d.msg || "Error"); }
  } catch { showToast("Server error."); }
}

async function editMyPost(id, btn) {
  const p = btn.closest(".post-card")?.querySelector(".post-body p");
  const old = p ? p.textContent : "";
  const newText = prompt("Edit your post:", old);
  if (!newText || newText.trim() === old) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
      body: JSON.stringify({ story: newText.trim() })
    });
    if (res.ok) { if (p) p.textContent = newText.trim(); showToast("Updated ✅"); }
    else { const d = await res.json(); showToast(d.msg || "Error"); }
  } catch { showToast("Server error."); }
}

// ── OPEN / CLOSE EDIT MODAL ──
function openEditModal() {
  // Pre-fill fields with current values from the page
  const nameEl = document.getElementById("username");
  const headlineEl = document.getElementById("profileHeadline");
  const locationEl = document.getElementById("profileLocation");
  const bioEl = document.getElementById("profileBio");

  const editUsername = document.getElementById("editUsername");
  const editHeadline = document.getElementById("editHeadline");
  const editLocation = document.getElementById("editLocation");
  const editBio = document.getElementById("editBio");

  if (editUsername && nameEl) editUsername.value = nameEl.textContent.trim();
  if (editHeadline && headlineEl) editHeadline.value = headlineEl.textContent.trim();
  if (editLocation && locationEl) editLocation.value = locationEl.textContent.replace("📍", "").trim();
  if (editBio && bioEl) editBio.value = bioEl.textContent.trim();

  // Sync avatar preview inside modal
  const mainAvatar = document.querySelector(".profile-avatar-xl");
  const editPreview = document.getElementById("editAvatarPreview");
  if (mainAvatar && editPreview) editPreview.src = mainAvatar.src;

  document.getElementById("editProfileModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  document.getElementById("editProfileModal").classList.remove("open");
  document.body.style.overflow = "";
}

// ── SAVE PROFILE ──
async function saveProfile() {
  const username = document.getElementById("editUsername")?.value.trim();
  const headline = document.getElementById("editHeadline")?.value.trim();
  const location = document.getElementById("editLocation")?.value.trim();
  const bio = document.getElementById("editBio")?.value.trim();


  if (!username) { showToast("Username can't be empty"); return; }

  try {
    const res = await fetch(`${BASE_URL}/api/users/update-profile`, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + getToken(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, headline, location, bio })
    });
    const data = await res.json();
    if(data.token) localStorage.setItem("token", data.token); // Update token if username changed

    if (!res.ok) { showToast(data.msg || "Error saving"); return; }

    // Update page instantly without reload
    const nameEl = document.getElementById("username");
    const headlineEl = document.getElementById("profileHeadline");
    const locationEl = document.getElementById("profileLocation");
    const bioEl = document.getElementById("profileBio");

    if (nameEl) nameEl.textContent = username;
    if (headlineEl) headlineEl.textContent = headline;
    if (locationEl) locationEl.textContent = "📍 " + location;
    if (bioEl) bioEl.textContent = bio;

    // Add after: if (nameEl) nameEl.textContent = user.username || "Unknown";
    const followerEl = document.getElementById("followerCount");
    const followingEl = document.getElementById("followingCount");
    if (followerEl) followerEl.textContent = user.followers?.length || 0;
    if (followingEl) followingEl.textContent = user.following?.length || 0;

    // Update nav avatar username too
    document.querySelectorAll(".current-username").forEach(el => el.textContent = username);

    showToast("Profile updated! ✅");
    closeEditModal();
    if (username) {
      showToast("Profile updated! Re-login to see username changes in posts/comments. ✅");
    }

  } catch { showToast("Could not reach server."); }
}



document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  loadProfile();


  // 👇 attach here instead of inline HTML
  const avatarInput = document.getElementById("avatarInput");
  if (avatarInput) {
    avatarInput.addEventListener("change", function () {
      handleAvatarUpload(this);
    });
  }
});

// ── FOLLOWERS / FOLLOWING MODAL ──
async function openFollowModal(type) {
  const title = document.getElementById("followModalTitle");
  const list = document.getElementById("followModalList");
  if (!title || !list) return;

  title.textContent = type === "followers" ? "Followers" : "Following";
  list.innerHTML = "<p style='color:var(--text-muted);font-size:13px'>Loading…</p>";

  document.getElementById("followModal").classList.add("open");
  document.body.style.overflow = "hidden";

  try {
    const res = await fetch(`${API_USERS}/${type}`, { headers: authHeaders() });
    const users = await res.json();

    if (!res.ok || !users.length) {
      list.innerHTML = `<p style='color:var(--text-muted);font-size:13px;text-align:center'>
        No ${type} yet 🍸</p>`;
      return;
    }

    list.innerHTML = "";
    users.forEach(user => {
      const item = document.createElement("div");
      item.className = "follow-user-item";
      item.innerHTML = `
        <img src="${user.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(user.username)}`}"
             alt="${escapeHtml(user.username)}"/>
        <div>
          <strong>${escapeHtml(user.username)}</strong>
          <small>${escapeHtml(user.headline || "DrinkedIn Member")}</small>
        </div>
      `;
      list.appendChild(item);
    });
  } catch {
    list.innerHTML = "<p style='color:var(--text-muted)'>Could not load list.</p>";
  }
}

function shareProfile() {
  const me  = getCurrentUser();
  const url = `${window.location.origin}/profile.html?user=${me?.userId}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      showToast("Profile link copied! 🔗");
    }).catch(() => {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity  = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  showToast("Profile link copied! 🔗");
}

function closeFollowModal() {
  document.getElementById("followModal").classList.remove("open");
  document.body.style.overflow = "";
}

async function loadSavedPosts() {
  try {
    const res   = await fetch(`${API_USERS}/saved-posts`, { headers: authHeaders() });
    const posts = await res.json();
    if (!res.ok) return;

    const container = document.getElementById("tab-saved");
    if (!container) return;

    if (!posts.length) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔖</span>
          <h3>No saved pours yet</h3>
          <p>Bookmark posts from your feed to revisit them later.</p>
          <a href="index.html" class="btn-primary">Browse Feed</a>
        </div>`;
      return;
    }

    container.innerHTML = "";
    posts.forEach(post => {
      const imageHTML = post.imageUrl ? `
        <div class="post-image-wrap">
          <img src="${post.imageUrl}" class="post-image" alt="post" loading="lazy"/>
        </div>` : "";

      const tagsHTML = (post.tags || []).map(t =>
        `<span class="post-tag">#${t}</span>`
      ).join("");

      const el     = document.createElement("div");
      el.className = "post-card";
      el.innerHTML = `
        <div class="post-header">
          <img src="${post.avatarUrl || `https://i.pravatar.cc/46?u=${encodeURIComponent(post.username)}`}"
               class="post-avatar" alt="${escapeHtml(post.username)}"/>
          <div class="post-meta">
            <strong>${escapeHtml(post.username)}</strong>
            <small>${timeAgo(post.createdAt)}</small>
          </div>
        </div>
        <div class="post-body"><p>${escapeHtml(post.story)}</p></div>
        ${imageHTML}
        ${tagsHTML ? `<div class="post-tags-row">${tagsHTML}</div>` : ""}
        <div class="post-actions">
          <span class="action-btn">🥂 ${post.upvotes || 0} Cheers</span>
          <span class="action-btn">💬 ${(post.comments || []).length} Comments</span>
          <button class="action-btn del-btn" onclick="unsavePost('${post._id}', this)">🔖 Unsave</button>
        </div>
      `;
      container.appendChild(el);
    });
  } catch (err) {
    console.error(err);
  }
}

async function unsavePost(postId, btn) {
  try {
    const res = await fetch(`${API_USERS}/save/${postId}`, {
      method:  "PUT",
      headers: authHeaders()
    });
    if (res.ok) {
      showToast("Removed from saved");
      loadSavedPosts();
    }
  } catch {
    showToast("Could not reach server.");
  }
}