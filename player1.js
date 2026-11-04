
/*
  SCOOP EVERYTHING
  Player 1 - V2C

  Multiple kaleidoscopes on a light background.

  Preserves V2B continuous scoop recognition:
  - Finger must remain held
  - Dip and reversal required
  - Multiple scoops without releasing
  - Cooldown and rearming

  Requires:
  p5.js 2.2.3
  p5.js compatibility 0.2.0
  p5-phone 1.15.2
*/

// ========================================
// SCOOP CONFIGURATION - UNCHANGED
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
// COLOURS
// ========================================

const PALETTE = [
  [217, 167, 160], // Soft peach
  [169, 196, 196], // Pale teal
  [199, 180, 219], // Lavender
  [227, 197, 162], // Warm sand
  [155, 170, 205], // Muted blue
  [238, 230, 223], // Warm white
  [177, 159, 193]  // Dusty purple
];

const INK = [52, 59, 77];

const MAX_KALEIDOSCOPES = 24;

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

// Artwork

let kaleidoscopes = [];
let nextKaleidoscopeId = 1;

// Research

let researchOn = false;
let researchRows = [];
let researchPanel = null;
let researchSession = 0;
let researchCycle = 0;
let researchLastSample = 0;
let researchStartedAt = 0;

// ========================================
// SETUP
// ========================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  pixelDensity(1);
  frameRate(60);

  // p5-phone manages window.sensorsEnabled.
  // Do not redeclare that variable.

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
    "background",
    "#343B4D"
  );

  sensorButton.style("color", "#FFFFFF");
  sensorButton.style("border", "none");
  sensorButton.style("border-radius", "28px");
  sensorButton.style("font-size", "13px");

  enableSensorOn("#enable-sensors");
  lockGestures();

  setupResearchPanel();

  textAlign(CENTER, CENTER);
}

// ========================================
// MAIN DRAW LOOP
// ========================================

function draw() {
  drawLightBackground();

  if (!window.sensorsEnabled) {
    fill(...INK);
    noStroke();
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

  // Preserve V2B interaction order.

  updateFinger();
  updateScoopGesture();
  recordResearchSample();

  // Draw all accumulated kaleidoscopes.

  for (const k of kaleidoscopes) {
    updateKaleidoscope(k);
    drawKaleidoscope(k);
  }

  if (kaleidoscopes.length === 0) {
    fill(95, 102, 120);
    noStroke();
    textSize(17);
    textAlign(CENTER, CENTER);

    text(
      "Hold + Scoop!",
      width / 2,
      height * 0.65
    );
  }

  drawDebugReadout();
  drawBottomInstruction();
}

// ========================================
// LIGHT BACKGROUND
// ========================================

function drawLightBackground() {
  background(233, 234, 240);

  noStroke();

  // Gentle translucent atmospheric layers.

  fill(255, 255, 255, 65);
  ellipse(
    width * 0.1,
    height * 0.1,
    width * 1.2,
    height * 0.8
  );

  fill(217, 195, 220, 28);
  ellipse(
    width * 0.85,
    height * 0.45,
    width * 0.95,
    height * 0.8
  );

  fill(177, 194, 218, 24);
  ellipse(
    width * 0.15,
    height * 0.95,
    width * 0.9,
    height * 0.65
  );
}

// ========================================
// CONTINUOUS SCOOP DETECTION
// V2B LOGIC PRESERVED
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
    researchEvent("hold_started");

    return;
  }

  const g = gesture;

  // READY

  if (scoopState === "ready") {
    g.maxX = Math.max(
      g.maxX,
      filtered
    );

    g.baseline = g.maxX;

    if (
      g.maxX - filtered >= SCOOP.dip
    ) {
      g.minX = filtered;
      g.start = now;

      scoopState = "dipped";
      researchEvent("dip_detected");
    }
  }

  // DIPPED

  else if (scoopState === "dipped") {
    g.minX = Math.min(
      g.minX,
      filtered
    );

    if (
      now - g.start > SCOOP.maxMs
    ) {
      researchEvent(
        "dip_timeout",
        "incomplete"
      );

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
      researchCycle++;

      researchEvent(
        "scoop_success",
        "recognized"
      );

      g.reversalPeak = filtered;
      scoopState = "rearm";
    }
  }

  // REARM

  else if (scoopState === "rearm") {
    g.reversalPeak = Math.max(
      g.reversalPeak,
      filtered
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
        researchEvent("dip_detected");
      } else {
        scoopState = "ready";
        researchEvent("rearmed");
      }
    }
  }
}

// ========================================
// SCOOP SUCCESS
// ========================================

function addScoop() {
  totalScoops++;

  const k = createKaleidoscope();

  kaleidoscopes.push(k);

  // Limit rendering load on phones.
  // Oldest artwork is removed first.

  if (
    kaleidoscopes.length >
    MAX_KALEIDOSCOPES
  ) {
    kaleidoscopes.shift();
  }
}

// ========================================
// CREATE A NEW KALEIDOSCOPE
// ========================================

function createKaleidoscope() {
  const shortest = min(width, height);

  // Different sizes for each scoop.

  const radius = random(
    shortest * 0.10,
    shortest * 0.25
  );

  // Keep most of each circle on screen.

  const margin = radius * 0.65;

  const x = random(
    margin,
    max(margin, width - margin)
  );

  const y = random(
    margin + 65,
    max(margin + 65, height - margin - 50)
  );

  const sections = floor(random(5, 9));

  const colors = [];

  for (let i = 0; i < 4; i++) {
    const choice = random(PALETTE);
    colors.push([...choice]);
  }

  const fragments = [];

  const fragmentCount = floor(
    random(5, 11)
  );

  for (
    let i = 0;
    i < fragmentCount;
    i++
  ) {
    fragments.push({
      distance: random(0.18, 0.95),
      offset: random(-0.15, 0.15),
      size: random(0.08, 0.27),
      rotation: random(-0.7, 0.7),
      phase: random(TWO_PI),
      type: floor(random(4)),
      colorIndex: floor(random(4))
    });
  }

  return {
    id: nextKaleidoscopeId++,

    x,
    y,
    homeX: x,
    homeY: y,

    radius,
    sections,
    colors,
    fragments,

    rotation: random(TWO_PI),

    rotationSpeed:
      random(0.0015, 0.006) *
      random([-1, 1]),

    phase: random(TWO_PI),

    driftX: random(4, 18),
    driftY: random(4, 18),

    driftSpeedX: random(
      0.002,
      0.006
    ),

    driftSpeedY: random(
      0.002,
      0.006
    ),

    breathSpeed: random(
      0.008,
      0.02
    ),

    opacity: 0,
    createdAt: millis()
  };
}

// ========================================
// ANIMATE KALEIDOSCOPE
// ========================================

function updateKaleidoscope(k) {
  const t = frameCount;

  k.rotation += k.rotationSpeed;

  k.x =
    k.homeX +
    sin(
      t * k.driftSpeedX +
      k.phase
    ) * k.driftX;

  k.y =
    k.homeY +
    cos(
      t * k.driftSpeedY +
      k.phase
    ) * k.driftY;

  k.opacity = min(
    1,
    k.opacity + 0.035
  );
}

// ========================================
// DRAW KALEIDOSCOPE
// ========================================

function drawKaleidoscope(k) {
  push();

  translate(k.x, k.y);

  const breathing =
    1 +
    sin(
      frameCount * k.breathSpeed +
      k.phase
    ) * 0.045;

  scale(breathing);

  rotate(k.rotation);

  // Soft atmospheric circle.

  noStroke();

  const glow = k.colors[0];

  fill(
    glow[0],
    glow[1],
    glow[2],
    13 * k.opacity
  );

  circle(
    0,
    0,
    k.radius * 2.4
  );

  // Repeated mirrored sections.

  for (
    let section = 0;
    section < k.sections;
    section++
  ) {
    push();

    rotate(
      section *
      TWO_PI /
      k.sections
    );

    drawFragmentGroup(k);

    scale(1, -1);
    drawFragmentGroup(k);

    pop();
  }

  // Delicate centre.

  noFill();

  stroke(
    k.colors[1][0],
    k.colors[1][1],
    k.colors[1][2],
    65 * k.opacity
  );

  strokeWeight(0.8);

  circle(
    0,
    0,
    k.radius * 0.26
  );

  noStroke();

  fill(
    255,
    255,
    255,
    175 * k.opacity
  );

  circle(
    0,
    0,
    k.radius * 0.055
  );

  pop();
}

// ========================================
// DRAW FRAGMENT GROUP
// ========================================

function drawFragmentGroup(k) {
  for (
    const f of k.fragments
  ) {
    push();

    const drift =
      sin(
        frameCount * 0.007 +
        f.phase
      ) * k.radius * 0.025;

    translate(
      k.radius * f.distance + drift,
      k.radius * f.offset
    );

    rotate(
      f.rotation +
      sin(
        frameCount * 0.003 +
        f.phase
      ) * 0.08
    );

    const size =
      k.radius * f.size;

    const c =
      k.colors[f.colorIndex];

    drawGlassFragment(
      f.type,
      size,
      c,
      k.opacity
    );

    pop();
  }
}

// ========================================
// DRAW INDIVIDUAL FRAGMENTS
// ========================================

function drawGlassFragment(
  type,
  s,
  c,
  opacity
) {
  const alpha =
    110 * opacity;

  fill(
    c[0],
    c[1],
    c[2],
    alpha
  );

  stroke(
    min(255, c[0] + 30),
    min(255, c[1] + 30),
    min(255, c[2] + 30),
    150 * opacity
  );

  strokeWeight(0.7);

  if (type === 0) {
    beginShape();

    vertex(-s * 0.5, -s * 0.1);
    vertex(-s * 0.2, -s * 0.48);
    vertex(s * 0.45, -s * 0.2);
    vertex(s * 0.35, s * 0.35);
    vertex(-s * 0.25, s * 0.3);

    endShape(CLOSE);
  }

  else if (type === 1) {
    rectMode(CENTER);

    rect(
      0,
      0,
      s * 0.9,
      s * 0.5,
      s * 0.08
    );
  }

  else if (type === 2) {
    triangle(
      -s * 0.5,
      s * 0.3,

      0,
      -s * 0.5,

      s * 0.5,
      s * 0.3
    );
  }

  else {
    ellipse(
      0,
      0,
      s * 0.75,
      s * 0.75
    );
  }

  // Small translucent highlight.

  noStroke();

  fill(
    255,
    255,
    255,
    55 * opacity
  );

  circle(
    -s * 0.12,
    -s * 0.12,
    s * 0.15
  );
}

// ========================================
// FINGER TRACKING - V2B PRESERVED
// ========================================

function updateFinger() {
  const empty =
    touches.length === 0;

  if (
    trackedFingerId === null
  ) {
    if (
      !empty &&
      touchesWereEmpty
    ) {
      trackedFingerId =
        touches[0].id;

      fingerHeld = true;
      researchSession++;

      researchEvent(
        "finger_down"
      );
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
      researchEvent(
        "finger_released"
      );

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

// ========================================
// TOUCH CALLBACKS
// ========================================

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

function drawDebugReadout() {
  fill(85, 92, 110);
  noStroke();

  textSize(12);
  textAlign(LEFT, TOP);

  const xText =
    Number.isFinite(rotationX)
      ? rotationX.toFixed(2)
      : "-";

  const yText =
    Number.isFinite(rotationY)
      ? rotationY.toFixed(2)
      : "-";

  text(
    "rotationX " + xText,
    12,
    12
  );

  text(
    "rotationY " + yText,
    12,
    30
  );

  text(
    "finger " +
    (fingerHeld ? "down" : "up") +
    "  id " +
    (
      trackedFingerId === null
        ? "-"
        : trackedFingerId
    ),
    12,
    48
  );

  text(
    "state " + scoopState,
    12,
    66
  );

  text(
    "successful scoops " +
    totalScoops,
    12,
    84
  );

  text(
    "visible kaleidoscopes " +
    kaleidoscopes.length,
    12,
    102
  );

  textAlign(CENTER, CENTER);
}

// ========================================
// BOTTOM INSTRUCTION
// ========================================

function drawBottomInstruction() {
  fill(105, 110, 125, 200);
  noStroke();

  textSize(12);
  textAlign(CENTER, CENTER);

  text(
    "Hold your finger and scoop to create",
    width / 2,
    height - 48
  );

  text(
    "a new kaleidoscope",
    width / 2,
    height - 30
  );
}

// ========================================
// WINDOW RESIZE
// ========================================

function windowResized() {
  const oldWidth = width;
  const oldHeight = height;

  resizeCanvas(
    windowWidth,
    windowHeight
  );

  // Keep existing artwork in
  // approximately the same positions.

  for (const k of kaleidoscopes) {
    k.homeX *= width / oldWidth;
    k.homeY *= height / oldHeight;

    k.x *= width / oldWidth;
    k.y *= height / oldHeight;
  }

  if (sensorButton) {
    sensorButton.position(
      width / 2 - 100,
      height / 2 - 25
    );
  }
}

// ========================================
// RESEARCH PANEL
// ========================================

function setupResearchPanel() {
  researchPanel =
    document.createElement("div");

  researchPanel.style.cssText =
    "position:fixed;" +
    "right:8px;" +
    "top:8px;" +
    "z-index:9999;" +
    "display:flex;" +
    "flex-direction:column;" +
    "gap:5px;" +
    "align-items:flex-end;" +
    "font:12px system-ui,sans-serif";

  function makeButton(label, fn) {
    const b =
      document.createElement("button");

    b.textContent = label;

    b.style.cssText =
      "font:12px system-ui;" +
      "padding:8px;" +
      "border:1px solid #aaa;" +
      "border-radius:7px;" +
      "background:white;" +
      "color:#111;" +
      "touch-action:manipulation";

    for (
      const type of [
        "pointerdown",
        "touchstart",
        "touchend",
        "mousedown"
      ]
    ) {
      b.addEventListener(
        type,
        e => e.stopPropagation(),
        { passive: true }
      );
    }

    b.addEventListener(
      "click",
      e => {
        e.stopPropagation();
        fn(b);
      }
    );

    researchPanel.appendChild(b);
    return b;
  }

  makeButton(
    "Start recording",
    b => {
      if (researchOn) {
        researchEvent(
          "recording_stopped"
        );

        researchOn = false;

        b.textContent =
          "Start recording";
      } else {
        if (!window.sensorsEnabled) {
          alert(
            "Enable motion sensors first."
          );
          return;
        }

        researchOn = true;
        researchStartedAt =
          performance.now();

        researchLastSample = 0;

        b.textContent =
          "Stop recording";

        researchEvent(
          "recording_started"
        );
      }
    }
  );

  makeButton(
    "Export CSV",
    exportResearchCSV
  );

  makeButton(
    "Clear data",
    () => {
      if (
        confirm(
          "Delete recorded data on this page?"
        )
      ) {
        researchRows = [];
        researchCycle = 0;
        researchSession = 0;
      }
    }
  );

  document.body.appendChild(
    researchPanel
  );
}

// ========================================
// RESEARCH EVENT
// ========================================

function researchEvent(
  eventName,
  outcome = ""
) {
  if (!researchOn) {
    return;
  }

  researchRows.push(
    researchRow(
      "event",
      eventName,
      outcome
    )
  );
}

// ========================================
// RESEARCH ROW
// ========================================

function researchRow(
  kind,
  event = "",
  outcome = ""
) {
  return {
    kind,

    session: researchSession,
    cycle: researchCycle,

    ms: Math.round(
      performance.now() -
      researchStartedAt
    ),

    x: rotationX,
    y: rotationY,

    z:
      typeof rotationZ === "number"
        ? rotationZ
        : "",

    finger:
      fingerHeld ? 1 : 0,

    state: scoopState,
    event,
    outcome,

    speedX: motionSpeedX,

    baselineX:
      gesture
        ? gesture.baseline
        : "",

    minX:
      gesture
        ? gesture.minX
        : "",

    totalScoops
  };
}

// ========================================
// RECORD MOTION SAMPLES
// ========================================

function recordResearchSample() {
  if (
    !researchOn ||
    !window.sensorsEnabled
  ) {
    return;
  }

  const now = performance.now();

  if (
    now - researchLastSample < 50
  ) {
    return;
  }

  researchLastSample = now;

  researchRows.push(
    researchRow("sample")
  );
}

// ========================================
// EXPORT CSV
// ========================================

function exportResearchCSV() {
  if (!researchRows.length) {
    alert(
      "No research data recorded yet."
    );
    return;
  }

  const columns = [
    "kind",
    "session",
    "cycle",
    "ms",
    "x",
    "y",
    "z",
    "finger",
    "state",
    "event",
    "outcome",
    "speedX",
    "baselineX",
    "minX",
    "totalScoops"
  ];

  const csv = [
    columns.join(","),

    ...researchRows.map(
      row =>
        columns.map(
          key =>
            '"' +
            String(
              row[key] ?? ""
            ).replace(
              /"/g,
              '""'
            ) +
            '"'
        ).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(
    [csv],
    {
      type:
        "text/csv;charset=utf-8"
    }
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;

  link.download =
    "scoop-player1-v2c-" +
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-") +
    ".csv";

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}
