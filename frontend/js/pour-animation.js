// ── POUR ANIMATION ──
// Hover on ENTIRE animation container triggers pour

const FILL_RATE     = 1.2;
const FILL_INTERVAL = 40;
const MAX_GLASSES   = 4;
const BOTTLE_START  = 90;
const BOTTLE_DRAIN  = BOTTLE_START / (MAX_GLASSES * (100 / FILL_RATE));

let currentGlass = 0;
let glassLevels  = [0];
let bottleLevel  = BOTTLE_START;
let fillTimer    = null;
let glassCount   = 1;
let isHovering   = false;
let isPouring    = false;
let isTransitioning = false;

// ── TARGET: entire animation container ──
const animContainer    = document.getElementById("animContainer");
const bottleWrap       = document.getElementById("bottleWrap");

const glassesContainer = document.getElementById("glassesContainer");
const bubblesContainer = document.getElementById("bubblesContainer");

// Hover on the whole container
animContainer.addEventListener("mouseenter", () => { isHovering = true;  startPouring(); });
animContainer.addEventListener("mouseleave", () => { isHovering = false; stopPouring();  });

// Also works on mobile tap
animContainer.addEventListener("touchstart", e => {
  e.preventDefault();
  isHovering = true;
  startPouring();
}, { passive: false });
animContainer.addEventListener("touchend", () => {
  isHovering = false;
  stopPouring();
});

function startPouring() {
  if (isPouring || isTransitioning || bottleLevel <= 1) return;
  isPouring = true;
  bottleWrap.classList.add("pouring");
 
  clearInterval(fillTimer);
  fillTimer = setInterval(pourTick, FILL_INTERVAL);
}

function stopPouring() {
  isPouring = false;
  bottleWrap.classList.remove("pouring");

  clearInterval(fillTimer);
}

function pourTick() {
  if (bottleLevel <= 0) {
    stopPouring();
    setTimeout(resetAll, 600);
    return;
  }

  // Fill glass
  glassLevels[currentGlass] = Math.min(100, glassLevels[currentGlass] + FILL_RATE);
  bottleLevel = Math.max(0, bottleLevel - BOTTLE_DRAIN);

  // Update glass liquid
  const liquidEl = document.getElementById("liquid" + currentGlass);
  if (liquidEl) liquidEl.style.height = glassLevels[currentGlass] + "%";

  // Update bottle liquid
  const bottleLiqEl = document.getElementById("bottleLiquid");
  if (bottleLiqEl) bottleLiqEl.style.height = bottleLevel + "%";

  // Bubbles
  if (Math.random() < 0.2) spawnBubble();

  // Glass full
  if (glassLevels[currentGlass] >= 100) {
    const glassEl = document.getElementById("glass" + currentGlass);
    if (glassEl) {
      glassEl.classList.add("full");
      glassEl.classList.remove("active");
    }

    if (glassCount < MAX_GLASSES) {
      // Pause briefly, add new glass, resume automatically if still hovering
      stopPouring();
      isTransitioning = true;

      setTimeout(() => {
        addNewGlass();
        setTimeout(() => {
          isTransitioning = false;
          if (isHovering) startPouring(); // auto-resume if still hovering
        }, 350);
      }, 200);

    } else {
      stopPouring();
      setTimeout(resetAll, 1200);
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
  g.style.cssText = "opacity:0;transform:scale(0.6)";
  g.innerHTML = `
    <div class="glass-body">
      <div class="glass-liquid" id="liquid${currentGlass}"></div>
      <div class="glass-shine"></div>
    </div>
    <div class="glass-stem"></div>
    <div class="glass-base"></div>
  `;
  glassesContainer.appendChild(g);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    g.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    g.style.opacity    = "1";
    g.style.transform  = "scale(1)";
  }));
}

function resetAll() {
  stopPouring();
  isTransitioning = false;

  document.querySelectorAll(".glass").forEach(g => {
    g.style.transition = "opacity 0.4s, transform 0.4s";
    g.style.opacity    = "0";
    g.style.transform  = "scale(0.5)";
  });

  setTimeout(() => {
    glassCount   = 1;
    currentGlass = 0;
    glassLevels  = [0];
    bottleLevel  = BOTTLE_START;

    glassesContainer.innerHTML = `
      <div class="glass active" id="glass0" style="opacity:0;transform:scale(0.7)">
        <div class="glass-body">
          <div class="glass-liquid" id="liquid0"></div>
          <div class="glass-shine"></div>
        </div>
        <div class="glass-stem"></div>
        <div class="glass-base"></div>
      </div>`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const g = document.getElementById("glass0");
      if (g) {
        g.style.transition = "opacity 0.4s, transform 0.4s";
        g.style.opacity    = "1";
        g.style.transform  = "scale(1)";
      }
    }));

    const bl = document.getElementById("bottleLiquid");
    if (bl) {
      bl.style.transition = "height 0.8s ease";
      bl.style.height     = BOTTLE_START + "%";
      setTimeout(() => bl.style.transition = "height 0.08s linear", 900);
    }
  }, 600);
}

function spawnBubble() {
  const glassEl = document.getElementById("glass" + currentGlass);
  if (!glassEl) return;
  const rect     = glassEl.getBoundingClientRect();
  const contRect = bubblesContainer.getBoundingClientRect();
  const b        = document.createElement("div");
  b.className    = "bubble";
  const size     = Math.random() * 5 + 2;
  const x        = (rect.left - contRect.left) + Math.random() * 28 + 8;
  const dur      = Math.random() * 600 + 400;
  b.style.cssText = `width:${size}px;height:${size}px;left:${x}px;bottom:8px;animation-duration:${dur}ms`;
  bubblesContainer.appendChild(b);
  setTimeout(() => b.remove(), dur);
}