
/*
 SCOOP EVERYTHING — CREATE V2C
 Scoop to Build — Layered Kaleidoscopes + Shared Display
*/

const SCOOP = {
  dip: 0.30,
  reversal: 0.15,
  rearm: 0.12,
  minMs: 140,
  maxMs: 4500,
  cooldownMs: 320,
  smoothing: 0.25
};

const ART = {
  background: [233, 234, 240],
  maxLayers: 24,
  newestOpacity: 1,
  oldestOpacity: 0.06,
  fadeLayers: 10,
  appearMs: 650,
  transitionMs: 850,
  minRadius: 0.12,
  maxRadius: 0.23
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

const SHARE_HOST =
  "https://p5-phone-share.npuckett.workers.dev";
const SHARE_ROOM = "scoop-everything-v2c";
const SHARE_APP = "scoop-everything";

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

let kaleidoscopes = [];
let nextArtworkId = 1;

let researchOn = false;
let researchRows = [];
let researchPanel = null;
let researchSession = 0;
let researchCycle = 0;
let researchLastSample = 0;
let researchStartedAt = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  sensorButton = createButton("Enable Motion Sensors");
  sensorButton.id("enable-sensors");
  sensorButton.position(width / 2 - 100, height / 2 - 25);
  sensorButton.size(200, 50);
  sensorButton.style("background", "#343B4D");
  sensorButton.style("color", "#FFFFFF");
  sensorButton.style("border", "none");
  sensorButton.style("border-radius", "25px");
  sensorButton.style("font-size", "13px");

  enableSensorOn("#enable-sensors");
  lockGestures();

  shareSetup({
    host: SHARE_HOST,
    room: SHARE_ROOM,
    app: SHARE_APP,
    me: { name: "CREATE", role: 1 }
  });

  setupResearchPanel();
  textAlign(CENTER, CENTER);
}

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

  if (sensorButton) sensorButton.hide();

  updateFinger();
  updateScoopGesture();
  recordResearchSample();
  drawAllKaleidoscopes();

  if (kaleidoscopes.length === 0) {
    noStroke();
    fill(100, 106, 123);
    textSize(18);
    textAlign(CENTER, CENTER);
    text("CREATE — Hold + Scoop!", width / 2, height * 0.62);
  }

  drawDebugReadout();
  drawInstruction();
}

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
    : previous + SCOOP.smoothing * (x - previous);

  motionSpeedX =
    dt > 0.005 && dt < 0.25 && previous !== null
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

  if (scoopState === "ready") {
    g.maxX = Math.max(g.maxX, filtered);
    g.baseline = g.maxX;

    if (g.maxX - filtered >= SCOOP.dip) {
      g.minX = filtered;
      g.start = now;
      scoopState = "dipped";
      researchEvent("dip_detected");
    }
  } else if (scoopState === "dipped") {
    g.minX = Math.min(g.minX, filtered);

    if (now - g.start > SCOOP.maxMs) {
      researchEvent("dip_timeout", "incomplete");
      g.maxX = filtered;
      g.baseline = filtered;
      g.minX = filtered;
      scoopState = "ready";
    } else if (
      filtered - g.minX >= SCOOP.reversal &&
      now - g.start >= SCOOP.minMs &&
      motionSpeedX > 0.03 &&
      now - g.lastSuccess >= SCOOP.cooldownMs
    ) {
      addScoop();

      g.lastSuccess = now;
      g.cycle++;
      researchCycle++;

      researchEvent("scoop_success", "recognized");

      g.reversalPeak = filtered;
      scoopState = "rearm";
    }
  } else if (scoopState === "rearm") {
    g.reversalPeak = Math.max(g.reversalPeak, filtered);

    if (
      now - g.lastSuccess >= SCOOP.cooldownMs &&
      g.reversalPeak - filtered >= SCOOP.rearm
    ) {
      g.maxX = g.reversalPeak;
      g.baseline = g.maxX;
      g.minX = filtered;
      g.start = now;

      if (g.maxX - filtered >= SCOOP.dip) {
        scoopState = "dipped";
        researchEvent("dip_detected");
      } else {
        scoopState = "ready";
        researchEvent("rearmed");
      }
    }
  }
}

function addScoop() {
  totalScoops++;
  const now = millis();

  for (const k of kaleidoscopes) {
    k.opacityFrom = k.opacity;
    k.opacityTo = max(
      ART.oldestOpacity,
      k.opacityTo -
        (ART.newestOpacity - ART.oldestOpacity) /
          ART.fadeLayers
    );
    k.transitionStartedAt = now;
  }

  const newArtwork = createKaleidoscope();
  kaleidoscopes.push(newArtwork);

  if (kaleidoscopes.length > ART.maxLayers) {
    kaleidoscopes.shift();
  }

  // Send one event for this successful scoop.
  // Coordinates and dimensions are normalized for
  // different screen sizes.
  if (
    typeof shareConnected !== "undefined" &&
    shareConnected
  ) {
    shareEmit("scoop", {
      player: 1,
      mode: "create",
      artwork: {
        x: newArtwork.x / width,
        y: newArtwork.y / height,
        radius:
          newArtwork.radius / Math.min(width, height),
        sections: newArtwork.sections,
        colors: newArtwork.colors,
        fragments: newArtwork.fragments,
        rotation: newArtwork.rotation,
        rotationSpeed: newArtwork.rotationSpeed,
        phase: newArtwork.phase,
        driftX: newArtwork.driftX / width,
        driftY: newArtwork.driftY / height,
        driftSpeedX: newArtwork.driftSpeedX,
        driftSpeedY: newArtwork.driftSpeedY,
        breathSpeed: newArtwork.breathSpeed
      }
    });
  }
}

function createKaleidoscope() {
  const shortest = min(width, height);
  const radius = random(
    shortest * ART.minRadius,
    shortest * ART.maxRadius
  );

  const margin = radius * 0.6;
  const left = margin;
  const right = max(left, width - margin);
  const top = margin + 115;
  const bottom = max(top, height - margin - 65);

  const x = random(left, right);
  const y = random(top, bottom);
  const colors = [];

  for (let i = 0; i < 4; i++) {
    colors.push([...random(PALETTE)]);
  }

  const fragments = [];
  const count = floor(random(6, 11));

  for (let i = 0; i < count; i++) {
    fragments.push({
      distance: random(0.22, 0.95),
      offset: random(-0.13, 0.13),
      size: random(0.09, 0.23),
      rotation: random(-0.7, 0.7),
      phase: random(TWO_PI),
      type: floor(random(4)),
      colorIndex: floor(random(4))
    });
  }

  return {
    id: nextArtworkId++,
    x,
    y,
    homeX: x,
    homeY: y,
    radius,
    sections: floor(random(5, 9)),
    colors,
    fragments,
    rotation: random(TWO_PI),
    rotationSpeed:
      random(0.001, 0.004) * random([-1, 1]),
    phase: random(TWO_PI),
    driftX: random(3, 10),
    driftY: random(3, 10),
    driftSpeedX: random(0.0015, 0.004),
    driftSpeedY: random(0.0015, 0.004),
    breathSpeed: random(0.006, 0.014),
    opacity: 0,
    opacityFrom: 0,
    opacityTo: ART.newestOpacity,
    createdAt: millis(),
    transitionStartedAt: millis()
  };
}

function smoothFade(t) {
  t = constrain(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function updateArtworkOpacity(k) {
  const now = millis();
  const isNew =
    k.opacityFrom === 0 &&
    k.opacityTo === ART.newestOpacity;

  const duration = isNew
    ? ART.appearMs
    : ART.transitionMs;

  const progress = smoothFade(
    (now - k.transitionStartedAt) / duration
  );

  k.opacity = lerp(
    k.opacityFrom,
    k.opacityTo,
    progress
  );
}

function drawAllKaleidoscopes() {
  const count = kaleidoscopes.length;

  for (let i = 0; i < count; i++) {
    const k = kaleidoscopes[i];
    updateArtworkOpacity(k);

    const age = count - 1 - i;
    const ageProgress = constrain(
      age / ART.fadeLayers,
      0,
      1
    );
    const speedMultiplier = lerp(
      1,
      0.2,
      ageProgress
    );

    k.rotation +=
      k.rotationSpeed * speedMultiplier;

    const t = frameCount;

    const x =
      k.homeX +
      sin(t * k.driftSpeedX + k.phase) *
        k.driftX;

    const y =
      k.homeY +
      cos(t * k.driftSpeedY + k.phase) *
        k.driftY;

    drawKaleidoscope(k, x, y, k.opacity);
  }
}

function drawKaleidoscope(k, x, y, opacity) {
  push();
  translate(x, y);

  const breathing =
    1 +
    sin(
      frameCount * k.breathSpeed + k.phase
    ) * 0.035;

  scale(breathing);
  rotate(k.rotation);

  const glow = k.colors[0];
  noStroke();
  fill(
    glow[0],
    glow[1],
    glow[2],
    12 * opacity
  );
  circle(0, 0, k.radius * 2.25);

  for (
    let section = 0;
    section < k.sections;
    section++
  ) {
    push();
    rotate(
      section * TWO_PI / k.sections
    );
    drawFragmentGroup(k, opacity);
    scale(1, -1);
    drawFragmentGroup(k, opacity);
    pop();
  }

  noFill();
  stroke(
    k.colors[1][0],
    k.colors[1][1],
    k.colors[1][2],
    70 * opacity
  );
  strokeWeight(0.8);
  circle(0, 0, k.radius * 0.25);

  noStroke();
  fill(255, 255, 255, 180 * opacity);
  circle(0, 0, k.radius * 0.06);
  pop();
}

function drawFragmentGroup(k, opacity) {
  for (const f of k.fragments) {
    push();

    const drift =
      sin(
        frameCount * 0.005 + f.phase
      ) * k.radius * 0.02;

    translate(
      k.radius * f.distance + drift,
      k.radius * f.offset
    );

    rotate(
      f.rotation +
        sin(
          frameCount * 0.002 + f.phase
        ) * 0.06
    );

    const size = k.radius * f.size;
    const c = k.colors[f.colorIndex];

    drawGlassFragment(
      f.type,
      size,
      c,
      opacity
    );
    pop();
  }
}

function drawGlassFragment(type, s, c, opacity) {
  fill(
    c[0],
    c[1],
    c[2],
    125 * opacity
  );

  stroke(
    min(255, c[0] + 25),
    min(255, c[1] + 25),
    min(255, c[2] + 25),
    145 * opacity
  );

  strokeWeight(0.7);

  if (type === 0) {
    beginShape();
    vertex(-s * 0.5, -s * 0.1);
    vertex(-s * 0.15, -s * 0.45);
    vertex(s * 0.48, -s * 0.18);
    vertex(s * 0.3, s * 0.38);
    vertex(-s * 0.3, s * 0.28);
    endShape(CLOSE);
  } else if (type === 1) {
    rectMode(CENTER);
    rect(
      0,
      0,
      s * 0.9,
      s * 0.5,
      s * 0.08
    );
  } else if (type === 2) {
    triangle(
      -s * 0.45,
      s * 0.3,
      0,
      -s * 0.48,
      s * 0.45,
      s * 0.3
    );
  } else {
    circle(0, 0, s * 0.7);
  }

  noStroke();
  fill(255, 255, 255, 55 * opacity);
  circle(
    -s * 0.12,
    -s * 0.12,
    s * 0.14
  );
}

function updateFinger() {
  const empty = touches.length === 0;

  if (trackedFingerId === null) {
    if (!empty && touchesWereEmpty) {
      trackedFingerId = touches[0].id;
      fingerHeld = true;
      researchSession++;
      researchEvent("finger_down");
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
      researchEvent("finger_released");
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

function drawDebugReadout() {
  push();
  noStroke();
  fill(85, 92, 110);
  textSize(12);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);

  const debugX = 24;
  const debugY = 105;
  const lineHeight = 19;

  const xText = Number.isFinite(rotationX)
    ? rotationX.toFixed(2)
    : "-";

  const yText = Number.isFinite(rotationY)
    ? rotationY.toFixed(2)
    : "-";

  const lines = [
    "rotationX " + xText,
    "rotationY " + yText,
    "finger " +
      (fingerHeld ? "down" : "up") +
      "  id " +
      (trackedFingerId === null
        ? "-"
        : trackedFingerId),
    "state " + scoopState,
    "successful scoops " + totalScoops,
    "visible layers " + kaleidoscopes.length
  ];

  for (let i = 0; i < lines.length; i++) {
    text(
      lines[i],
      debugX,
      debugY + lineHeight * i
    );
  }

  pop();
}

function drawInstruction() {
  noStroke();
  fill(105, 110, 125);
  textSize(12);
  textAlign(CENTER, CENTER);

  text(
    "CREATE — Hold + Scoop to add a new layer",
    width / 2,
    height - 38
  );
}

function windowResized() {
  const oldWidth = width;
  const oldHeight = height;

  resizeCanvas(windowWidth, windowHeight);

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
  researchPanel = document.createElement("div");

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
    const b = document.createElement("button");
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

    b.addEventListener("click", e => {
      e.stopPropagation();
      fn(b);
    });

    researchPanel.appendChild(b);
    return b;
  }

  makeButton("Start recording", b => {
    if (researchOn) {
      researchEvent("recording_stopped");
      researchOn = false;
      b.textContent = "Start recording";
    } else {
      if (!window.sensorsEnabled) {
        alert("Enable motion sensors first.");
        return;
      }

      researchOn = true;
      researchStartedAt = performance.now();
      researchLastSample = 0;
      b.textContent = "Stop recording";
      researchEvent("recording_started");
    }
  });

  makeButton("Export CSV", exportResearchCSV);

  makeButton("Clear data", () => {
    if (confirm("Delete recorded data on this page?")) {
      researchRows = [];
      researchCycle = 0;
      researchSession = 0;
    }
  });

  document.body.appendChild(researchPanel);
}

function researchEvent(eventName, outcome = "") {
  if (!researchOn) return;

  researchRows.push(
    researchRow("event", eventName, outcome)
  );
}

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
      performance.now() - researchStartedAt
    ),
    x: rotationX,
    y: rotationY,
    z:
      typeof rotationZ === "number"
        ? rotationZ
        : "",
    finger: fingerHeld ? 1 : 0,
    state: scoopState,
    event,
    outcome,
    speedX: motionSpeedX,
    baselineX: gesture
      ? gesture.baseline
      : "",
    minX: gesture
      ? gesture.minX
      : "",
    totalScoops
  };
}

function recordResearchSample() {
  if (!researchOn || !window.sensorsEnabled) {
    return;
  }

  const now = performance.now();

  if (now - researchLastSample < 50) {
    return;
  }

  researchLastSample = now;
  researchRows.push(researchRow("sample"));
}

function exportResearchCSV() {
  if (!researchRows.length) {
    alert("No research data recorded yet.");
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
        String(row[key] ?? "").replace(/"/g, '""') +
        '"'
      ).join(",")
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
    "scoop-create-v2c-" +
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-") +
    ".csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
