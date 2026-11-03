
/*
 * SCOOP EVERYTHING
 * Continuous Scoop Research — V3
 *
 * One finger may stay on the screen for
 * multiple consecutive scoops.
 *
 * Requires:
 * - p5.js
 * - p5-phone 1.15.2
 *
 * CSV research data is kept in memory
 * until exported or the page is closed.
 */

// ========================================
// CONFIGURATION
// ========================================

const SCOOP = {
  // Relative angular movement in radians.
  dip: 0.30,

  // Required return movement after a dip.
  reversal: 0.15,

  // Required new downward movement to
  // rearm after a successful scoop.
  rearm: 0.12,

  // Minimum time between dip and reversal.
  minMs: 140,

  // Maximum time allowed for a scoop.
  maxMs: 4500,

  // Prevent multiple counts from one scoop.
  cooldownMs: 320,

  // Motion smoothing: 0 to 1.
  smoothing: 0.25
};

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

// Research variables.
let researchOn = false;
let researchRows = [];
let researchPanel = null;
let researchSession = 0;
let researchCycle = 0;
let researchLastSample = 0;
let researchStartedAt = 0;

// Artwork variables.
let artworkActive = false;
let fragments = [];
let rotationNow = 0;
let spreadNow = 1;

// ========================================
// SETUP
// ========================================

function setup() {
  createCanvas(windowWidth, windowHeight);

  // p5-phone uses window.sensorsEnabled.
  // Do not redeclare sensorsEnabled.

  sensorButton = createButton(
    "Enable Motion Sensors"
  );

  sensorButton.id("enable-sensors");

  sensorButton.position(
    width / 2 - 90,
    height / 2 - 25
  );

  sensorButton.size(180, 50);

  enableSensorOn("#enable-sensors");
  lockGestures();

  createFragments();
  setupResearchPanel();

  textAlign(CENTER, CENTER);
}

// ========================================
// MAIN DRAW LOOP
// ========================================

function draw() {
  background(14, 14, 15);

  if (!window.sensorsEnabled) {
    fill(240);
    noStroke();
    textSize(18);
    textAlign(CENTER, CENTER);

    text(
      "Tap the button to start",
      width / 2,
      height / 2 - 70
    );

    return;
  }

  if (sensorButton) {
    sensorButton.hide();
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
    textAlign(CENTER, CENTER);

    text(
      "Hold + Scoop!",
      width / 2,
      height - 50
    );
  }

  drawDebugReadout();
}

// ========================================
// CONTINUOUS SCOOP DETECTION
// ========================================

function updateScoopGesture() {
  const now = performance.now();
  const x = rotationX;

  if (!Number.isFinite(x)) {
    return;
  }

  // Finger release ends the current hold.
  // It is NOT required between scoops.

  if (!fingerHeld) {
    gesture = null;
    scoopState = "waiting";
    lastFilteredX = null;
    lastMotionAt = 0;
    motionSpeedX = 0;
    return;
  }

  // Smooth the X-axis rotation.

  const dt = lastMotionAt
    ? (now - lastMotionAt) / 1000
    : 0;

  const previous = lastFilteredX;

  const filtered = previous === null
    ? x
    : previous +
      SCOOP.smoothing * (x - previous);

  // Approximate angular velocity.
  // This is derived from rotationX,
  // not a raw gyroscope measurement.

  motionSpeedX =
    dt > 0.005 &&
    dt < 0.25 &&
    previous !== null
      ? (filtered - previous) / dt
      : 0;

  lastFilteredX = filtered;
  lastMotionAt = now;

  // Create a gesture only once per
  // continuous finger hold.

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

  // ------------------------------------
  // READY
  // Track a local high point, then dip.
  // ------------------------------------

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

  // ------------------------------------
  // DIPPED
  // Track the low point and reversal.
  // ------------------------------------

  else if (scoopState === "dipped") {
    g.minX = Math.min(
      g.minX,
      filtered
    );

    // If a movement is abandoned,
    // restart from the current position.

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

    // A scoop succeeds when the phone
    // reverses sufficiently after dipping.

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

      // Do not require returning to
      // the original starting angle.

      g.reversalPeak = filtered;

      scoopState = "rearm";
    }
  }

  // ------------------------------------
  // REARM
  // Wait for a fresh downward movement.
  // ------------------------------------

  else if (scoopState === "rearm") {
    // Track the local high point
    // after the previous scoop.

    g.reversalPeak = Math.max(
      g.reversalPeak,
      filtered
    );

    // A new downward movement indicates
    // that the player has begun another
    // scoop, even if the finger remains
    // on the screen.

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
        g.maxX - filtered >=
          SCOOP.dip
      ) {
        scoopState = "dipped";

        researchEvent(
          "dip_detected"
        );
      } else {
        scoopState = "ready";

        researchEvent(
          "rearmed"
        );
      }
    }
  }
}

// ========================================
// SCOOP SUCCESS
// ========================================

function addScoop() {
  totalScoops++;

  artworkActive = true;

  // Create a new visual composition.
  createFragments();

  rotationNow = 0;
  spreadNow = 1;
}

// ========================================
// GENERATE KALEIDOSCOPE FRAGMENTS
// ========================================

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

// ========================================
// DRAW KALEIDOSCOPE
// ========================================

function drawArtwork() {
  let targetRotation = rotationNow;
  let targetSpread = spreadNow;

  // When the finger is lifted,
  // phone tilting manipulates the artwork.
  //
  // When the finger is held,
  // motion is used for scoop recognition.

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

  for (
    let i = 0;
    i < sections;
    i++
  ) {
    push();

    rotate(
      i * (TWO_PI / sections) +
      rotationNow
    );

    drawFragmentGroup(i);

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

// ========================================
// DRAW FRAGMENT GROUP
// ========================================

function drawFragmentGroup(section) {
  const maxRadius =
    min(width, height) * 0.38;

  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {
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

// ========================================
// DRAW INDIVIDUAL FRAGMENTS
// ========================================

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
    // Translucent white glass.

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
    // Smoke-coloured glass.

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
    // Circular fragment.

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

// ========================================
// DRAW BACKGROUND ATMOSPHERE
// ========================================

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

// ========================================
// DRAW CENTRAL VOID
// ========================================

function drawVoid() {
  push();

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

  stroke(
    186, 91, 45, 150
  );

  circle(
    0,
    0,
    70
  );

  noStroke();

  fill(
    10, 10, 11
  );

  circle(
    0,
    0,
    48
  );

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

// ========================================
// FINGER TRACKING
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
// LIVE DEBUG INFORMATION
// ========================================

function drawDebugReadout() {
  fill(240);
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
    (
      fingerHeld
        ? "down"
        : "up"
    ) +
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

// ========================================
// WINDOW RESIZE
// ========================================

function windowResized() {
  resizeCanvas(
    windowWidth,
    windowHeight
  );

  if (sensorButton) {
    sensorButton.position(
      width / 2 - 90,
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

  function makeButton(
    label,
    fn
  ) {
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

    // Prevent research-panel touches
    // from interfering with the game.

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

  // ------------------------------------
  // START / STOP
  // ------------------------------------

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
      }

      else {
        if (
          !window.sensorsEnabled
        ) {
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

  // ------------------------------------
  // EXPORT CSV
  // ------------------------------------

  makeButton(
    "Export CSV",
    exportResearchCSV
  );

  // ------------------------------------
  // CLEAR DATA
  // ------------------------------------

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
      typeof rotationZ ===
      "number"
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
// RESEARCH MOTION SAMPLES
// ========================================

function recordResearchSample() {
  if (
    !researchOn ||
    !window.sensorsEnabled
  ) {
    return;
  }

  const now = performance.now();

  // About 20 samples per second.

  if (
    now - researchLastSample <
    50
  ) {
    return;
  }

  researchLastSample = now;

  researchRows.push(
    researchRow(
      "sample"
    )
  );
}

// ========================================
// EXPORT RESEARCH CSV
// ========================================

function exportResearchCSV() {
  if (
    !researchRows.length
  ) {
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
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href = url;

  link.download =
    "scoop-continuous-v3-" +
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      ) +
    ".csv";

  document.body.appendChild(
    link
  );

  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}
