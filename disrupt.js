
/*
  SCOOP EVERYTHING — DISRUPT V2C

  HOLD + SCOOP → Create 3 glass fragments
  TILT         → Guide fragments
  SHAKE        → Scatter fragments
  REST         → Continue floating

  Sends DISRUPT events to the shared display.

  Original Player 02 remains unchanged.
*/

// ========================================
// SCOOP SETTINGS
// ========================================

const SCOOP = {
  dip: 0.30,
  reversal: 0.15,
  rearm: 0.12,
  minMs: 140,
  maxMs: 4500,
  cooldownMs: 320,
  smoothing: 0.25
};

// ========================================
// ART SETTINGS
// ========================================

const ART = {
  background: [233, 234, 240],

  fragmentsPerScoop: 3,
  maxFragments: 45,

  minSize: 24,
  maxSize: 72,

  movementStrength: 35,
  maxSpeed: 3.5,

  movingFriction: 0.995,
  restingFriction: 0.995,

  motionDeadzone: 0.0025,

  shakeThreshold: 1.8,
  shakeMaximum: 15,
  shakeCooldown: 250,
  shakeStrength: 0.65,

  appearMs: 650,
  breathingAmount: 0.045,
  breathingSpeed: 0.018
};

const PALETTE = [
  [217, 167, 160],
  [169, 196, 196],
  [199, 180, 219],
  [227, 197, 162],
  [155, 170, 205],
  [238, 230, 223],
  [177, 159, 193]
];

// ========================================
// SHARED DISPLAY CONNECTION
// ========================================

const SHARE_HOST =
  "https://p5-phone-share.npuckett.workers.dev";

const SHARE_ROOM = "scoop-everything-v2c";
const SHARE_APP = "scoop-everything";

const DISRUPT_MODE = "disrupt";

// Each open page has its own participant ID.
const DISRUPT_ID =
  "disrupt-" +
  Math.random().toString(36).slice(2, 10);

// Limit network messages to approximately 15 per second.
const SEND_INTERVAL = 65;

let lastSendAt = 0;

// ========================================
// GLOBAL VARIABLES
// ========================================

let sensorButton;

let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;

let scoopState = "waiting";
let gesture = null;
let totalScoops = 0;

let lastFilteredX = null;
let lastMotionAt = 0;
let motionSpeedX = 0;

let fragments = [];
let nextFragmentId = 1;

let previousTiltX = null;
let previousTiltY = null;
let previousMotionTime = null;

let motionX = 0;
let motionY = 0;
let motionMagnitude = 0;

let previousAcceleration = null;
let lastShakeAt = 0;
let shakeEnergy = 0;

let totalShakes = 0;

// ========================================
// SETUP
// ========================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  pixelDensity(1);
  frameRate(60);

  sensorButton = createButton(
    "Enable Motion Sensors"
  );

  sensorButton.id("enable-sensors");

  sensorButton.position(
    width / 2 - 100,
    height / 2 - 25
  );

  sensorButton.size(200, 50);

  sensorButton.style("background", "#343B4D");
  sensorButton.style("color", "#FFFFFF");
  sensorButton.style("border", "none");
  sensorButton.style("border-radius", "25px");
  sensorButton.style("font-size", "13px");

  enableSensorOn("#enable-sensors");
  lockGestures();

  // Connect to the same room as CREATE.
  shareSetup({
    host: SHARE_HOST,
    room: SHARE_ROOM,
    app: SHARE_APP,
    me: {
      name: "DISRUPT",
      role: 2
    }
  });

  textAlign(CENTER, CENTER);
}

// ========================================
// MAIN DRAW LOOP
// ========================================

function draw() {
  background(...ART.background);

  if (!window.sensorsEnabled) {
    noStroke();
    fill(52, 59, 77);
    textSize(17);
    textAlign(CENTER, CENTER);

    text(
      "Tap the button to start",
      width / 2,
      height / 2 - 75
    );

    return;
  }

  if (sensorButton) {
    sensorButton.hide();
  }

  updateFinger();
  updateScoopGesture();

  updatePhoneMovement();
  updateShake();

  for (const f of fragments) {
    updateFragment(f);
    drawFragment(f);
  }

  // Send fragment positions to the shared display.
  sendFragmentPositions();

  if (fragments.length === 0) {
    noStroke();
    fill(100, 106, 123);
    textSize(18);
    textAlign(CENTER, CENTER);

    text(
      "DISRUPT — Hold + Scoop!",
      width / 2,
      height * 0.62
    );
  }

  drawDebug();
  drawInstructions();
}

// ========================================
// SCOOP DETECTION
// Preserved from Player 02 V2C
// ========================================

function updateScoopGesture() {
  const now = performance.now();
  const x = rotationX;

  if (!Number.isFinite(x)) return;

  if (!fingerHeld) {
    gesture = null;
    scoopState = "waiting";
    lastFilteredX = null;
    lastMotionAt = 0;
    motionSpeedX = 0;
    return;
  }

  const dt = lastMotionAt
    ? (now - lastMotionAt) / 1000
    : 0;

  const previous = lastFilteredX;

  const filtered = previous === null
    ? x
    : previous +
      SCOOP.smoothing * (x - previous);

  motionSpeedX =
    dt > 0.005 &&
    dt < 0.25 &&
    previous !== null
      ? (filtered - previous) / dt
      : 0;

  lastFilteredX = filtered;
  lastMotionAt = now;

  if (!gesture) {
    gesture = {
      baseline: filtered,
      minX: filtered,
      maxX: filtered,
      start: now,
      lastSuccess: -Infinity,
      cycle: 0,
      reversalPeak: filtered
    };

    scoopState = "ready";
    return;
  }

  const g = gesture;

  if (scoopState === "ready") {
    g.maxX = Math.max(g.maxX, filtered);
    g.baseline = g.maxX;

    if (g.maxX - filtered >= SCOOP.dip) {
      g.minX = filtered;
      g.start = now;
      scoopState = "dipped";
    }
  }

  else if (scoopState === "dipped") {
    g.minX = Math.min(g.minX, filtered);

    if (now - g.start > SCOOP.maxMs) {
      g.maxX = filtered;
      g.baseline = filtered;
      g.minX = filtered;
      scoopState = "ready";
    }

    else if (
      filtered - g.minX >= SCOOP.reversal &&
      now - g.start >= SCOOP.minMs &&
      motionSpeedX > 0.03 &&
      now - g.lastSuccess >= SCOOP.cooldownMs
    ) {
      addScoop();

      g.lastSuccess = now;
      g.cycle++;
      g.reversalPeak = filtered;

      scoopState = "rearm";
    }
  }

  else if (scoopState === "rearm") {
    g.reversalPeak = Math.max(
      g.reversalPeak,
      filtered
    );

    if (
      now - g.lastSuccess >= SCOOP.cooldownMs &&
      g.reversalPeak - filtered >= SCOOP.rearm
    ) {
      g.maxX = g.reversalPeak;
      g.baseline = g.maxX;
      g.minX = filtered;
      g.start = now;

      scoopState =
        g.maxX - filtered >= SCOOP.dip
          ? "dipped"
          : "ready";
    }
  }
}

// ========================================
// CREATE GLASS FRAGMENTS
// ========================================

function addScoop() {
  totalScoops++;

  for (
    let i = 0;
    i < ART.fragmentsPerScoop;
    i++
  ) {
    fragments.push(createFragment());
  }

  while (
    fragments.length > ART.maxFragments
  ) {
    fragments.shift();
  }

  // Notify shared display of new fragments.
  emitDisrupt("spawn", {
    fragments: getNetworkFragments()
  });
}

function createFragment() {
  const size = random(
    ART.minSize,
    ART.maxSize
  );

  const margin = size * 0.65;

  return {
    id: nextFragmentId++,

    x: random(
      margin,
      max(margin, width - margin)
    ),

    y: random(
      min(100, height * 0.25),
      max(101, height - 55)
    ),

    vx: random(-0.7, 0.7),
    vy: random(-0.7, 0.7),

    speedFactor: random(0.65, 1.65),

    size,
    rotation: random(TWO_PI),

    rotationSpeed: random(
      -0.008,
      0.008
    ),

    color: [...random(PALETTE)],
    shape: floor(random(4)),
    phase: random(TWO_PI),
    createdAt: millis()
  };
}

// ========================================
// PHONE MOVEMENT
// ========================================

function updatePhoneMovement() {
  const now = performance.now();

  const rawX = rotationY;
  const rawY = rotationX;

  if (
    !Number.isFinite(rawX) ||
    !Number.isFinite(rawY)
  ) {
    motionX = 0;
    motionY = 0;
    motionMagnitude = 0;
    return;
  }

  if (
    previousTiltX === null ||
    previousTiltY === null
  ) {
    previousTiltX = rawX;
    previousTiltY = rawY;
    previousMotionTime = now;
    return;
  }

  const dt = constrain(
    (now - previousMotionTime) / 1000,
    0.008,
    0.1
  );

  const deltaX = rawX - previousTiltX;
  const deltaY = rawY - previousTiltY;

  previousTiltX = rawX;
  previousTiltY = rawY;
  previousMotionTime = now;

  const cleanX =
    abs(deltaX) > ART.motionDeadzone
      ? deltaX
      : 0;

  const cleanY =
    abs(deltaY) > ART.motionDeadzone
      ? deltaY
      : 0;

  motionX = constrain(
    cleanX / dt,
    -8,
    8
  );

  motionY = constrain(
    cleanY / dt,
    -8,
    8
  );

  motionMagnitude = sqrt(
    motionX * motionX +
    motionY * motionY
  );
}

// ========================================
// FREE-FLOATING FRAGMENT PHYSICS
// ========================================

function updateFragment(f) {
  const forceX =
    motionX *
    ART.movementStrength *
    f.speedFactor / 60;

  const forceY =
    motionY *
    ART.movementStrength *
    f.speedFactor / 60;

  f.vx += forceX;
  f.vy += forceY;

  // Independent floating motion.
  f.vx +=
    sin(frameCount * 0.012 + f.phase) *
    0.025;

  f.vy +=
    cos(frameCount * 0.010 + f.phase) *
    0.025;

  const damping = 0.995;

  f.vx *= damping;
  f.vy *= damping;

  const maxV =
    ART.maxSpeed +
    shakeEnergy * 5;

  const speed = sqrt(
    f.vx * f.vx +
    f.vy * f.vy
  );

  if (speed > maxV) {
    const factor = maxV / speed;
    f.vx *= factor;
    f.vy *= factor;
  }

  f.x += f.vx;
  f.y += f.vy;

  f.rotation +=
    f.rotationSpeed *
    (1 + speed * 0.2);

  const margin = f.size * 0.55;

  const minX = margin;
  const maxX = max(
    margin,
    width - margin
  );

  const minY = min(90, height * 0.2);

  const maxY = max(
    minY,
    height - max(35, height * 0.07)
  );

  // Soft boundary bounce.
  if (f.x < minX) {
    f.x = minX;
    f.vx = abs(f.vx) * 0.65;
  }

  if (f.x > maxX) {
    f.x = maxX;
    f.vx = -abs(f.vx) * 0.65;
  }

  if (f.y < minY) {
    f.y = minY;
    f.vy = abs(f.vy) * 0.65;
  }

  if (f.y > maxY) {
    f.y = maxY;
    f.vy = -abs(f.vy) * 0.65;
  }
}

// ========================================
// SHAKE DETECTION
// ========================================

function updateShake() {
  const now = millis();

  const ax = Number.isFinite(accelerationX)
    ? accelerationX : 0;

  const ay = Number.isFinite(accelerationY)
    ? accelerationY : 0;

  const az = Number.isFinite(accelerationZ)
    ? accelerationZ : 0;

  const current = { ax, ay, az };

  if (previousAcceleration !== null) {
    const dx =
      ax - previousAcceleration.ax;

    const dy =
      ay - previousAcceleration.ay;

    const dz =
      az - previousAcceleration.az;

    const change = sqrt(
      dx * dx +
      dy * dy +
      dz * dz
    );

    if (
      change > ART.shakeThreshold &&
      now - lastShakeAt >
        ART.shakeCooldown
    ) {
      const intensity = constrain(
        map(
          change,
          ART.shakeThreshold,
          ART.shakeMaximum,
          0.15,
          1
        ),
        0.15,
        1
      );

      triggerShake(intensity);
      lastShakeAt = now;
    }
  }

  previousAcceleration = current;

  shakeEnergy *= 0.88;

  if (shakeEnergy < 0.005) {
    shakeEnergy = 0;
  }
}

function triggerShake(intensity) {
  shakeEnergy = intensity;
  totalShakes++;

  const force =
    intensity *
    ART.shakeStrength *
    10;

  for (const f of fragments) {
    f.vx +=
      random(-force, force) *
      f.speedFactor;

    f.vy +=
      random(-force, force) *
      f.speedFactor;
  }

  // Send shake intensity and fragment positions.
  emitDisrupt("shake", {
    intensity,
    fragments: getNetworkFragments()
  });
}

// ========================================
// SHARED DISPLAY MESSAGES
// ========================================

// Send only when connected.
function emitDisrupt(action, extra = {}) {
  if (
    typeof shareConnected === "undefined" ||
    !shareConnected
  ) {
    return;
  }

  shareEmit("disrupt", {
    player: 2,
    mode: DISRUPT_MODE,
    participantId: DISRUPT_ID,
    action,
    ...extra
  });
}

// Convert positions and sizes into values
// independent of phone screen dimensions.
function getNetworkFragments() {
  const shortest = Math.min(width, height);

  return fragments.map(f => ({
    id: f.id,
    x: f.x / width,
    y: f.y / height,
    size: f.size / shortest,
    rotation: f.rotation,
    color: f.color,
    shape: f.shape
  }));
}

// Send positions during movement.
// The display can use these positions to
// draw fragments and detect artwork collisions.
function sendFragmentPositions() {
  if (fragments.length === 0) {
    return;
  }

  const now = performance.now();

  if (now - lastSendAt < SEND_INTERVAL) {
    return;
  }

  lastSendAt = now;

  emitDisrupt("move", {
    fragments: getNetworkFragments(),
    motion: {
      x: motionX,
      y: motionY,
      magnitude: motionMagnitude
    }
  });
}

// ========================================
// DRAW GLASS FRAGMENTS
// ========================================

function drawFragment(f) {
  const appear = constrain(
    (millis() - f.createdAt) /
      ART.appearMs,
    0,
    1
  );

  push();

  translate(f.x, f.y);
  rotate(f.rotation);

  const breathing =
    1 +
    sin(
      frameCount * ART.breathingSpeed +
      f.phase
    ) *
    ART.breathingAmount;

  scale(breathing);

  const c = f.color;
  const s = f.size;

  // Soft pastel shadow.
  noStroke();

  fill(
    c[0],
    c[1],
    c[2],
    18 * appear
  );

  ellipse(
    3,
    5,
    s * 1.1,
    s * 0.75
  );

  // Translucent glass.
  fill(
    c[0],
    c[1],
    c[2],
    165 * appear
  );

  stroke(
    min(255, c[0] + 25),
    min(255, c[1] + 25),
    min(255, c[2] + 25),
    180 * appear
  );

  strokeWeight(1);

  if (f.shape === 0) {
    rectMode(CENTER);
    rect(0, 0, s, s * 0.46, 3);
  }

  else if (f.shape === 1) {
    beginShape();
    vertex(-s * 0.5, -s * 0.25);
    vertex(s * 0.25, -s * 0.4);
    vertex(s * 0.5, s * 0.2);
    vertex(-s * 0.2, s * 0.35);
    endShape(CLOSE);
  }

  else if (f.shape === 2) {
    triangle(
      -s * 0.45, s * 0.3,
      0, -s * 0.45,
      s * 0.5, s * 0.25
    );
  }

  else {
    rectMode(CENTER);
    rect(
      0,
      0,
      s * 0.5,
      s * 0.9,
      5
    );
  }

  pop();
}

// ========================================
// FINGER TRACKING
// ========================================

function updateFinger() {
  const empty = touches.length === 0;

  if (trackedFingerId === null) {
    if (!empty && touchesWereEmpty) {
      trackedFingerId = touches[0].id;
      fingerHeld = true;
    }
  }

  else {
    let stillDown = false;

    for (
      let i = 0;
      i < touches.length;
      i++
    ) {
      if (touches[i].id === trackedFingerId) {
        stillDown = true;
        break;
      }
    }

    if (!stillDown) {
      trackedFingerId = null;
      fingerHeld = false;
      scoopState = "waiting";
      gesture = null;
      lastFilteredX = null;
      lastMotionAt = 0;
      motionSpeedX = 0;
    }
  }

  fingerHeld = trackedFingerId !== null;
  touchesWereEmpty = empty;
}

function mousePressed() {
  updateFinger();
  return false;
}

function mouseReleased() {
  updateFinger();
  return false;
}

// ========================================
// DEBUG INFORMATION
// ========================================

function drawDebug() {
  noStroke();
  fill(85, 92, 110);

  textSize(12);
  textAlign(LEFT, TOP);

  const x = Number.isFinite(rotationX)
    ? rotationX.toFixed(2)
    : "-";

  const y = Number.isFinite(rotationY)
    ? rotationY.toFixed(2)
    : "-";

  const top = 100;

  text("DISRUPT / V2C", 24, 55);

  text("rotationX " + x, 24, top);
  text("rotationY " + y, 24, top + 18);

  text(
    "finger " +
      (fingerHeld ? "down" : "up"),
    24,
    top + 36
  );

  text(
    "state " + scoopState,
    24,
    top + 54
  );

  text(
    "successful scoops " + totalScoops,
    24,
    top + 72
  );

  text(
    "floating fragments " +
      fragments.length,
    24,
    top + 90
  );

  text(
    "movement " +
      motionMagnitude.toFixed(2),
    24,
    top + 108
  );

  text(
    "shakes " + totalShakes,
    24,
    top + 126
  );

  const connected =
    typeof shareConnected !== "undefined" &&
    shareConnected;

  text(
    connected
      ? "Shared display: connected"
      : "Shared display: waiting",
    24,
    top + 144
  );

  textAlign(CENTER, CENTER);
}

// ========================================
// INSTRUCTIONS
// ========================================

function drawInstructions() {
  noStroke();
  fill(105, 110, 125);

  textSize(12);
  textAlign(CENTER, CENTER);

  text(
    "Scoop to release · Tilt to guide · Shake to scatter",
    width / 2,
    height - 35
  );
}

// ========================================
// RESIZE
// ========================================

function windowResized() {
  const oldW = width;
  const oldH = height;

  resizeCanvas(windowWidth, windowHeight);

  for (const f of fragments) {
    f.x *= width / oldW;
    f.y *= height / oldH;
  }

  if (sensorButton) {
    sensorButton.position(
      width / 2 - 100,
      height / 2 - 25
    );
  }
}
