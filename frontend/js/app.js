// ===== GUARD: redirect if not logged in =====
if (!localStorage.getItem("token")) {
  window.location.href = "login.html";
}

const API_POSTS = `${BASE_URL}/api/posts`;
const API_USERS = `${BASE_URL}/api/users`;

// ===== HELPERS =====
function getToken() { return localStorage.getItem("token"); }

function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch { return null; }
}

function escapeHtml(text = "") {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + getToken()
  };
}


function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove("show"), 2600);
}
// ── TIME AGO ──
function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
  if (diff < 2592000) return Math.floor(diff / 604800) + "w ago";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── THEME TOGGLE ──
function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.getElementById("themeToggle");
  const isLight = document.body.classList.contains("light-mode");
  if (btn) btn.textContent = isLight ? "🌙" : "☀️";
}

function loadTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    document.body.classList.add("light-mode");
  }
  updateThemeIcon();
}

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function goToProfile() {
  window.location.href = "profile.html";
}

// ===== SHOW USERNAME IN SIDEBAR =====
function showCurrentUser() {
  const u = getCurrentUser();
  if (!u) return;
  const el = document.getElementById("sidebarUsername");
  if (el) el.innerText = u.username;
}

async function loadNavUser() {
  try {
    const res = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const user = await res.json();
    if (!res.ok) return;

    // Store globally
    window.currentUserAvatar = user.avatarUrl || null;

    // Update all username elements
    document.querySelectorAll(".current-username").forEach(el => {
      el.textContent = user.username;
    });

    // Update ALL avatar images on the page
    if (user.avatarUrl) {
      document.querySelectorAll(
        ".nav-avatar, .create-avatar, .sidebar-avatar, .profile-avatar-lg"
      ).forEach(img => {
        img.src = user.avatarUrl;
      });
    }
  } catch (err) {
    console.error("loadNavUser error:", err);
  }
}

// ===== HERO CLOSE =====
function closeHero() {
  const h = document.getElementById("heroBanner");
  if (h) {
    h.style.transition = "opacity 0.4s";
    h.style.opacity = "0";
    setTimeout(() => h.style.display = "none", 400);
  }
}

// ===== LOAD POSTS =====
async function loadPosts() {
  try {
    const res = await fetch(API_POSTS);
    const data = await res.json();
    renderPosts(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Error loading posts:", err);
    showToast("Could not load posts. Is the backend running?");
  }
}

// ===== RENDER POSTS =====
async function renderPosts(posts) {
  const container = document.getElementById("postsContainer");
  if (!container) return;

  container.innerHTML = "";
  const me = getCurrentUser();
   let savedIds = [];
  try {
    const savedRes  = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const savedData = await savedRes.json();
    savedIds = savedData.savedPosts || [];
  } catch {}

  posts.forEach((post, i) => {
    const isOwner = me && me.userId === post.userId;
    const hasUpvoted = me && (post.upvotedBy || []).includes(me.userId);


    const commentsHTML = (post.comments || []).slice(0, 3).map(c => `
  <div class="comment-item" id="comment-${c._id}">
    <img src="${currentUserAvatar || `https://i.pravatar.cc/32?u=me`}" alt="me"/>
    <div class="comment-bubble">
      <strong>${escapeHtml(c.username)}</strong>
      <p>${escapeHtml(c.text)}</p>
      <small class="comment-time">${timeAgo(c.createdAt)}</small>
    </div>
    ${me && me.userId === c.userId ? `
      <button class="del-comment-btn" onclick="deleteComment('${post._id}', '${c._id}', this)" title="Delete">🗑️</button>
    ` : ""}
  </div>
`).join("");

   const ownerBtns = isOwner ? `
  <button class="action-btn owner-btn edit-post-btn"
    data-id="${post._id}"
    data-story="${encodeURIComponent(post.story || '')}"
    data-image="${encodeURIComponent(post.imageUrl || '')}"
    data-tags="${encodeURIComponent(JSON.stringify(post.tags || []))}"
    title="Edit">✏️ Edit</button>
  <button class="action-btn owner-btn del-btn" onclick="deletePost('${post._id}')" title="Delete">🗑️ Delete</button>
` : "";


    // ── IMAGE ──
    const imageHTML = post.imageUrl ? `
      <div class="post-image-wrap">
        <img src="${post.imageUrl}" class="post-image" alt="post image" loading="lazy"
             onclick="openLightbox('${post.imageUrl}')"/>
      </div>` : "";

    // ── TAGS ──
    const tagsHTML = (post.tags && post.tags.length) ? `
      <div class="post-tags-row">
        ${post.tags.map(t => `<span class="post-tag">#${t}</span>`).join("")}
      </div>` : "";

    const el = document.createElement("div");
    el.className = "post-card";
    el.id = "post-" + post._id;
    el.style.animationDelay = (i * 0.06) + "s";

    el.innerHTML = `
      <div class="post-header">
<img src="${post.avatarUrl || `https://i.pravatar.cc/46?u=${encodeURIComponent(post.username)}`}" class="post-avatar" alt="${escapeHtml(post.username)}"/>
        <div class="post-meta">
          <strong>${escapeHtml(post.username)}</strong>
          <small>${timeAgo(post.createdAt)}</small>
        </div>
        <div class="post-header-actions">${ownerBtns}</div>
      </div>

      <div class="post-body">
        <p>${escapeHtml(post.story)}</p>
      </div>

      ${imageHTML}

      ${tagsHTML}

      <div class="post-actions">
        <button class="action-btn ${hasUpvoted ? "cheered" : ""}" id="upvote-btn-${post._id}"
                onclick="upvotePost('${post._id}', this)">
          🥂 <span id="upvote-count-${post._id}">${post.upvotes || 0}</span> Cheers
        </button>
        <button class="action-btn" onclick="toggleComments('${post._id}')">
          💬 ${(post.comments || []).length} Comments
        </button>
        <button class="action-btn" onclick="showToast('Repoured! 🔄')">🔄 Repour</button>
        <button class="action-btn save-btn ${(me && savedIds.includes(post._id)) ? 'saved' : ''}"
        id="save-btn-${post._id}"
        onclick="savePost('${post._id}', this)">
  ${(me && savedIds.includes(post._id)) ? '🔖 Saved' : '🔖 Save'}
</button>
      </div>

      <div class="comment-section" id="comments-${post._id}">
        <div class="comment-input-row">
          <img src="${window.currentUserAvatar || `https://i.pravatar.cc/32?u=${encodeURIComponent(me ? me.username : 'guest')}`}" alt="me"/>
          <input type="text" id="comment-input-${post._id}" placeholder="Add a comment…"
                 onkeydown="if(event.key==='Enter') addComment('${post._id}')"/>
          <button class="comment-send-btn" onclick="addComment('${post._id}')">↑</button>
        </div>
        <div id="comment-list-${post._id}">${commentsHTML}</div>
      </div>
    `;

    container.appendChild(el);
  });
}

// ===== TOGGLE COMMENTS =====
function toggleComments(id) {
  const s = document.getElementById("comments-" + id);
  if (!s) return;
  s.classList.toggle("open");
  if (s.classList.contains("open")) {
    const inp = document.getElementById("comment-input-" + id);
    if (inp) inp.focus();
  }
}

// ===== CREATE POST =====
async function createPost() {
  const storyInput = document.getElementById("postInput");
  const story = storyInput?.value.trim();

  if (!story) { showToast("Write something first! ✍️"); return; }

  const btn = document.getElementById("pourBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Pouring…"; }

  try {
    const formData = new FormData();
    formData.append("story", story);
    if (postTags.length) formData.append("tags", JSON.stringify(postTags));
    if (pendingImageFile) formData.append("image", pendingImageFile);

    const res = await fetch(`${BASE_URL}/api/posts`, {
      method: "POST",
      headers: { "Authorization": "Bearer " + getToken() },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) { showToast(data.msg || "Error creating post"); return; }

    storyInput.value = "";
    clearImagePreview();
    showToast("🍸 Your pour is live!");
    loadPosts();
  } catch (err) {
    console.error(err);
    showToast("Could not reach server.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Pour It 🍸"; }
  }
}

// ===== UPVOTE =====
async function upvotePost(id, btn) {
  try {
    const res = await fetch(`${API_POSTS}/${id}/upvote`, {
      method: "PUT",
      headers: authHeaders()
    });
    const data = await res.json();

    if (!res.ok) { showToast(data.msg || "Error"); return; }

    const countEl = document.getElementById("upvote-count-" + id);
    if (countEl) countEl.textContent = data.upvotes;

    const me = getCurrentUser();
    const cheered = me && (data.upvotedBy || []).includes(me.userId);
    btn.classList.toggle("cheered", cheered);
    showToast(cheered ? "🥂 Cheers sent!" : "Cheers removed");
  } catch (err) {
    showToast("Could not reach server.");
  }
}

// ===== ADD COMMENT =====
async function addComment(id) {
  const inp = document.getElementById("comment-input-" + id);
  const text = inp ? inp.value.trim() : "";
  if (!text) return;

  try {
    const res = await fetch(`${API_POSTS}/${id}/comment`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ text })
    });
    const data = await res.json();

    if (!res.ok) { showToast(data.msg || "Error"); return; }

    if (inp) inp.value = "";

    // Insert new comment into DOM without full reload
    const me = getCurrentUser();
    const list = document.getElementById("comment-list-" + id);
    if (list) {
      const item = document.createElement("div");
      item.className = "comment-item";
      item.style.animation = "fadeInUp 0.3s ease";
      item.innerHTML = `
        <img src="${window.currentUserAvatar || `https://i.pravatar.cc/28?u=me`}" alt="me"/>
        <div class="comment-bubble">
          <strong>${escapeHtml(me ? me.username : "You")}</strong>
          <p>${escapeHtml(text)}</p>
        </div>
      `;
      list.insertBefore(item, list.firstChild);
    }
    showToast("Comment posted! 💬");
  } catch (err) {
    showToast("Could not reach server.");
  }
}

// ── DELETE COMMENT ──
async function deleteComment(postId, commentId, btn) {
  if (!confirm("Delete this comment?")) return;
  try {
    const res = await fetch(`${API_POSTS}/${postId}/comment/${commentId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (res.ok) {
      const item = btn.closest(".comment-item");
      if (item) {
        item.style.opacity = "0";
        item.style.transition = "opacity 0.3s";
        setTimeout(() => item.remove(), 300);
      }
      showToast("Comment deleted 🗑️");
    } else {
      const d = await res.json();
      showToast(d.msg || "Error");
    }
  } catch {
    showToast("Could not reach server.");
  }
}
// ===== DELETE POST =====
async function deletePost(id) {
  if (!confirm("Delete this post?")) return;
  try {
    const res = await fetch(`${API_POSTS}/${id}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    if (res.ok) {
      showToast("Post deleted 🗑️");
      const el = document.getElementById("post-" + id);
      if (el) { el.style.opacity = "0"; setTimeout(() => el.remove(), 400); }
    } else {
      const d = await res.json();
      showToast(d.msg || "Error deleting");
    }
  } catch { showToast("Could not reach server."); }
}

// ── SAVE / UNSAVE POST ──
async function savePost(postId, btn) {
  try {
    const res  = await fetch(`${API_USERS}/save/${postId}`, {
      method:  "PUT",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.msg || "Error"); return; }

    const isSaved = data.saved;
    btn.textContent = isSaved ? "🔖 Saved" : "🔖 Save";
    btn.classList.toggle("saved", isSaved);
    showToast(isSaved ? "Saved to your cellar! 🔖" : "Removed from saved");
  } catch {
    showToast("Could not reach server.");
  }
}

// ===== EDIT POST =====
// ── EDIT POST MODAL ──
let editingPostId = null;
let editPostTags = [];
let editNewImage = null;

function openEditPostModal(postId, story, imageUrl, tags) {
  editingPostId = postId;
  editPostTags = tags ? [...tags] : [];
  editNewImage = null;

  // Fill story
  const storyEl = document.getElementById("editPostStory");
  if (storyEl) storyEl.value = story || "";

  // Show current image if exists
  const currentImgEl = document.getElementById("editCurrentImage");
  const removeRow = document.getElementById("editRemoveImgRow");
  if (currentImgEl) {
    if (imageUrl) {
      currentImgEl.innerHTML = `
        <label class="modal-label">Current Image</label>
        <div class="edit-current-img-wrap">
          <img src="${imageUrl}" alt="current"/>
        </div>`;
      if (removeRow) removeRow.style.display = "block";
    } else {
      currentImgEl.innerHTML = "";
      if (removeRow) removeRow.style.display = "none";
    }
  }

  // Clear new image preview
  const editPreview = document.getElementById("editImagePreview");
  if (editPreview) editPreview.innerHTML = "";
  const editImgInput = document.getElementById("editPostImage");
  if (editImgInput) editImgInput.value = "";
  const removeCheck = document.getElementById("removeImageCheck");
  if (removeCheck) removeCheck.checked = false;

  // Render tags
  renderEditTags();

  document.getElementById("editPostModal").classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeEditPostModal() {
  document.getElementById("editPostModal").classList.remove("open");
  document.body.style.overflow = "";
  editingPostId = null;
  editPostTags = [];
  editNewImage = null;
}

// ── EDIT TAGS ──
function addEditTag(tag) {
  tag = tag.trim().replace(/\s+/g, "");
  if (!tag || editPostTags.includes(tag)) return;
  editPostTags.push(tag);
  renderEditTags();
}

function removeEditTag(tag) {
  editPostTags = editPostTags.filter(t => t !== tag);
  renderEditTags();
}

function renderEditTags() {
  const el = document.getElementById("editTagsList");
  if (!el) return;
  el.innerHTML = editPostTags.map(t => `
    <span class="tag-chip">
      #${t} <button onclick="removeEditTag('${t}')">✕</button>
    </span>`).join("");
}

// ── EDIT IMAGE PREVIEW ──
function handleEditImagePreview(input) {
  const file = input.files[0];
  if (!file) return;
  editNewImage = file;

  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById("editImagePreview");
    if (preview) {
      preview.innerHTML = `
        <div class="img-preview-wrap" style="margin-top:8px">
          <img src="${e.target.result}" alt="new preview"/>
          <button class="remove-img-btn" onclick="clearEditImagePreview()">✕</button>
        </div>`;
    }
  };
  reader.readAsDataURL(file);
}

function clearEditImagePreview() {
  editNewImage = null;
  const preview = document.getElementById("editImagePreview");
  if (preview) preview.innerHTML = "";
  const input = document.getElementById("editPostImage");
  if (input) input.value = "";
}

// ── SAVE EDITED POST ──
async function saveEditedPost() {
  const story = document.getElementById("editPostStory")?.value.trim();
  if (!story) { showToast("Story can't be empty"); return; }

  const btn = document.getElementById("saveEditBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

  try {
    const formData = new FormData();
    formData.append("story", story);
    formData.append("tags", JSON.stringify(editPostTags));

    const removeCheck = document.getElementById("removeImageCheck");
    if (removeCheck?.checked) {
      formData.append("removeImage", "true");
    } else if (editNewImage) {
      formData.append("image", editNewImage);
    }

    const res = await fetch(`${API_POSTS}/${editingPostId}`, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + getToken() },
      body: formData
    });
    const data = await res.json();

    if (!res.ok) { showToast(data.msg || "Error saving"); return; }

    showToast("Post updated ✅");
    closeEditPostModal();
    loadPosts(); // refresh feed
  } catch (err) {
    console.error(err);
    showToast("Could not reach server.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Save Changes ✅"; }
  }
}

// ===== CREATE POST UI EXTRAS =====
let currentRating = 0;

function setRating(n) {
  currentRating = n;
  document.querySelectorAll("#ratingStars span").forEach((s, i) => {
    s.classList.toggle("lit", i < n);
  });
}

function addEmoji(emoji) {
  const inp = document.getElementById("postInput");
  if (!inp) return;
  inp.value += (inp.value.length ? " " : "") + emoji;
  inp.focus();
}


// ── FOLLOW / UNFOLLOW ──
async function followUser(btn, targetId) {
  try {
    const res  = await fetch(`${API_USERS}/follow/${targetId}`, {
      method:  "PUT",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.msg || "Error"); return; }

    const isFollowing = data.following;
    btn.textContent   = isFollowing ? "🍻 Following" : "+ Follow";
    btn.classList.toggle("following", isFollowing);
    showToast(isFollowing ? "Following! 🍻" : "Unfollowed");

    // Update follower/following counts if on profile page
    const followerEl  = document.getElementById("followerCount");
    const followingEl = document.getElementById("followingCount");
    if (followerEl)  followerEl.textContent  = data.followerCount;
    if (followingEl) followingEl.textContent = data.followingCount;
  } catch {
    showToast("Could not reach server.");
  }
}
// ── LOAD USER SUGGESTIONS ──
async function loadSuggestions() {
  try {
    const res   = await fetch(`${API_USERS}/all`, { headers: authHeaders() });
    const users = await res.json();
    if (!res.ok) return;

    // Get current user's following list
    const meRes  = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const meData = await meRes.json();
    const myFollowing = meData.following || [];

    const list = document.getElementById("suggestList");
    if (!list) return;

    list.innerHTML = "";

    users.slice(0, 5).forEach(user => {
      const isFollowing = myFollowing.includes(user._id.toString());
      const li = document.createElement("li");
      li.innerHTML = `
  <img src="${user.avatarUrl || `https://i.pravatar.cc/40?u=${encodeURIComponent(user.username)}`}"
       alt="${escapeHtml(user.username)}"/>
  <div>
    <strong>${escapeHtml(user.username)}</strong>
    <small>${escapeHtml(user.headline || "DrinkedIn Member")}</small>
  </div>
  <div style="display:flex;gap:6px;flex-shrink:0">
    <button class="btn-follow ${isFollowing ? 'following' : ''}"
            onclick="followUser(this, '${user._id}')">
      ${isFollowing ? '🍻 Following' : '+ Follow'}
    </button>
    <button class="btn-follow" onclick="window.location='messages.html?user=${user._id}&username=${encodeURIComponent(user.username)}'">💬</button>
  </div>
`;
      list.appendChild(li);
    });
  } catch (err) {
    console.error("Suggestions error:", err);
  }
}

// ===== NAVBAR SCROLL SHADOW =====
window.addEventListener("scroll", () => {
  const nav = document.getElementById("navbar");
  if (nav) nav.style.boxShadow = window.scrollY > 8 ? "0 4px 28px rgba(0,0,0,0.55)" : "none";
}, { passive: true });

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  loadTheme();
  showCurrentUser();
  loadPosts();
  loadSuggestions();
  loadNavUser();
  updateNotifBadge();

  const editTagInput = document.getElementById("editTagInput");
  if (editTagInput) {
    editTagInput.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addEditTag(editTagInput.value);
        editTagInput.value = "";
      }
    });
  }
  // ── SOCKET for feed notifications ──
  const me = getCurrentUser();
  if (me) {
    const feedSocket = io(BASE_URL);
    feedSocket.emit("user_online", me.userId);

    feedSocket.on("cheer_notification", ({ receiverId, senderUsername }) => {
      if (receiverId === me.userId) {
        showToast(`🥂 ${senderUsername} cheered your post!`);
      }
    });

    feedSocket.on("message_notification", ({ receiverId, senderUsername }) => {
      if (receiverId === me.userId) {
        showToast(`💬 New message from ${senderUsername}`);
      }
    });
  }
  // Update notification badge
  async function updateNotifBadge() {
    try {
      const res = await fetch(`${BASE_URL}/api/notifications/unread-count`,
        { headers: authHeaders() });
      const data = await res.json();
      const badge = document.getElementById("notifBadge");
      if (badge) {
        badge.textContent = data.count;
        badge.style.display = data.count > 0 ? "flex" : "none";
      }
    } catch { }
  }

  document.addEventListener("click", e => {
  const editBtn = e.target.closest(".edit-post-btn");
  if (editBtn) {
    openEditPostModal(
      editBtn.dataset.id,
      decodeURIComponent(editBtn.dataset.story),
      decodeURIComponent(editBtn.dataset.image),
      JSON.parse(decodeURIComponent(editBtn.dataset.tags))
    );
  }
});
});


// ── IMAGE MODAL ──
let pendingImageFile = null;
let postTags = [];

function openImageModal(input) {
  const file = input.files[0];
  if (!file) return;
  pendingImageFile = file;

  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById("modalPreviewImg").src = e.target.result;
    document.getElementById("imageModal").classList.add("open");
    document.body.style.overflow = "hidden";
  };
  reader.readAsDataURL(file);
}

function closeImageModal() {
  document.getElementById("imageModal").classList.remove("open");
  document.body.style.overflow = "";
  // Clear modal fields but keep pendingImageFile if already confirmed
}

function confirmImageModal() {
  const caption = document.getElementById("modalCaption").value.trim();

  // Append caption to main post input
  const postInput = document.getElementById("postInput");
  if (caption && postInput) {
    postInput.value = (postInput.value.trim() ? postInput.value.trim() + "\n\n" : "") + caption;
  }

  // Show preview in feed composer
  const preview = document.getElementById("imagePreview");
  if (preview && pendingImageFile) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = `
        <div class="img-preview-wrap">
          <img src="${e.target.result}" alt="preview"/>
          <div class="preview-tags-row" id="previewTagsRow"></div>
          <button class="remove-img-btn" onclick="clearImagePreview()" title="Remove">✕</button>
        </div>`;
      // Show tags on preview
      renderPreviewTags();
    };
    reader.readAsDataURL(pendingImageFile);
  }

  closeImageModal();
  showToast("Photo attached! Hit Pour It to post 🍸");
}

function addTag(tag) {
  tag = tag.trim().replace(/\s+/g, "");
  if (!tag || postTags.includes(tag)) return;
  postTags.push(tag);
  renderTagsList();
  renderPreviewTags();
}

function removeTag(tag) {
  postTags = postTags.filter(t => t !== tag);
  renderTagsList();
  renderPreviewTags();
}

function renderTagsList() {
  const el = document.getElementById("tagsList");
  if (!el) return;
  el.innerHTML = postTags.map(t => `
    <span class="tag-chip">
      #${t} <button onclick="removeTag('${t}')">✕</button>
    </span>`).join("");
}

function renderPreviewTags() {
  const el = document.getElementById("previewTagsRow");
  if (!el) return;
  el.innerHTML = postTags.map(t => `<span class="post-tag">#${t}</span>`).join("");
}

function clearImagePreview() {
  const preview = document.getElementById("imagePreview");
  if (preview) preview.innerHTML = "";
  const input = document.getElementById("postImageInput");
  if (input) input.value = "";
  pendingImageFile = null;
  postTags = [];
  const tagsList = document.getElementById("tagsList");
  if (tagsList) tagsList.innerHTML = "";
  const modalCaption = document.getElementById("modalCaption");
  if (modalCaption) modalCaption.value = "";
}