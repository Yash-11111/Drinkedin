// ── POUR ANIMATION ──
const FILL_RATE      = 1.2;   // % per tick
const FILL_INTERVAL  = 50;    // ms per tick
const MAX_GLASSES    = 4;
const BOTTLE_DRAIN   = 1.5;   // % drained per tick

let isPaused       = false;
let currentGlass   = 0;
let glassLevels    = [0];
let bottleLevel    = 55;
let fillTimer      = null;
let glassCount     = 1;
let isPouring      = false;

const bottleWrap   = document.getElementById("bottleWrap");
const pourStream   = document.getElementById("pourStream");
const glassesContainer = document.getElementById("glassesContainer");
const bubblesContainer = document.getElementById("bubblesContainer");

// ── START POURING on hover ──
bottleWrap.addEventListener("mouseenter", startPouring);
bottleWrap.addEventListener("mouseleave", stopPouring);

// ── TOUCH support ──
bottleWrap.addEventListener("touchstart", e => { e.preventDefault(); startPouring(); });
bottleWrap.addEventListener("touchend",   stopPouring);

function startPouring() {
  if (bottleLevel <= 5) return;
  isPouring = true;
  bottleWrap.classList.add("pouring");
  pourStream.classList.add("active");
  fillTimer = setInterval(pourTick, FILL_INTERVAL);
}

function stopPouring() {
  isPouring = false;
  bottleWrap.classList.remove("pouring");
  pourStream.classList.remove("active");
  clearInterval(fillTimer);
}

function pourTick() {
  if (!isPouring || bottleLevel <= 5) {
    stopPouring();
    return;
  }

  // Fill current glass
  glassLevels[currentGlass] = Math.min(100, glassLevels[currentGlass] + FILL_RATE);
  bottleLevel = Math.max(0, bottleLevel - BOTTLE_DRAIN * 0.3);

  // Update glass liquid
  const liquidEl = document.getElementById("liquid" + currentGlass);
  if (liquidEl) liquidEl.style.height = glassLevels[currentGlass] + "%";

  // Update bottle liquid
  const bottleLiquidEl = document.getElementById("bottleLiquid");
  if (bottleLiquidEl) bottleLiquidEl.style.height = bottleLevel + "%";

  // Spawn bubbles
  if (Math.random() < 0.3) spawnBubble(currentGlass);

  // Glass full
  if (glassLevels[currentGlass] >= 100) {
    const glassEl = document.getElementById("glass" + currentGlass);
    if (glassEl) glassEl.classList.add("full");

    setTimeout(() => {
      addNewGlass();
    }, 400);

    stopPouring();
  }
}

function addNewGlass() {
  if (glassCount >= MAX_GLASSES) {
    // Reset all glasses
    resetGlasses();
    return;
  }

  // Deactivate current glass
  const prevGlass = document.getElementById("glass" + currentGlass);
  if (prevGlass) prevGlass.classList.remove("active");

  // Create new glass
  currentGlass = glassCount;
  glassLevels.push(0);
  glassCount++;

  const newGlass = document.createElement("div");
  newGlass.className = "glass active";
  newGlass.id        = "glass" + currentGlass;
  newGlass.innerHTML = `
    <div class="glass-body">
      <div class="glass-liquid" id="liquid${currentGlass}"></div>
      <div class="glass-shine"></div>
    </div>
    <div class="glass-stem"></div>
    <div class="glass-base"></div>
  `;

  glassesContainer.appendChild(newGlass);

  // Scroll container if needed
  glassesContainer.scrollLeft = glassesContainer.scrollWidth;
}

function resetGlasses() {
  // Fade out all glasses
  const glasses = glassesContainer.querySelectorAll(".glass");
  glasses.forEach(g => { g.style.opacity = "0"; g.style.transform = "scale(0.5)"; });

  setTimeout(() => {
    // Reset state
    glassCount   = 1;
    currentGlass = 0;
    glassLevels  = [0];
    bottleLevel  = 55;

    // Clear container
    glassesContainer.innerHTML = `
      <div class="glass active" id="glass0">
        <div class="glass-body">
          <div class="glass-liquid" id="liquid0"></div>
          <div class="glass-shine"></div>
        </div>
        <div class="glass-stem"></div>
        <div class="glass-base"></div>
      </div>
    `;

    // Reset bottle
    const bottleLiquidEl = document.getElementById("bottleLiquid");
    if (bottleLiquidEl) {
      bottleLiquidEl.style.transition = "height 1s ease";
      bottleLiquidEl.style.height     = "55%";
      setTimeout(() => { bottleLiquidEl.style.transition = "height 0.5s ease"; }, 1000);
    }
  }, 600);
}

function spawnBubble(glassIndex) {
  const glassEl = document.getElementById("glass" + glassIndex);
  if (!glassEl) return;

  const rect   = glassEl.getBoundingClientRect();
  const contRect = bubblesContainer.getBoundingClientRect();

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const size = Math.random() * 6 + 3;
  const x    = rect.left - contRect.left + Math.random() * 40 + 8;
  const dur  = Math.random() * 800 + 600;

  bubble.style.cssText = `
    width:${size}px; height:${size}px;
    left:${x}px; bottom:${glassLevels[glassIndex] * 0.8}px;
    animation-duration:${dur}ms;
  `;

  bubblesContainer.appendChild(bubble);
  setTimeout(() => bubble.remove(), dur);
}

// ── AUTO POUR on idle (demo mode) ──
let autoPourTimeout;
function scheduleAutoPour() {
  autoPourTimeout = setTimeout(() => {
    if (!isPouring) {
      startPouring();
      setTimeout(() => {
        if (isPouring) stopPouring();
        scheduleAutoPour();
      }, 2000);
    } else {
      scheduleAutoPour();
    }
  }, 3000);
}

scheduleAutoPour();