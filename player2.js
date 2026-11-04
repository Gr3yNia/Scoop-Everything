
/*
  SCOOP EVERYTHING — PLAYER 2 V2C
  Floating Glass Fragments

  SCOOP  → Create 3 fragments
  MOVE   → Guide fragments
  STILL  → Settle and breathe
  SHAKE  → Scatter temporarily

  Keeps Player 1's scoop recognition thresholds.
*/

// ========================================
// SCOOP CONFIGURATION
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
// ARTWORK CONFIGURATION
// ========================================

const ART = {
  background: [233, 234, 240],

  fragmentsPerScoop: 3,
  maxFragments: 45,

  minSize: 24,
  maxSize: 72,

  // Movement responsiveness.
  movementStrength: 13,

  // Smaller value = quicker settling.
  friction: 0.78,

  maxSpeed: 5.5,

  // Ignore very small sensor fluctuations.
  motionDeadzone: 0.008,

  // Shake settings.
  shakeThreshold: 3.5,
  shakeBoost: 3.0,
  shakeCooldown: 500,

  // Appearance.
  appearMs: 650,
  breathingAmount: 0.055,
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

// Fragments.
let fragments = [];
let nextFragmentId = 1;

// Motion tracking.
let previousTiltX = null;
let previousTiltY = null;

let smoothedTiltX = null;
let smoothedTiltY = null;

let motionX = 0;
let motionY = 0;

// Shake tracking.
let lastShakeAt = 0;
let shakeEnergy = 0;
let previousAcceleration = null;

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

  sensorButton.style(
    "background", "#343B4D"
  );

  sensorButton.style(
    "color", "#FFFFFF"
  );

  sensorButton.style(
    "border", "none"
  );

  sensorButton.style(
    "border-radius", "25px"
  );

  sensorButton.style(
    "font-size", "13px"
  );

  enableSensorOn("#enable-sensors");
  lockGestures();

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

  if (fragments.length === 0) {
    noStroke();
    fill(100, 106, 123);
    textSize(18);

    text(
      "Hold + Scoop!",
      width / 2,
      height * 0.62
    );
  }

  drawDebug();
  drawInstructions();
}

// ========================================
// SCOOP DETECTION
// SAME AS PLAYER 1
// ========================================

function updateScoopGesture() {
  const now = performance.now();
  const x = rotationX;

  if (!Number.isFinite(x)) {
    return;
  }

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

  // READY
  if (scoopState === "ready") {
    g.maxX = Math.max(
      g.maxX, filtered
    );

    g.baseline = g.maxX;

    if (
      g.maxX - filtered >= SCOOP.dip
    ) {
      g.minX = filtered;
      g.start = now;
      scoopState = "dipped";
    }
  }

  // DIPPED
  else if (scoopState === "dipped") {
    g.minX = Math.min(
      g.minX, filtered
    );

    if (
      now - g.start > SCOOP.maxMs
    ) {
      g.maxX = filtered;
      g.baseline = filtered;
      g.minX = filtered;

      scoopState = "ready";
    }

    else if (
      filtered - g.minX >=
        SCOOP.reversal &&

      now - g.start >=
        SCOOP.minMs &&

      motionSpeedX > 0.03 &&

      now - g.lastSuccess >=
        SCOOP.cooldownMs
    ) {
      addScoop();

      g.lastSuccess = now;
      g.cycle++;

      g.reversalPeak = filtered;
      scoopState = "rearm";
    }
  }

  // REARM
  else if (scoopState === "rearm") {
    g.reversalPeak = Math.max(
      g.reversalPeak, filtered
    );

    if (
      now - g.lastSuccess >=
        SCOOP.cooldownMs &&

      g.reversalPeak - filtered >=
        SCOOP.rearm
    ) {
      g.maxX = g.reversalPeak;
      g.baseline = g.maxX;
      g.minX = filtered;
      g.start = now;

      if (
        g.maxX - filtered >= SCOOP.dip
      ) {
        scoopState = "dipped";
      } else {
        scoopState = "ready";
      }
    }
  }
}

// ========================================
// SCOOP SUCCESS
// ========================================

function addScoop() {
  totalScoops++;

  for (
    let i = 0;
    i < ART.fragmentsPerScoop;
    i++
  ) {
    fragments.push(
      createFragment()
    );
  }

  while (
    fragments.length >
    ART.maxFragments
  ) {
    fragments.shift();
  }
}

// ========================================
// CREATE FRAGMENT
// ========================================

function createFragment() {
  const size = random(
    ART.minSize,
    ART.maxSize
  );

  const margin = size * 0.7;

  return {
    id: nextFragmentId++,

    x: random(
      margin,
      max(margin, width - margin)
    ),

    y: random(
      145,
      max(146, height - 90)
    ),

    // Begin nearly still.
    vx: random(-0.15, 0.15),
    vy: random(-0.15, 0.15),

    // Each fragment moves differently.
    speedFactor: random(0.55, 1.8),

    size,

    rotation: random(TWO_PI),
    rotationSpeed: random(
      -0.008, 0.008
    ),

    color: [...random(PALETTE)],

    shape: floor(random(4)),

    phase: random(TWO_PI),

    createdAt: millis()
  };
}

// ========================================
// DETECT PHONE MOVEMENT
// ========================================

function updatePhoneMovement() {
  const rawX = rotationY;
  const rawY = rotationX;

  if (
    !Number.isFinite(rawX) ||
    !Number.isFinite(rawY)
  ) {
    motionX = 0;
    motionY = 0;
    return;
  }

  // Smooth sensor noise.
  const smoothing = 0.22;

  if (smoothedTiltX === null) {
    smoothedTiltX = rawX;
    smoothedTiltY = rawY;

    previousTiltX = rawX;
    previousTiltY = rawY;

    motionX = 0;
    motionY = 0;
    return;
  }

  smoothedTiltX +=
    (rawX - smoothedTiltX) *
    smoothing;

  smoothedTiltY +=
    (rawY - smoothedTiltY) *
    smoothing;

  // Calculate CHANGE in angle,
  // rather than the angle itself.

  const deltaX =
    smoothedTiltX -
    previousTiltX;

  const deltaY =
    smoothedTiltY -
    previousTiltY;

  previousTiltX = smoothedTiltX;
  previousTiltY = smoothedTiltY;

  // Ignore tiny sensor fluctuations.

  motionX =
    abs(deltaX) >
    ART.motionDeadzone
      ? deltaX
      : 0;

  motionY =
    abs(deltaY) >
    ART.motionDeadzone
      ? deltaY
      : 0;
}

// ========================================
// FRAGMENT MOVEMENT
// ========================================

function updateFragment(f) {
  // Individual response to phone movement.

  const accelerationX =
    motionX *
    ART.movementStrength *
    f.speedFactor;

  const accelerationY =
    motionY *
    ART.movementStrength *
    f.speedFactor;

  f.vx += accelerationX;
  f.vy += accelerationY;

  // Strong damping: fragments settle
  // when phone movement stops.

  f.vx *= ART.friction;
  f.vy *= ART.friction;

  // Stop tiny residual movement.

  if (abs(f.vx) < 0.025) {
    f.vx = 0;
  }

  if (abs(f.vy) < 0.025) {
    f.vy = 0;
  }

  const speedLimit =
    ART.maxSpeed +
    shakeEnergy * ART.shakeBoost;

  f.vx = constrain(
    f.vx,
    -speedLimit,
    speedLimit
  );

  f.vy = constrain(
    f.vy,
    -speedLimit,
    speedLimit
  );

  f.x += f.vx;
  f.y += f.vy;

  // Rotate only when moving.

  const movement = sqrt(
    f.vx * f.vx +
    f.vy * f.vy
  );

  if (movement > 0.08) {
    f.rotation +=
      f.rotationSpeed *
      movement *
      (1 + shakeEnergy);
  }

  // Boundaries.

  const margin = f.size * 0.5;

  if (f.x < margin) {
    f.x = margin;
    f.vx = abs(f.vx) * 0.35;
  }

  if (f.x > width - margin) {
    f.x = width - margin;
    f.vx = -abs(f.vx) * 0.35;
  }

  if (f.y < 130) {
    f.y = 130;
    f.vy = abs(f.vy) * 0.35;
  }

  if (f.y > height - 65) {
    f.y = height - 65;
    f.vy = -abs(f.vy) * 0.35;
  }
}

// ========================================
// SHAKE DETECTION
// ========================================

function updateShake() {
  const now = millis();

  const ax =
    typeof accelerationX === "number"
      ? accelerationX : 0;

  const ay =
    typeof accelerationY === "number"
      ? accelerationY : 0;

  const az =
    typeof accelerationZ === "number"
      ? accelerationZ : 0;

  const current = { ax, ay, az };

  if (previousAcceleration !== null) {
    const dx =
      current.ax -
      previousAcceleration.ax;

    const dy =
      current.ay -
      previousAcceleration.ay;

    const dz =
      current.az -
      previousAcceleration.az;

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
      triggerShake();
      lastShakeAt = now;
    }
  }

  previousAcceleration = current;

  // Shake energy fades naturally.

  shakeEnergy *= 0.90;

  if (shakeEnergy < 0.005) {
    shakeEnergy = 0;
  }
}

function triggerShake() {
  shakeEnergy = 1;

  for (const f of fragments) {
    f.vx += random(-3.2, 3.2);
    f.vy += random(-3.2, 3.2);
  }
}

// ========================================
// DRAW FRAGMENT
// ========================================

function drawFragment(f) {
  const appear = constrain(
    (millis() - f.createdAt) /
      ART.appearMs,
    0,
    1
  );

  const alpha = 165 * appear;

  push();

  translate(f.x, f.y);
  rotate(f.rotation);

  // Breathing in place.
  // No positional movement.

  const breathing =
    1 +
    sin(
      frameCount *
      ART.breathingSpeed +
      f.phase
    ) *
    ART.breathingAmount;

  scale(breathing);

  const c = f.color;
  const s = f.size;

  // Gentle shadow.

  noStroke();

  fill(
    c[0],
    c[1],
    c[2],
    22 * appear
  );

  ellipse(
    3, 5,
    s * 1.25,
    s * 0.85
  );

  // Translucent glass.

  fill(
    c[0],
    c[1],
    c[2],
    alpha
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

    rect(
      0, 0,
      s,
      s * 0.46,
      3
    );
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
      -s * 0.45,
      s * 0.3,

      0,
      -s * 0.45,

      s * 0.5,
      s * 0.25
    );
  }

  else {
    rectMode(CENTER);

    rect(
      0, 0,
      s * 0.5,
      s * 0.9,
      5
    );
  }

  // No white dots or touch handles.

  pop();
}

// ========================================
// FINGER TRACKING
// ========================================

function updateFinger() {
  const empty =
    touches.length === 0;

  if (trackedFingerId === null) {
    if (
      !empty &&
      touchesWereEmpty
    ) {
      trackedFingerId =
        touches[0].id;

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
      if (
        touches[i].id ===
        trackedFingerId
      ) {
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

  fingerHeld =
    trackedFingerId !== null;

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

  // Position below Player 02 label.
  const top = 100;

  text("rotationX " + x, 24, top);
  text("rotationY " + y, 24, top + 18);

  text(
    "finger " +
    (fingerHeld ? "down" : "up"),
    24, top + 36
  );

  text(
    "state " + scoopState,
    24, top + 54
  );

  text(
    "successful scoops " +
    totalScoops,
    24, top + 72
  );

  text(
    "floating fragments " +
    fragments.length,
    24, top + 90
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
    "Scoop to create · Move to guide · Shake to scatter",
    width / 2,
    height - 35
  );
}

// ========================================
// WINDOW RESIZE
// ========================================

function windowResized() {
  const oldW = width;
  const oldH = height;

  resizeCanvas(
    windowWidth,
    windowHeight
  );

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
