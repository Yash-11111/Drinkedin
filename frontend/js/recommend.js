const API_USERS  = `${BASE_URL}/api/users`;
const API_POSTS  = `${BASE_URL}/api/posts`;


if (!localStorage.getItem("token")) window.location.href = "login.html";

function getToken()    { return localStorage.getItem("token"); }
function authHeaders() { return { "Authorization": "Bearer " + getToken() }; }

function getCurrentUser() {
  try { return JSON.parse(atob(getToken().split(".")[1])); }
  catch { return null; }
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
let selectedPrefs     = [];
let selectedOccasion  = "";
let conversationHistory = [];
let lastRecommendations = "";

// ── PREFERENCE TOGGLES ──
function togglePref(btn) {
  btn.classList.toggle("active");
  const label = btn.textContent.trim();
  if (btn.classList.contains("active")) {
    selectedPrefs.push(label);
  } else {
    selectedPrefs = selectedPrefs.filter(p => p !== label);
  }
}

function selectOccasion(btn) {
  document.querySelectorAll(".pref-btn.occasion").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  selectedOccasion = btn.textContent.trim();
}

// ── GET RECOMMENDATIONS ──
async function getRecommendations() {
  if (!selectedPrefs.length && !selectedOccasion) {
    showToast("Please select at least one preference! 🍸");
    return;
  }

  const btn = document.getElementById("recommendBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Thinking… 🤖"; }

  // Show loading
  document.getElementById("recommendEmpty").style.display   = "none";
  document.getElementById("recommendLoading").style.display = "flex";
  document.getElementById("recommendResults").style.display = "none";

  try {
    // Fetch user's past pours for context
    let pastPours = [];
    try {
      const res  = await fetch(`${API_POSTS}/my-posts`, { headers: authHeaders() });
      const data = await res.json();
      pastPours  = (data.posts || []).slice(0, 5).map(p => p.story);
    } catch {}

    const extraContext = document.getElementById("extraContext")?.value.trim();

    const prompt = buildPrompt(selectedPrefs, selectedOccasion, extraContext, pastPours);

    // Reset conversation
    conversationHistory = [{ role: "user", content: prompt }];

    const response = await callClaude(conversationHistory);

    lastRecommendations = response;
    conversationHistory.push({ role: "assistant", content: response });

    // Parse and display
    displayRecommendations(response);

  } catch (err) {
    console.error(err);
    showToast("AI error. Please try again.");
    document.getElementById("recommendEmpty").style.display   = "flex";
    document.getElementById("recommendLoading").style.display = "none";
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "✨ Get My Recommendations"; }
  }
}

// ── BUILD PROMPT ──
function buildPrompt(prefs, occasion, extra, pastPours) {
  let prompt = `You are an expert sommelier and bartender on DrinkedIn, a social network for drink enthusiasts.

The user's drink preferences: ${prefs.join(", ") || "open to anything"}
Occasion: ${occasion || "general drinking"}
${extra ? `Additional context: ${extra}` : ""}
${pastPours.length ? `Their recent pours on DrinkedIn: ${pastPours.slice(0, 3).join(" | ")}` : ""}

Please recommend exactly 4 drinks. For each drink respond in this EXACT JSON format:
[
  {
    "name": "Drink Name",
    "emoji": "🥃",
    "type": "Category (e.g. Single Malt Scotch)",
    "description": "2-3 sentences about taste, aroma, why they'll love it",
    "why": "One sentence on why this matches their preferences",
    "price": "Budget / Mid-range / Premium / Luxury",
    "difficulty": "Easy to find / Specialist shop / Rare"
  }
]

Respond with ONLY the JSON array, no other text.`;

  return prompt;
}

async function callClaude(messages) {
  const res = await fetch(`${BASE_URL}/api/recommend`, {
    method:  "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ messages })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || "API error");
  return data.content;
}
// ── DISPLAY RECOMMENDATIONS ──
function displayRecommendations(response) {
  document.getElementById("recommendLoading").style.display = "none";
  document.getElementById("recommendResults").style.display = "block";

  const cards = document.getElementById("recommendCards");
  cards.innerHTML = "";

  try {
    // Strip markdown code fences if Gemini wraps in ```json ... ```
    const cleaned = response
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const recommendations = JSON.parse(cleaned);

    recommendations.forEach((rec, i) => {
      const card     = document.createElement("div");
      card.className = "recommend-card";
      card.style.animationDelay = (i * 0.1) + "s";

      const priceColor = {
        "Budget":     "#4caf50",
        "Mid-range":  "var(--yellow)",
        "Premium":    "#ff9800",
        "Luxury":     "#e91e63"
      }[rec.price] || "var(--yellow)";

      card.innerHTML = `
        <div class="recommend-card-header">
          <span class="recommend-emoji">${rec.emoji}</span>
          <div>
            <h3>${rec.name}</h3>
            <span class="recommend-type">${rec.type}</span>
          </div>
          <span class="recommend-price" style="color:${priceColor}">${rec.price}</span>
        </div>
        <p class="recommend-desc">${rec.description}</p>
        <div class="recommend-why">
          <span>✦</span> ${rec.why}
        </div>
        <div class="recommend-meta">
          <span class="recommend-difficulty">📍 ${rec.difficulty}</span>
          <button class="btn-outline recommend-share-btn"
                  onclick="shareToFeed('${rec.name}', '${rec.emoji}')">
            🍸 Pour This
          </button>
        </div>
      `;
      cards.appendChild(card);
    });

    document.getElementById("chatHistory").innerHTML = "";

  } catch (err) {
    // Fallback — show raw response if JSON parsing fails
    cards.innerHTML = `
      <div class="sidebar-widget">
        <p style="font-size:14px;line-height:1.8;color:var(--text-sub)">${response}</p>
      </div>`;
  }
}
// ── SHARE TO FEED ──
function shareToFeed(name, emoji) {
  window.location.href = `index.html?prefill=${encodeURIComponent(`Just tried ${name} ${emoji} — AI recommended it and wow! 🍸`)}`;
}

// ── FOLLOW-UP CHAT ──
async function askFollowUp() {
  const input   = document.getElementById("followUpInput");
  const question = input?.value.trim();
  if (!question) return;

  input.value = "";

  const history = document.getElementById("chatHistory");

  // Add user message
  history.innerHTML += `
    <div class="chat-follow-msg user-msg">
      <p>${question}</p>
    </div>`;
  history.scrollTop = history.scrollHeight;

  // Add to conversation
  conversationHistory.push({ role: "user", content: question });

  // Show typing
  const typingId = "typing-" + Date.now();
  history.innerHTML += `
    <div class="chat-follow-msg ai-msg" id="${typingId}">
      <div class="ai-thinking" style="padding:0">
        <span class="ai-dot"></span><span class="ai-dot"></span><span class="ai-dot"></span>
      </div>
    </div>`;
  history.scrollTop = history.scrollHeight;

  try {
    const response = await callClaude(conversationHistory);
    conversationHistory.push({ role: "assistant", content: response });

    // Replace typing with response
    const typingEl = document.getElementById(typingId);
    if (typingEl) {
      typingEl.innerHTML = `<p>${response}</p>`;
    }
  } catch {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.innerHTML = `<p style="color:#ff6b6b">Error — please try again</p>`;
  }

  history.scrollTop = history.scrollHeight;
}

// ── RESET ──
function resetRecommendations() {
  document.getElementById("recommendResults").style.display = "none";
  document.getElementById("recommendEmpty").style.display   = "flex";
  document.querySelectorAll(".pref-btn").forEach(b => b.classList.remove("active"));
  selectedPrefs    = [];
  selectedOccasion = "";
  conversationHistory = [];
  const extra = document.getElementById("extraContext");
  if (extra) extra.value = "";
}

// ── HANDLE PREFILL FROM FEED ──
function checkPrefill() {
  const params = new URLSearchParams(window.location.search);
  const prefill = params.get("prefill");
  if (prefill) {
    const extra = document.getElementById("extraContext");
    if (extra) extra.value = prefill;
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
  checkPrefill();
});