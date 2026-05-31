// ── POUR ANIMATION ──
const FILL_RATE     = 0.8;  // % per tick (slower = more satisfying)
const FILL_INTERVAL = 40;   // ms per tick
const MAX_GLASSES   = 4;    // glasses before reset
const BOTTLE_START  = 90;   // start bottle fuller

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

// ── HOVER / TOUCH ──
bottleWrap.addEventListener("mouseenter", startPouring);
bottleWrap.addEventListener("mouseleave", stopPouring);
bottleWrap.addEventListener("touchstart", e => { e.preventDefault(); startPouring(); }, { passive: false });
bottleWrap.addEventListener("touchend",   stopPouring);

function startPouring() {
  if (bottleLevel <= 2) { resetAll(); return; }
  isPouring = true;
  clearTimeout(autoTimer);
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
  if (bottleLevel <= 0) { stopPouring(); resetAll(); return; }

  // Fill current glass
  glassLevels[currentGlass] = Math.min(100, glassLevels[currentGlass] + FILL_RATE);

  // Drain bottle slowly — lasts all 4 glasses
  bottleLevel = Math.max(0, bottleLevel - (BOTTLE_START / (MAX_GLASSES * 100 / FILL_RATE)) );

  // Update glass liquid
  const liquidEl = document.getElementById("liquid" + currentGlass);
  if (liquidEl) liquidEl.style.height = glassLevels[currentGlass] + "%";

  // Update bottle liquid
  const bottleLiquidEl = document.getElementById("bottleLiquid");
  if (bottleLiquidEl) bottleLiquidEl.style.height = bottleLevel + "%";

  // Spawn bubbles occasionally
  if (Math.random() < 0.25) spawnBubble(currentGlass);

  // Glass is full
  if (glassLevels[currentGlass] >= 100) {
    const glassEl = document.getElementById("glass" + currentGlass);
    if (glassEl) {
      glassEl.classList.add("full");
      glassEl.classList.remove("active");
    }

    if (glassCount < MAX_GLASSES) {
      setTimeout(addNewGlass, 300);
    } else {
      setTimeout(resetAll, 800);
      stopPouring();
    }
  }
}

function addNewGlass() {
  currentGlass = glassCount;
  glassLevels.push(0);
  glassCount++;

  const newGlass     = document.createElement("div");
  newGlass.className = "glass active";
  newGlass.id        = "glass" + currentGlass;
  newGlass.style.opacity   = "0";
  newGlass.style.transform = "scale(0.7) translateY(10px)";
  newGlass.innerHTML = `
    <div class="glass-body">
      <div class="glass-liquid" id="liquid${currentGlass}"></div>
      <div class="glass-shine"></div>
    </div>
    <div class="glass-stem"></div>
    <div class="glass-base"></div>
  `;

  glassesContainer.appendChild(newGlass);

  // Animate in
  requestAnimationFrame(() => {
    newGlass.style.transition = "opacity 0.35s, transform 0.35s";
    newGlass.style.opacity    = "1";
    newGlass.style.transform  = "scale(1) translateY(0)";
  });
}

function resetAll() {
  clearInterval(fillTimer);
  isPouring = false;
  bottleWrap.classList.remove("pouring");
  pourStream.classList.remove("active");

  // Fade out all glasses
  const glasses = glassesContainer.querySelectorAll(".glass");
  glasses.forEach(g => {
    g.style.transition = "opacity 0.5s, transform 0.5s";
    g.style.opacity    = "0";
    g.style.transform  = "scale(0.5) translateY(20px)";
  });

  setTimeout(() => {
    // Reset state
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

    // Animate first glass in
    requestAnimationFrame(() => {
      const g = document.getElementById("glass0");
      if (g) {
        g.style.transition = "opacity 0.4s, transform 0.4s";
        g.style.opacity    = "1";
        g.style.transform  = "scale(1)";
      }
    });

    // Reset bottle level
    const bottleLiquidEl = document.getElementById("bottleLiquid");
    if (bottleLiquidEl) {
      bottleLiquidEl.style.transition = "height 1s ease";
      bottleLiquidEl.style.height     = BOTTLE_START + "%";
      setTimeout(() => { bottleLiquidEl.style.transition = "height 0.2s linear"; }, 1100);
    }

    scheduleAutoPour();
  }, 700);
}

function spawnBubble(glassIndex) {
  const glassEl = document.getElementById("glass" + glassIndex);
  if (!glassEl) return;

  const rect     = glassEl.getBoundingClientRect();
  const contRect = bubblesContainer.getBoundingClientRect();

  const bubble   = document.createElement("div");
  bubble.className = "bubble";

  const size = Math.random() * 5 + 2;
  const x    = rect.left - contRect.left + Math.random() * 36 + 8;
  const dur  = Math.random() * 700 + 500;

  bubble.style.cssText = `
    width:${size}px; height:${size}px;
    left:${x}px; bottom:10px;
    animation-duration:${dur}ms;
  `;

  bubblesContainer.appendChild(bubble);
  setTimeout(() => bubble.remove(), dur);
}

// ── AUTO POUR in demo mode ──
function scheduleAutoPour() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(() => {
    if (!isPouring) {
      startPouring();
      // Auto stop after 2.5s
      setTimeout(() => {
        if (isPouring) stopPouring();
      }, 2500);
    }
  }, 2500);
}

// ── START ──
scheduleAutoPour();