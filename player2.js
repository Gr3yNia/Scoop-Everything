
/*
  SCOOP EVERYTHING — PLAYER 2 V2C

  Scoop: creates 3 floating glass fragments
  Tilt: guides all fragments across the screen
  Shake: temporarily increases their movement

  Uses the same scoop recognition thresholds
  as Player 1.

  Player 2 remains independent from Player 1.
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
// ARTWORK SETTINGS
// ========================================

const ART = {
  background: [233, 234, 240],

  fragmentsPerScoop: 3,
  maxFragments: 45,

  minSize: 24,
  maxSize: 72,

  tiltStrength: 0.12,
  friction: 0.94,
  maxSpeed: 2.8,

  shakeThreshold: 3.5,
  shakeBoost: 2.6,
  shakeCooldown: 500,

  appearMs: 650
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

let fragments = [];
let nextFragmentId = 1;

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
// MAIN LOOP
// ========================================

function draw() {
  background(...ART.background);

  if (!window.sensorsEnabled) {
    noStroke();
    fill(52, 59, 77);
    textSize(17);

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
// SAME THRESHOLDS AS PLAYER 1
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
// CREATE FRAGMENTS WITH EACH SCOOP
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
// FRAGMENT CREATION
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

    vx: random(-0.4, 0.4),
    vy: random(-0.4, 0.4),

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
// TILT MOVEMENT
// ========================================

function updateFragment(f) {
  // Phone tilt steers the fragments.
  // Clamp values to prevent wild motion.

  const tiltX = Number.isFinite(rotationY)
    ? constrain(rotationY, -0.8, 0.8)
    : 0;

  const tiltY = Number.isFinite(rotationX)
    ? constrain(rotationX, -0.8, 0.8)
    : 0;

  const accelerationX =
    tiltX * ART.tiltStrength;

  const accelerationY =
    tiltY * ART.tiltStrength;

  // Slight individual floating movement.

  const floatingX =
    sin(
      frameCount * 0.012 +
      f.phase
    ) * 0.012;

  const floatingY =
    cos(
      frameCount * 0.01 +
      f.phase
    ) * 0.012;

  f.vx += accelerationX + floatingX;
  f.vy += accelerationY + floatingY;

  f.vx *= ART.friction;
  f.vy *= ART.friction;

  // Shake adds temporary energy,
  // but speed always remains capped.

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

  f.rotation +=
    f.rotationSpeed *
    (1 + shakeEnergy);

  // Soft bounce at the boundaries.

  const margin = f.size * 0.5;

  if (f.x < margin) {
    f.x = margin;
    f.vx = abs(f.vx) * 0.45;
  }

  if (f.x > width - margin) {
    f.x = width - margin;
    f.vx = -abs(f.vx) * 0.45;
  }

  if (f.y < 130) {
    f.y = 130;
    f.vy = abs(f.vy) * 0.45;
  }

  if (f.y > height - 65) {
    f.y = height - 65;
    f.vy = -abs(f.vy) * 0.45;
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

  // Gradually return to normal.
  shakeEnergy *= 0.94;

  if (shakeEnergy < 0.005) {
    shakeEnergy = 0;
  }
}

function triggerShake() {
  shakeEnergy = 1;

  for (const f of fragments) {
    f.vx += random(-2.2, 2.2);
    f.vy += random(-2.2, 2.2);
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

  const breathing =
    1 +
    sin(
      frameCount * 0.018 +
      f.phase
    ) * 0.06;

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

  // Main glass fragment.

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

  // Translucent highlight.

  noStroke();

  fill(
    255,
    255,
    255,
    80 * appear
  );

  ellipse(
    -s * 0.12,
    -s * 0.12,
    s * 0.12
  );

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

  text("rotationX " + x, 12, 12);
  text("rotationY " + y, 12, 30);

  text(
    "finger " +
    (fingerHeld ? "down" : "up"),
    12, 48
  );

  text(
    "state " + scoopState,
    12, 66
  );

  text(
    "successful scoops " +
    totalScoops,
    12, 84
  );

  text(
    "floating fragments " +
    fragments.length,
    12, 102
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
    "Scoop to create · Tilt to guide · Shake to scatter",
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
