// ── POUR ANIMATION v3 ──
// Bottle on left, rotates clockwise to pour into glass on right

const FILL_RATE     = 1.0;   // % per tick
const FILL_INTERVAL = 45;    // ms
const MAX_GLASSES   = 4;
const BOTTLE_START  = 90;

// Each glass needs 100/FILL_RATE ticks to fill
// Total ticks = MAX_GLASSES * 100/FILL_RATE = 400
// Bottle drain per tick = BOTTLE_START / 400 = 0.225
const BOTTLE_DRAIN  = BOTTLE_START / (MAX_GLASSES * (100 / FILL_RATE));

let currentGlass  = 0;
let glassLevels   = [0];
let bottleLevel   = BOTTLE_START;
let fillTimer     = null;
let glassCount    = 1;
let isPouring     = false;
let autoTimer     = null;

const bottleWrap       = document.getElementById("bottleWrap");
const pourStream       = document.getElementById("pourStream");
const glassesContainer = document.getElementById("glassesContainer");
const bubblesContainer = document.getElementById("bubblesContainer");

if (!bottleWrap) console.error("bottleWrap not found");

// ── EVENTS ──
bottleWrap.addEventListener("mouseenter", startPouring);
bottleWrap.addEventListener("mouseleave", stopPouring);
bottleWrap.addEventListener("touchstart", e => {
  e.preventDefault();
  isPouring ? stopPouring() : startPouring();
}, { passive: false });

function startPouring() {
  if (isPouring) return;
  if (bottleLevel <= 1) { resetAll(); return; }

  clearTimeout(autoTimer);
  isPouring = true;

  bottleWrap.classList.add("pouring");
  pourStream.classList.add("active");

  clearInterval(fillTimer);
  fillTimer = setInterval(pourTick, FILL_INTERVAL);
}

function stopPouring() {
  isPouring = false;
  bottleWrap.classList.remove("pouring");
  pourStream.classList.remove("active");
  clearInterval(fillTimer);
  scheduleAutoPour();
}

function pourTick() {
  if (bottleLevel <= 0) {
    stopPouring();
    setTimeout(resetAll, 500);
    return;
  }

  // Fill glass
  glassLevels[currentGlass] = Math.min(100, glassLevels[currentGlass] + FILL_RATE);
  bottleLevel = Math.max(0, bottleLevel - BOTTLE_DRAIN);

  // Update DOM
  const liquidEl = document.getElementById("liquid" + currentGlass);
  if (liquidEl) liquidEl.style.height = glassLevels[currentGlass] + "%";

  const bottleLiqEl = document.getElementById("bottleLiquid");
  if (bottleLiqEl) bottleLiqEl.style.height = bottleLevel + "%";

  // Bubbles
  if (Math.random() < 0.2) spawnBubble();

  // Glass full
  if (glassLevels[currentGlass] >= 100) {
    const glassEl = document.getElementById("glass" + currentGlass);
    if (glassEl) {
      glassEl.classList.add("full");
      setTimeout(() => glassEl.classList.remove("active"), 100);
    }

    if (glassCount < MAX_GLASSES) {
      setTimeout(addNewGlass, 350);
    } else {
      stopPouring();
      setTimeout(resetAll, 1000);
    }
  }
}

function addNewGlass() {
  currentGlass = glassCount;
  glassLevels.push(0);
  glassCount++;

  const g     = document.createElement("div");
  g.className = "glass active";
  g.id        = "glass" + currentGlass;
  g.style.cssText = "opacity:0;transform:scale(0.6) translateY(12px)";
  g.innerHTML = `
    <div class="glass-body">
      <div class="glass-liquid" id="liquid${currentGlass}"></div>
      <div class="glass-shine"></div>
    </div>
    <div class="glass-stem"></div>
    <div class="glass-base"></div>
  `;

  glassesContainer.appendChild(g);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      g.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      g.style.opacity    = "1";
      g.style.transform  = "scale(1) translateY(0)";
    });
  });
}

function resetAll() {
  clearInterval(fillTimer);
  isPouring = false;
  bottleWrap.classList.remove("pouring");
  pourStream.classList.remove("active");

  // Fade out glasses
  document.querySelectorAll(".glass").forEach(g => {
    g.style.transition = "opacity 0.4s, transform 0.4s";
    g.style.opacity    = "0";
    g.style.transform  = "scale(0.5)";
  });

  setTimeout(() => {
    glassCount    = 1;
    currentGlass  = 0;
    glassLevels   = [0];
    bottleLevel   = BOTTLE_START;

    glassesContainer.innerHTML = `
      <div class="glass active" id="glass0" style="opacity:0;transform:scale(0.7)">
        <div class="glass-body">
          <div class="glass-liquid" id="liquid0"></div>
          <div class="glass-shine"></div>
        </div>
        <div class="glass-stem"></div>
        <div class="glass-base"></div>
      </div>
    `;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const g = document.getElementById("glass0");
        if (g) {
          g.style.transition = "opacity 0.4s, transform 0.4s";
          g.style.opacity    = "1";
          g.style.transform  = "scale(1)";
        }
      });
    });

    const bl = document.getElementById("bottleLiquid");
    if (bl) {
      bl.style.transition = "height 0.8s ease";
      bl.style.height     = BOTTLE_START + "%";
      setTimeout(() => bl.style.transition = "height 0.1s linear", 900);
    }

    scheduleAutoPour();
  }, 600);
}

function spawnBubble() {
  const glassEl = document.getElementById("glass" + currentGlass);
  if (!glassEl) return;

  const rect     = glassEl.getBoundingClientRect();
  const contRect = bubblesContainer.getBoundingClientRect();

  const b       = document.createElement("div");
  b.className   = "bubble";
  const size    = Math.random() * 5 + 2;
  const x       = (rect.left - contRect.left) + Math.random() * 36 + 6;
  const dur     = Math.random() * 600 + 400;
  b.style.cssText = `width:${size}px;height:${size}px;left:${x}px;bottom:8px;animation-duration:${dur}ms`;
  bubblesContainer.appendChild(b);
  setTimeout(() => b.remove(), dur);
}

// ── AUTO POUR DEMO ──
function scheduleAutoPour() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!isPouring) {
      startPouring();
      setTimeout(() => { if (isPouring) stopPouring(); }, 3000);
    }
  }, 2000);
}

scheduleAutoPour();