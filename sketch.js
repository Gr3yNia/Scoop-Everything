
// ==========================================
// SCOOP EVERYTHING
// Phase 2 — Gesture Research Prototype
// p5.js 2.2.3 + p5-phone 1.15.2
// ==========================================

// SENSOR PERMISSION
let button;

// TOUCH TRACKING
let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;

// SCOOP RECOGNITION
// Keep original tested thresholds.
let scoopTrigger = -0.7;
let resetTrigger = -0.3;

let scoopState = "waiting";
let totalScoops = 0;

// KALEIDOSCOPE
let artworkActive = false;
let fragments = [];
let rotationNow = 0;
let spreadNow = 1;

// RESEARCH
let researchOn = false;
let researchRows = [];
let researchAttempt = null;
let researchAttemptNumber = 0;
let researchLastSample = 0;
let researchLastX = null;
let researchLastT = null;
let researchPanel;

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

  // Keep radians for existing thresholds.
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

  if (button) button.hide();

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
// SCOOP RECOGNITION
// ==========================================
// waiting -> ready -> dipped -> complete
//
// Finger must stay down throughout.
// A new scoop requires finger release.
// ==========================================

function updateScoopGesture() {

  if (!fingerHeld) {

    scoopState = "waiting";
    return;
  }

  // CLEAN START
  if (scoopState === "waiting") {

    if (rotationX > resetTrigger) {

      scoopState = "ready";
      researchTransition("ready");
    }

    return;
  }

  // DIP
  if (scoopState === "ready") {

    if (rotationX < scoopTrigger) {

      scoopState = "dipped";
      researchTransition("dipped");
    }

    return;
  }

  // RETURN
  if (scoopState === "dipped") {

    if (rotationX > resetTrigger) {

      addScoop();

      scoopState = "complete";
      researchTransition("success");
    }

    return;
  }

  // COMPLETE:
  // Wait for finger release.
}

// ==========================================
// SUCCESSFUL SCOOP
// ==========================================

function addScoop() {

  totalScoops++;

  artworkActive = true;

  // One scoop generates one new artwork.
  createFragments();

  rotationNow = 0;
  spreadNow = 1;
}

// ==========================================
// CREATE KALEIDOSCOPE FRAGMENTS
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

  // Finger up: move artwork with phone.
  // Finger down: hold artwork and scoop.

  if (!fingerHeld) {

    // Left/right tilt rotates artwork.
    targetRotation = constrain(
      rotationY * 0.45,
      -0.45,
      0.45
    );

    // Forward/back tilt changes spread.
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

    drawFragmentGroup();

    // Mirrored fragments
    scale(1, -1);

    drawFragmentGroup();

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

function drawFragmentGroup() {

  const maxRadius =
    min(width, height) * 0.38;

  for (let i = 0; i < fragments.length; i++) {

    const f = fragments[i];

    push();

    const radius =
      maxRadius *
      f.distance *
      spreadNow;

    const drift = sin(
      frameCount * 0.003 + f.phase
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

    // Burnt orange glass
    fill(186, 91, 45, 115);
    stroke(226, 146, 100, 150);

    beginShape();

    vertex(-s * 0.50, -s * 0.10);
    vertex(-s * 0.15, -s * 0.45);
    vertex(s * 0.48, -s * 0.18);
    vertex(s * 0.30, s * 0.38);
    vertex(-s * 0.30, s * 0.28);

    endShape(CLOSE);

  } else if (type === 1) {

    // Warm translucent white
    fill(218, 214, 202, 55);
    stroke(240, 236, 222, 110);

    beginShape();

    vertex(-s * 0.48, 0);
    vertex(-s * 0.12, -s * 0.32);
    vertex(s * 0.46, -s * 0.16);
    vertex(s * 0.28, s * 0.28);
    vertex(-s * 0.28, s * 0.38);

    endShape(CLOSE);

  } else if (type === 2) {

    // Smoke glass
    fill(78, 75, 72, 125);
    stroke(155, 150, 140, 80);

    triangle(
      -s * 0.45,
      s * 0.30,
      0,
      -s * 0.48,
      s * 0.45,
      s * 0.30
    );

  } else {

    // Circular fragment
    fill(205, 181, 145, 75);
    stroke(230, 214, 190, 100);

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

  for (let d = 400; d > 20; d -= 25) {

    const a = map(
      d, 400, 20, 0, 10
    );

    fill(220, 205, 180, a);

    circle(0, 0, d);
  }
}

// ==========================================
// CENTRAL VOID
// ==========================================

function drawVoid() {

  push();

  noFill();

  stroke(220, 211, 195, 70);
  strokeWeight(1);
  circle(0, 0, 105);

  stroke(186, 91, 45, 150);
  circle(0, 0, 70);

  noStroke();
  fill(10, 10, 11);
  circle(0, 0, 48);

  fill(225, 214, 195);
  circle(0, 0, 5);

  pop();
}

// ==========================================
// TOUCH TRACKING
// ==========================================

function updateFinger() {

  const empty = touches.length === 0;

  if (trackedFingerId === null) {

    // Only adopt a NEW touch.
    if (!empty && touchesWereEmpty) {

      trackedFingerId = touches[0].id;

      fingerHeld = true;

      researchStartAttempt();
    }

  } else {

    let stillDown = false;

    for (let i = 0; i < touches.length; i++) {

      if (touches[i].id === trackedFingerId) {

        stillDown = true;
        break;
      }
    }

    if (!stillDown) {

      // Record the last state before reset.
      researchFinishAttempt();

      trackedFingerId = null;
      fingerHeld = false;
      scoopState = "waiting";
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
// DEBUG DISPLAY
// ==========================================

function drawDebugReadout() {

  fill(240);
  noStroke();

  textSize(12);
  textAlign(LEFT, TOP);

  text(
    "rotationX " + rotationX.toFixed(2),
    12, 12
  );

  text(
    "rotationY " + rotationY.toFixed(2),
    12, 30
  );

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
    "successful scoops " + totalScoops,
    12, 84
  );

  textAlign(CENTER, CENTER);
}

// ==========================================
// RESEARCH CONTROL PANEL
// ==========================================

function setupResearchPanel() {

  researchPanel = document.createElement("div");

  researchPanel.style.cssText = `
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 5px;
    align-items: flex-end;
    font: 12px system-ui, sans-serif;
  `;

  function makeButton(label, callback) {

    const b = document.createElement("button");

    b.textContent = label;

    b.style.cssText = `
      padding: 8px;
      border: 1px solid #aaa;
      border-radius: 7px;
      background: white;
      color: #111;
      font: 12px system-ui;
      touch-action: manipulation;
    `;

    // Prevent button touches from
    // entering the p5 scoop gesture.
    b.addEventListener("pointerdown", e => {
      e.stopPropagation();
    });

    b.addEventListener("click", e => {
      e.stopPropagation();
      callback(b);
    });

    researchPanel.appendChild(b);

    return b;
  }

  // START / STOP RECORDING

  makeButton("Start recording", b => {

    if (researchOn) {

      researchFinishAttempt();
      researchOn = false;

      b.textContent = "Start recording";

    } else {

      if (!window.sensorsEnabled) {

        alert("Enable motion sensors first.");
        return;
      }

      researchOn = true;

      researchLastSample = 0;
      researchLastT = null;
      researchLastX = null;

      b.textContent = "Stop recording";
    }
  });

  // EXPORT CSV

  makeButton("Export CSV", () => {

    exportResearchCSV();
  });

  // CLEAR DATA

  makeButton("Clear data", () => {

    if (confirm("Delete recorded data?")) {

      researchRows = [];
      researchAttempt = null;
      researchAttemptNumber = 0;
    }
  });

  document.body.appendChild(researchPanel);
}

// ==========================================
// START ONE ATTEMPT
// ==========================================

function researchStartAttempt() {

  if (!researchOn) return;

  researchAttemptNumber++;

  researchLastT = null;
  researchLastX = null;

  const x = Number.isFinite(rotationX)
    ? rotationX
    : null;

  researchAttempt = {

    id: researchAttemptNumber,

    start: performance.now(),

    minX: x,
    maxX: x,

    ready: false,
    dipped: false,
    success: false
  };

  researchEvent("touch_start");
}

// ==========================================
// RECOGNITION EVENTS
// ==========================================

function researchTransition(eventName) {

  if (!researchOn || !researchAttempt) return;

  if (eventName === "ready") {
    researchAttempt.ready = true;
  }

  if (eventName === "dipped") {
    researchAttempt.dipped = true;
  }

  if (eventName === "success") {
    researchAttempt.success = true;
  }

  researchEvent(eventName);
}

// ==========================================
// FINISH ATTEMPT
// ==========================================

function researchFinishAttempt() {

  if (!researchAttempt) return;

  const a = researchAttempt;

  let outcome;

  if (a.success) {

    outcome = "recognized";

  } else if (a.dipped) {

    outcome = "dipped_no_return";

  } else if (a.ready) {

    outcome = "not_deep_enough";

  } else {

    outcome = "invalid_start";
  }

  researchEvent("touch_end", outcome);

  researchAttempt = null;
}

// ==========================================
// RECORD EVENT
// ==========================================

function researchEvent(eventName, outcome = "") {

  if (!researchOn || !researchAttempt) return;

  const a = researchAttempt;

  researchRows.push({

    kind: "event",

    attempt: a.id,

    ms: Math.round(
      performance.now() - a.start
    ),

    x: rotationX,
    y: rotationY,

    z: typeof rotationZ === "number"
      ? rotationZ
      : "",

    finger: fingerHeld ? 1 : 0,

    state: scoopState,

    event: eventName,
    outcome: outcome,

    speedX: "",

    minX: a.minX,
    maxX: a.maxX
  });
}

// ==========================================
// SAMPLE PHONE MOVEMENT
// ==========================================

function recordResearchSample() {

  if (
    !researchOn ||
    !researchAttempt ||
    !window.sensorsEnabled
  ) {
    return;
  }

  const now = performance.now();

  // Target approximately 20 Hz.
  if (now - researchLastSample < 50) {
    return;
  }

  researchLastSample = now;

  const x = rotationX;

  if (!Number.isFinite(x)) return;

  const a = researchAttempt;

  a.minX = Math.min(a.minX ?? x, x);
  a.maxX = Math.max(a.maxX ?? x, x);

  // Angular change per second.
  const speedX =
    researchLastT === null
      ? ""
      : (x - researchLastX) /
        ((now - researchLastT) / 1000);

  researchLastT = now;
  researchLastX = x;

  researchRows.push({

    kind: "sample",

    attempt: a.id,

    ms: Math.round(now - a.start),

    x: x,
    y: rotationY,

    z: typeof rotationZ === "number"
      ? rotationZ
      : "",

    finger: fingerHeld ? 1 : 0,

    state: scoopState,

    event: "",
    outcome: "",

    speedX: speedX,

    minX: a.minX,
    maxX: a.maxX
  });
}

// ==========================================
// EXPORT CSV
// ==========================================

function exportResearchCSV() {

  if (researchRows.length === 0) {

    alert("No research data recorded yet.");
    return;
  }

  const columns = [

    "kind",
    "attempt",
    "ms",
    "x",
    "y",
    "z",
    "finger",
    "state",
    "event",
    "outcome",
    "speedX",
    "minX",
    "maxX"
  ];

  const csv = [

    columns.join(","),

    ...researchRows.map(row =>

      columns.map(key => {

        const value = row[key] ?? "";

        return '"' +
          String(value).replace(/"/g, '""') +
          '"';

      }).join(",")

    )

  ].join("\r\n");

  const blob = new Blob(
    [csv],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download =
    "scoop-gesture-" +
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-") +
    ".csv";

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==========================================
// RESIZE
// ==========================================

function windowResized() {

  resizeCanvas(windowWidth, windowHeight);

  if (button) {

    button.position(
      width / 2 - 90,
      height / 2 - 25
    );
  }
}
