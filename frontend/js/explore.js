const API_POSTS = `${BASE_URL}/api/posts`;
const API_USERS = `${BASE_URL}/api/users`;

if (!localStorage.getItem("token")) window.location.href = "login.html";

function getToken() { return localStorage.getItem("token"); }
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
function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
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
    const res = await fetch(`${API_USERS}/me`, { headers: authHeaders() });
    const user = await res.json();
    if (!res.ok) return;
    if (user.avatarUrl) {
      document.querySelectorAll(".nav-avatar").forEach(img => img.src = user.avatarUrl);
    }
  } catch { }
}
// session checker
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
// ── STATE ──
let allPosts = [];
let currentCategory = "all";
let currentSearch = "";
let currentSort = "newest";
const PAGE_SIZE = 12;
let currentPage = 1;

// ── LOAD EXPLORE POSTS ──
async function loadExplorePosts() {
  try {
    const params = new URLSearchParams();
    if (currentCategory !== "all") params.set("category", currentCategory);
    if (currentSearch) params.set("search", currentSearch);

    const res = await fetch(`${API_POSTS}/explore?${params}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;

    allPosts = data;
    currentPage = 1;
    renderExplorePosts();
    updateFilterLabel();
  } catch (err) {
    console.error("Explore error:", err);
    showToast("Could not load posts.");
  }
}

// ── RENDER POSTS ──
function renderExplorePosts() {
  const container = document.getElementById("explorePostsContainer");
  const emptyEl = document.getElementById("exploreEmpty");
  const loadMore = document.getElementById("loadMoreWrap");
  if (!container) return;

  // Sort
  let sorted = [...allPosts];
  if (currentSort === "popular") {
    sorted.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
  }

  // Paginate
  const paginated = sorted.slice(0, currentPage * PAGE_SIZE);

  container.innerHTML = "";

  if (!paginated.length) {
    emptyEl.style.display = "flex";
    loadMore.style.display = "none";
    return;
  }

  emptyEl.style.display = "none";

  paginated.forEach((post, i) => {
    const card = buildExploreCard(post, i);
    container.appendChild(card);
  });

  // Show load more if more posts exist
  loadMore.style.display = sorted.length > currentPage * PAGE_SIZE ? "flex" : "none";
}

// ── BUILD EXPLORE CARD ──
function buildExploreCard(post, i) {
  const card = document.createElement("div");
  card.className = "explore-card";
  card.style.animationDelay = (i * 0.04) + "s";

  const tagsHTML = (post.tags || []).slice(0, 3).map(t =>
    `<span class="post-tag" onclick="filterByTag('${t}')">#${t}</span>`
  ).join("");

  const imageHTML = post.imageUrl ? `
    <div class="explore-card-img" onclick="openLightbox('${post.imageUrl}')">
      <img src="${post.imageUrl}" alt="post" loading="lazy"/>
      <div class="explore-img-overlay">🔍 View</div>
    </div>` : "";

  card.innerHTML = `
    ${imageHTML}
    <div class="explore-card-body">
      <div class="explore-card-header">
        <img src="${post.avatarUrl || `https://i.pravatar.cc/36?u=${encodeURIComponent(post.username)}`}"
             alt="${escapeHtml(post.username)}" class="explore-avatar"/>
        <div>
          <strong>${escapeHtml(post.username)}</strong>
          <small>${timeAgo(post.createdAt)}</small>
        </div>
      </div>
      <p class="explore-card-story">${escapeHtml(post.story)}</p>
      ${tagsHTML ? `<div class="explore-card-tags">${tagsHTML}</div>` : ""}
      <div class="explore-card-footer">
        <span>🥂 ${post.upvotes || 0}</span>
        <span>💬 ${(post.comments || []).length}</span>
      </div>
    </div>
  `;

  return card;
}

// ── LIGHTBOX ──
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

// ── FILTER BY CATEGORY ──
function filterCategory(category, btn) {
  currentCategory = category;
  currentSearch = "";
  currentPage = 1;

  // Update active button
  document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");

  // Clear search inputs
  const gs = document.getElementById("globalSearch");
  const es = document.getElementById("exploreSearch");
  if (gs) gs.value = "";
  if (es) es.value = "";

  // Show/hide clear button
  const clearBtn = document.getElementById("clearFilterBtn");
  if (clearBtn) clearBtn.style.display = category !== "all" ? "inline-flex" : "none";

  loadExplorePosts();
}

// ── FILTER BY TAG ──
function filterByTag(tag) {
  currentSearch = tag;
  currentCategory = "all";
  currentPage = 1;

  const es = document.getElementById("exploreSearch");
  const gs = document.getElementById("globalSearch");
  if (es) es.value = tag;
  if (gs) gs.value = tag;

  document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(".category-btn")?.classList.add("active");

  const clearBtn = document.getElementById("clearFilterBtn");
  if (clearBtn) clearBtn.style.display = "inline-flex";

  loadExplorePosts();
}

// ── SEARCH ──
let searchTimeout;
function handleSearch(value) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearch = value.trim();
    currentCategory = "all";
    currentPage = 1;

    document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(".category-btn")?.classList.add("active");

    const clearBtn = document.getElementById("clearFilterBtn");
    if (clearBtn) clearBtn.style.display = currentSearch ? "inline-flex" : "none";

    loadExplorePosts();
  }, 400);
}

// ── CLEAR FILTER ──
function clearFilter() {
  currentCategory = "all";
  currentSearch = "";
  currentPage = 1;

  const es = document.getElementById("exploreSearch");
  const gs = document.getElementById("globalSearch");
  if (es) es.value = "";
  if (gs) gs.value = "";

  document.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(".category-btn")?.classList.add("active");

  const clearBtn = document.getElementById("clearFilterBtn");
  if (clearBtn) clearBtn.style.display = "none";

  loadExplorePosts();
}

// ── SORT ──
function setSort(sort, btn) {
  currentSort = sort;
  currentPage = 1;
  document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderExplorePosts();
}

// ── LOAD MORE ──
function loadMore() {
  currentPage++;
  renderExplorePosts();
  // Smooth scroll to new posts
  setTimeout(() => {
    const container = document.getElementById("explorePostsContainer");
    if (container) container.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 200);
}

// ── UPDATE FILTER LABEL ──
function updateFilterLabel() {
  const label = document.getElementById("filterLabel");
  if (!label) return;

  if (currentSearch) label.textContent = `Results for: "${currentSearch}" (${allPosts.length})`;
  else if (currentCategory !== "all") label.textContent = `Category: ${currentCategory} (${allPosts.length})`;
  else label.textContent = `Showing: All Pours (${allPosts.length})`;
}

// ── LOAD TRENDING TAGS ──
async function loadTrendingTags() {
  try {
    const res = await fetch(`${API_POSTS}/trending-tags`, { headers: authHeaders() });
    const tags = await res.json();
    if (!res.ok) return;

    const el = document.getElementById("trendingTagsList");
    if (!el) return;

    if (!tags.length) {
      el.innerHTML = `<p style="color:var(--text-muted);font-size:13px">No tags yet</p>`;
      return;
    }

    el.innerHTML = tags.map(({ tag, count }) => `
      <div class="trending-tag-item" onclick="filterByTag('${tag}')">
        <span class="hashtag">#${escapeHtml(tag)}</span>
        <small>${count} pour${count > 1 ? "s" : ""}</small>
      </div>
    `).join("");
  } catch (err) {
    console.error("Trending tags error:", err);
  }
}

// ── LOAD STATS ──
async function loadStats() {
  try {
    const postsRes = await fetch(`${API_POSTS}/explore`, { headers: authHeaders() });
    const posts = await postsRes.json();

    const usersRes = await fetch(`${API_USERS}/all`, { headers: authHeaders() });
    const users = await usersRes.json();

    const totalPostsEl = document.getElementById("totalPostsCount");
    const totalUsersEl = document.getElementById("totalUsersCount");

    if (totalPostsEl) totalPostsEl.textContent = posts.length || 0;
    if (totalUsersEl) totalUsersEl.textContent = (users.length || 0) + 1; // +1 for current user
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
  resetSessionTimer();
  checkSessionExpiry();
  loadNavAvatar();
  loadExplorePosts();
  loadTrendingTags();
  loadStats();
  // Auto-search if redirected from navbar search
  const urlParams = new URLSearchParams(window.location.search);
  const searchQ = urlParams.get("search");
  if (searchQ) {
    const esInput = document.getElementById("exploreSearch");
    const gsInput = document.getElementById("globalSearchInput");
    if (esInput) esInput.value = searchQ;
    if (gsInput) gsInput.value = searchQ;
    currentSearch = searchQ;
    loadExplorePosts();
  }
});