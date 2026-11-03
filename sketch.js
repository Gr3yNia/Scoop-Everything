
// ==========================================
// SCOOP EVERYTHING
// Continuous Scoop Research — Version 2
// ==========================================

// p5-phone controls window.sensorsEnabled.
// Do not declare another sensorsEnabled variable.

let button;

// ==========================================
// FINGER TRACKING
// ==========================================

let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;

// ==========================================
// CONTINUOUS SCOOP RECOGNITION
// ==========================================

// Experimental thresholds in radians.
// These will be adjusted using research data.

const SCOOP = {
  dip: 0.30,
  reversal: 0.15,
  rearm: 0.12,
  minMs: 140,
  maxMs: 4500,
  cooldownMs: 320,
  smoothing: 0.25
};

let scoopState = "waiting";
let totalScoops = 0;

let gesture = null;

let lastMotionAt = 0;
let lastFilteredX = null;
let motionSpeedX = 0;

// ==========================================
// RESEARCH DATA
// ==========================================

let researchOn = false;
let researchRows = [];
let researchPanel;

let researchSession = 0;
let researchCycle = 0;

let researchLastSample = 0;
let researchStartedAt = 0;

// ==========================================
// ARTWORK
// ==========================================

let artworkActive = false;
let fragments = [];

let rotationNow = 0;
let spreadNow = 1;

// ==========================================
// SETUP
// ==========================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  textAlign(CENTER, CENTER);

  button = createButton("Enable Motion Sensors");
  button.id("enable-sensors");

  button.position(
    width / 2 - 90,
    height / 2 - 25
  );

  button.size(180, 50);

  enableSensorOn("#enable-sensors");
  lockGestures();

  // Keep p5's default angle mode (radians).

  createFragments();
  setupResearchPanel();
}

// ==========================================
// DRAW
// ==========================================

function draw() {
  background(14, 14, 15);

  if (!window.sensorsEnabled) {
    fill(240);
    noStroke();
    textSize(18);

    text(
      "Tap the button to start",
      width / 2,
      height / 2 - 70
    );

    return;
  }

  if (button) {
    button.hide();
  }

  updateFinger();
  updateScoopGesture();
  recordResearchSample();

  if (artworkActive) {
    drawArtwork();
  } else {
    fill(225);
    noStroke();
    textSize(18);

    text(
      "Hold + Scoop!",
      width / 2,
      height - 50
    );
  }

  drawDebugReadout();
}

// ==========================================
// CONTINUOUS SCOOP DETECTOR
// ==========================================

function updateScoopGesture() {
  const now = performance.now();
  const x = rotationX;

  if (!Number.isFinite(x)) {
    return;
  }

  // Finger release ends the current hold,
  // but is not required between scoops.

  if (!fingerHeld) {
    if (gesture) {
      researchEvent("finger_up");
    }

    gesture = null;
    scoopState = "waiting";
    lastFilteredX = null;
    lastMotionAt = 0;
    motionSpeedX = 0;

    return;
  }

  // Smooth X rotation to reduce sensor noise.

  const dt = lastMotionAt
    ? (now - lastMotionAt) / 1000
    : 0;

  const previous = lastFilteredX;

  const filtered = previous === null
    ? x
    : previous + SCOOP.smoothing * (x - previous);

  // Approximate angular velocity.

  motionSpeedX =
    dt > 0.005 &&
    dt < 0.25 &&
    previous !== null
      ? (filtered - previous) / dt
      : 0;

  lastFilteredX = filtered;
  lastMotionAt = now;

  // First frame of a continuous finger hold.

  if (!gesture) {
    gesture = {
      baseline: filtered,
      minX: filtered,
      start: now,
      lastSuccess: -Infinity,
      cycle: 0
    };

    scoopState = "ready";
    researchEvent("hold_started");
  }

  const g = gesture;

  // --------------------------------------
  // READY
  // --------------------------------------

  if (scoopState === "ready") {

    // Slowly adjust the resting baseline
    // when the phone is nearly stationary.

    if (Math.abs(motionSpeedX) < 0.13) {
      g.baseline +=
        0.015 * (filtered - g.baseline);
    }

    // Allow a higher resting angle.

    if (filtered > g.baseline) {
      g.baseline = filtered;
    }

    // Detect downward motion relative
    // to the player's starting angle.

    if (
      g.baseline - filtered >= SCOOP.dip &&
      now - g.lastSuccess >= SCOOP.cooldownMs
    ) {
      g.minX = filtered;
      g.start = now;

      scoopState = "dipped";

      researchEvent("dip_detected");
    }
  }

  // --------------------------------------
  // DIPPED
  // --------------------------------------

  else if (scoopState === "dipped") {

    // Track the deepest point.

    g.minX = Math.min(g.minX, filtered);

    // Cancel an abandoned movement.

    if (now - g.start > SCOOP.maxMs) {
      researchEvent(
        "dip_timeout",
        "incomplete"
      );

      scoopState = "rearm";
    }

    // Detect reversal toward the
    // original starting position.

    else if (
      filtered - g.minX >= SCOOP.reversal &&
      now - g.start >= SCOOP.minMs &&
      motionSpeedX > 0.03
    ) {
      addScoop();

      g.lastSuccess = now;
      g.cycle++;

      researchCycle++;

      researchEvent(
        "scoop_success",
        "recognized"
      );

      // Do not immediately recognize
      // another scoop.

      scoopState = "rearm";
    }
  }

  // --------------------------------------
  // REARM
  // --------------------------------------

  else if (scoopState === "rearm") {

    // The finger stays on the screen.
    //
    // The phone must return close to
    // its starting angle before the
    // next scoop can begin.

    if (
      filtered >= g.baseline - SCOOP.rearm &&
      now - g.lastSuccess >= SCOOP.cooldownMs
    ) {
      g.baseline = filtered;
      g.minX = filtered;

      scoopState = "ready";

      researchEvent("rearmed");
    }
  }
}

// ==========================================
// ADD ONE SCOOP
// ==========================================

function addScoop() {
  totalScoops++;

  artworkActive = true;

  // Generate a new artwork for each scoop.

  createFragments();

  rotationNow = 0;
  spreadNow = 1;
}

// ==========================================
// CREATE FRAGMENTS
// ==========================================

function createFragments() {
  fragments = [];

  for (let i = 0; i < 12; i++) {
    fragments.push({
      distance: random(0.25, 1),
      size: random(25, 85),
      offset: random(-28, 28),

      rotation: radians(
        random(-25, 25)
      ),

      phase: radians(
        random(360)
      ),

      type: floor(random(4))
    });
  }
}

// ==========================================
// DRAW KALEIDOSCOPE
// ==========================================

function drawArtwork() {
  let targetRotation = rotationNow;
  let targetSpread = spreadNow;

  // When the finger is lifted,
  // tilting controls the artwork.
  //
  // When the finger is held,
  // the scoop detector takes over.

  if (!fingerHeld) {
    targetRotation = constrain(
      rotationY * 0.45,
      -0.45,
      0.45
    );

    targetSpread = map(
      rotationX,
      -0.6,
      0.6,
      1.45,
      0.55,
      true
    );
  }

  rotationNow = lerp(
    rotationNow,
    targetRotation,
    0.08
  );

  spreadNow = lerp(
    spreadNow,
    targetSpread,
    0.08
  );

  push();

  translate(
    width / 2,
    height / 2
  );

  drawAtmosphere();

  const sections = 6;

  for (let i = 0; i < sections; i++) {
    push();

    rotate(
      i * (TWO_PI / sections) +
      rotationNow
    );

    drawFragmentGroup(i);

    // Mirrored fragments.

    scale(1, -1);
    drawFragmentGroup(i);

    pop();
  }

  drawVoid();

  pop();

  fill(240, 220);
  noStroke();
  textSize(14);
  textAlign(CENTER, CENTER);

  text(
    "Move your phone to reveal the magic of the kaleidoscope.",
    width / 2,
    height - 45
  );
}

// ==========================================
// FRAGMENT GROUP
// ==========================================

function drawFragmentGroup(section) {
  const maxRadius =
    min(width, height) * 0.38;

  for (let i = 0; i < fragments.length; i++) {
    const f = fragments[i];

    push();

    const radius =
      maxRadius *
      f.distance *
      spreadNow;

    const drift =
      sin(
        frameCount * 0.003 +
        f.phase
      ) * 4;

    translate(
      radius + drift,
      f.offset
    );

    rotate(
      f.rotation +
      rotationNow * 0.25
    );

    drawFragment(
      f.type,
      f.size
    );

    pop();
  }
}

// ==========================================
// FRAGMENT SHAPES
// ==========================================

function drawFragment(type, s) {
  strokeWeight(0.8);

  if (type === 0) {

    // Burnt orange glass.

    fill(
      186, 91, 45, 115
    );

    stroke(
      226, 146, 100, 150
    );

    beginShape();

    vertex(
      -s * 0.50,
      -s * 0.10
    );

    vertex(
      -s * 0.15,
      -s * 0.45
    );

    vertex(
      s * 0.48,
      -s * 0.18
    );

    vertex(
      s * 0.30,
      s * 0.38
    );

    vertex(
      -s * 0.30,
      s * 0.28
    );

    endShape(CLOSE);
  }

  else if (type === 1) {

    // Warm translucent white.

    fill(
      218, 214, 202, 55
    );

    stroke(
      240, 236, 222, 110
    );

    beginShape();

    vertex(
      -s * 0.48,
      0
    );

    vertex(
      -s * 0.12,
      -s * 0.32
    );

    vertex(
      s * 0.46,
      -s * 0.16
    );

    vertex(
      s * 0.28,
      s * 0.28
    );

    vertex(
      -s * 0.28,
      s * 0.38
    );

    endShape(CLOSE);
  }

  else if (type === 2) {

    // Smoke glass.

    fill(
      78, 75, 72, 125
    );

    stroke(
      155, 150, 140, 80
    );

    triangle(
      -s * 0.45,
      s * 0.30,

      0,
      -s * 0.48,

      s * 0.45,
      s * 0.30
    );
  }

  else {

    // Small circular fragment.

    fill(
      205, 181, 145, 75
    );

    stroke(
      230, 214, 190, 100
    );

    circle(
      0,
      0,
      s * 0.55
    );
  }
}

// ==========================================
// BACKGROUND ATMOSPHERE
// ==========================================

function drawAtmosphere() {
  noStroke();

  for (
    let d = 400;
    d > 20;
    d -= 25
  ) {
    const a = map(
      d,
      400,
      20,
      0,
      10
    );

    fill(
      220,
      205,
      180,
      a
    );

    circle(
      0,
      0,
      d
    );
  }
}

// ==========================================
// CENTRAL VOID
// ==========================================

function drawVoid() {
  push();

  // Outer circle.

  noFill();

  stroke(
    220, 211, 195, 70
  );

  strokeWeight(1);

  circle(
    0,
    0,
    105
  );

  // Orange inner circle.

  stroke(
    186, 91, 45, 150
  );

  circle(
    0,
    0,
    70
  );

  // Dark centre.

  noStroke();

  fill(
    10, 10, 11
  );

  circle(
    0,
    0,
    48
  );

  // Tiny central point.

  fill(
    225, 214, 195
  );

  circle(
    0,
    0,
    5
  );

  pop();
}

// ==========================================
// FINGER TRACKING
// ==========================================

function updateFinger() {
  const empty = touches.length === 0;

  if (trackedFingerId === null) {

    if (!empty && touchesWereEmpty) {
      trackedFingerId = touches[0].id;
      fingerHeld = true;

      researchSession++;

      researchEvent("finger_down");
    }
  }

  else {
    let stillDown = false;

    for (let i = 0; i < touches.length; i++) {
      if (
        touches[i].id === trackedFingerId
      ) {
        stillDown = true;
        break;
      }
    }

    if (!stillDown) {
      researchEvent("finger_released");

      trackedFingerId = null;
      fingerHeld = false;

      scoopState = "waiting";
      gesture = null;
      lastFilteredX = null;
    }
  }

  fingerHeld = trackedFingerId !== null;
  touchesWereEmpty = empty;
}

// ==========================================
// TOUCH CALLBACKS
// ==========================================

function mousePressed() {
  updateFinger();
  return false;
}

function mouseReleased() {
  updateFinger();
  return false;
}

// ==========================================
// DEBUG INFORMATION
// ==========================================

function drawDebugReadout() {
  fill(240);
  noStroke();

  textSize(12);
  textAlign(LEFT, TOP);

  text(
    "rotationX " +
    rotationX.toFixed(2),
    12,
    12
  );

  text(
    "rotationY " +
    rotationY.toFixed(2),
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

  textAlign(CENTER, CENTER);
}

// ==========================================
// WINDOW RESIZE
// ==========================================

function windowResized() {
  resizeCanvas(
    windowWidth,
    windowHeight
  );

  if (button) {
    button.position(
      width / 2 - 90,
      height / 2 - 25
    );
  }
}

// ==========================================
// RESEARCH PANEL
// ==========================================

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

    for (const type of [
      "pointerdown",
      "touchstart",
      "touchend",
      "mousedown"
    ]) {
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

  // --------------------------------------
  // START / STOP RECORDING
  // --------------------------------------

  makeButton(
    "Start recording",
    b => {
      if (researchOn) {
        researchEvent("recording_stopped");

        researchOn = false;

        b.textContent =
          "Start recording";
      }

      else {
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

  // --------------------------------------
  // EXPORT CSV
  // --------------------------------------

  makeButton(
    "Export CSV",
    exportResearchCSV
  );

  // --------------------------------------
  // CLEAR RESEARCH DATA
  // --------------------------------------

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

// ==========================================
// RECORD RESEARCH EVENT
// ==========================================

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

// ==========================================
// CREATE RESEARCH ROW
// ==========================================

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

// ==========================================
// RECORD MOTION SAMPLES
// ==========================================

function recordResearchSample() {
  if (
    !researchOn ||
    !window.sensorsEnabled
  ) {
    return;
  }

  const now = performance.now();

  // Approximately 20 samples per second.

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

// ==========================================
// EXPORT RESEARCH CSV
// ==========================================

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

    ...researchRows.map(row =>
      columns.map(key =>
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
    "scoop-continuous-" +
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-") +
    ".csv";

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    1000
  );
}
