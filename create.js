
/*
  SCOOP EVERYTHING — CREATE V2C
  Complete create.js

  Includes:
  - Motion sensor permission
  - Ready / countdown / 30-second round
  - Original hold + scoop recognition
  - Layered, rotating kaleidoscopes
  - Circular artwork movement
  - Shared display synchronization
  - Artwork erasure with dissolve
  - Five-second recovery countdown
  - Gentle successful-scoop tones
  - Research recording and CSV export
*/

// ========================================
// CONFIGURATION
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

const ART = {
  background: [233, 234, 240],
  maxLayers: 24,
  newestOpacity: 1,
  oldestOpacity: 0.06,
  fadeLayers: 10,
  appearMs: 650,
  transitionMs: 850,
  eraseMs: 300,
  minRadius: 0.12,
  maxRadius: 0.23,
  orbitMin: 0.025,
  orbitMax: 0.09
};

const GAME = {
  roundMs: 30000,
  recoveryMs: 5000,
  countdownMs: 3000,
  soundVolume: 0.018
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

const CREATE_ID =
  "create-" +
  Math.random().toString(36).slice(2, 10);

// ========================================
// STATE
// ========================================

let sensorButton;
let sensorsReady = false;

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

let gamePhase = "lobby";
let playerReady = false;

let roundId = null;
let roundEndsAt = 0;
let countdownEndsAt = 0;
let recoveryEndsAt = 0;

let gameWinner = null;

let readyOverlay;
let readyButton;
let readyStatus;
let gameOverlay;

let audioContext = null;

let researchOn = false;
let researchRows = [];
let researchPanel;
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
  angleMode(RADIANS);

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

  shareSetup({
    host: SHARE_HOST,
    room: SHARE_ROOM,
    app: SHARE_APP,
    me: {
      name: "CREATE",
      role: 1,
      participantId: CREATE_ID
    }
  });

  setupReadyScreen();
  setupGameOverlay();
  setupResearchPanel();

  textAlign(CENTER, CENTER);
}

// ========================================
// MAIN DRAW
// ========================================

function draw() {
  background(...ART.background);

  const enabled =
    typeof sensorsEnabled !== "undefined"
      ? sensorsEnabled
      : window.sensorsEnabled;

  if (enabled) {
    sensorsReady = true;
  }

  if (!sensorsReady) {
    if (readyOverlay) {
      readyOverlay.style.display = "none";
    }

    noStroke();
    fill(52, 59, 77);
    textSize(17);
    textAlign(CENTER, CENTER);

    text(
      "Enable motion sensors to begin",
      width / 2,
      height / 2 - 75
    );

    return;
  }

  if (sensorButton) {
    sensorButton.hide();
  }

  if (
    gamePhase === "lobby" &&
    readyOverlay
  ) {
    readyOverlay.style.display = "flex";
  }

  updateFinger();

  if (gamePhase === "playing") {
    updateScoopGesture();
  } else {
    resetGestureWhenInactive();
  }

  recordResearchSample();
  drawAllKaleidoscopes();

  if (
    gamePhase === "playing" &&
    kaleidoscopes.length === 0
  ) {
    noStroke();
    fill(100, 106, 123);
    textSize(18);
    textAlign(CENTER, CENTER);

    text(
      "CREATE — Hold + Scoop!",
      width / 2,
      height * 0.62
    );
  }

  drawDebugReadout();
  drawInstruction();
  updateGameOverlay();

  // Repeat Ready periodically in case
  // the display connected after this phone.
  if (
    playerReady &&
    gamePhase === "lobby" &&
    frameCount % 60 === 0
  ) {
    sendReady();
  }
}

// ========================================
// READY SCREEN
// ========================================

function setupReadyScreen() {
  readyOverlay = document.createElement("div");

  readyOverlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:8000;
    background:#E9EAF0;
    display:none;
    align-items:center;
    justify-content:center;
    padding:24px;
    box-sizing:border-box;
    font-family:system-ui,sans-serif;
    color:#343B4D;
    text-align:center;
    overflow-y:auto;
  `;

  readyOverlay.innerHTML = `
    <div style="
      width:100%;
      max-width:390px;
      background:#F8F8FA;
      border-radius:24px;
      padding:30px 24px;
      box-sizing:border-box;
    ">

      <div style="
        font-size:11px;
        letter-spacing:2px;
        color:#85899A;
        margin-bottom:20px;
      ">
        SCOOP EVERYTHING / V2C
      </div>

      <div style="
        font-size:38px;
        margin-bottom:12px;
      ">
        ✦
      </div>

      <h1 style="
        font-size:30px;
        font-weight:400;
        margin:0 0 10px;
      ">
        CREATE
      </h1>

      <p style="
        font-size:13px;
        line-height:1.7;
        color:#74798A;
        margin-bottom:25px;
      ">
        Your role is to keep the artwork alive.
      </p>

      <div style="
        background:white;
        border-radius:16px;
        padding:20px;
        text-align:left;
        font-size:13px;
        line-height:1.8;
        margin-bottom:24px;
      ">
        <div>
          <b>01.</b>
          Hold your finger on the screen.
        </div>

        <div>
          <b>02.</b>
          Scoop your phone to create artwork.
        </div>

        <div>
          <b>03.</b>
          Keep creating as DISRUPT
          erases your art.
        </div>

        <div>
          <b>04.</b>
          If no artworks remain,
          you have <b>5 seconds</b>
          to create another.
        </div>
      </div>

      <p style="
        font-size:12px;
        color:#74798A;
        margin-bottom:18px;
      ">
        Survive the 30-second round to win.
      </p>

      <button id="create-ready-button" style="
        width:100%;
        padding:15px;
        background:#343B4D;
        color:white;
        border:0;
        border-radius:30px;
        font-size:14px;
        cursor:pointer;
        touch-action:manipulation;
      ">
        I'm Ready
      </button>

      <p id="create-ready-status" style="
        font-size:12px;
        color:#85899A;
        margin-top:18px;
      ">
        Waiting for you to get ready.
      </p>

    </div>
  `;

  document.body.appendChild(readyOverlay);

  readyButton = document.getElementById(
    "create-ready-button"
  );

  readyStatus = document.getElementById(
    "create-ready-status"
  );

  readyButton.addEventListener(
    "click",
    event => {
      event.stopPropagation();

      unlockGameAudio();

      playerReady = true;

      readyButton.disabled = true;
      readyButton.textContent = "Ready ✓";
      readyButton.style.background = "#9B9EAD";

      readyStatus.textContent =
        "Waiting for DISRUPT to be ready...";

      sendReady();
    }
  );
}

function sendReady() {
  if (
    !playerReady ||
    typeof shareEmit !== "function"
  ) {
    return;
  }

  shareEmit("player-ready", {
    player: 1,
    mode: "create",
    participantId: CREATE_ID,
    ready: true
  });
}

// ========================================
// GAME OVERLAY
// ========================================

function setupGameOverlay() {
  gameOverlay = document.createElement("div");

  gameOverlay.style.cssText = `
    position:fixed;
    top:18px;
    left:50%;
    transform:translateX(-50%);
    z-index:5000;
    pointer-events:none;
    text-align:center;
    font-family:system-ui,sans-serif;
    color:#343B4D;
    width:calc(100% - 160px);
    max-width:340px;
    display:none;
  `;

  document.body.appendChild(gameOverlay);
}

function updateGameOverlay() {
  if (!gameOverlay) return;

  const now = Date.now();

  if (
    gamePhase === "lobby" ||
    gamePhase === "waiting"
  ) {
    gameOverlay.style.display = "none";
    return;
  }

  if (gamePhase === "finished") {
    gameOverlay.style.display = "none";
    return;
  }

  gameOverlay.style.display = "block";

  if (gamePhase === "countdown") {
    const seconds = Math.max(
      1,
      Math.ceil(
        (countdownEndsAt - now) / 1000
      )
    );

    gameOverlay.innerHTML = `
      <div style="
        font-size:44px;
        font-weight:300;
      ">
        ${seconds}
      </div>

      <div style="font-size:12px">
        Get ready to create
      </div>
    `;

    if (now >= countdownEndsAt) {
      gamePhase = "playing";
    }

    return;
  }

  if (gamePhase === "playing") {
    const remaining = Math.max(
      0,
      Math.ceil(
        (roundEndsAt - now) / 1000
      )
    );

    let recoveryHTML = "";

    if (recoveryEndsAt > now) {
      const recovery = Math.ceil(
        (recoveryEndsAt - now) / 1000
      );

      recoveryHTML = `
        <div style="
          margin-top:8px;
          padding:9px 12px;
          background:rgba(255,255,255,.94);
          border-radius:14px;
          font-size:13px;
        ">
          <b style="
            color:#B77C78;
            font-size:19px;
          ">
            ${recovery}
          </b>

          <div>No artworks remain!</div>

          <div style="font-size:11px">
            Scoop now to create again.
          </div>
        </div>
      `;
    }

    gameOverlay.innerHTML = `
      <div style="
        background:rgba(255,255,255,.87);
        border-radius:30px;
        padding:8px 15px;
        display:inline-block;
        font-size:13px;
      ">
        CREATE · ${remaining}s
      </div>

      ${recoveryHTML}
    `;
  }
}

// ========================================
// NETWORK EVENTS
// ========================================

function shareEvent(name, data, from) {
  if (!data) return;

  if (name === "game-countdown") {
    beginCountdown(data);
    return;
  }

  if (name === "game-start") {
    beginGame(data);
    return;
  }

  if (name === "game-state") {
    synchronizeGame(data);
    return;
  }

  if (name === "artwork-erased") {
    eraseArtworkFromNetwork(data);
    return;
  }

  if (name === "game-over") {
    finishGame(data);
    return;
  }

  if (name === "game-reset") {
    resetGame();
  }
}

function beginCountdown(data) {
  roundId = data.roundId ?? roundId;

  gamePhase = "countdown";

  countdownEndsAt =
    Date.now() +
    (Number(data.countdownMs) ||
      GAME.countdownMs);

  recoveryEndsAt = 0;

  kaleidoscopes = [];

  if (readyOverlay) {
    readyOverlay.style.display = "none";
  }
}

function beginGame(data) {
  roundId = data.roundId ?? roundId;

  gamePhase = "playing";

  roundEndsAt =
    Date.now() +
    (Number(data.remainingMs) ||
      GAME.roundMs);

  countdownEndsAt = 0;

  recoveryEndsAt =
    Date.now() +
    (Number(data.recoveryRemainingMs) ||
      GAME.recoveryMs);

  kaleidoscopes = [];
  totalScoops = 0;

  resetGestureWhenInactive();

  if (readyOverlay) {
    readyOverlay.style.display = "none";
  }
}

function synchronizeGame(data) {
  if (
    data.roundId != null &&
    roundId != null &&
    data.roundId !== roundId
  ) {
    return;
  }

  if (gamePhase !== "playing") {
    return;
  }

  if (Number.isFinite(data.remainingMs)) {
    roundEndsAt =
      Date.now() +
      Math.max(0, data.remainingMs);
  }

  if (
    Number.isFinite(data.recoveryRemainingMs) &&
    data.recoveryRemainingMs > 0
  ) {
    recoveryEndsAt =
      Date.now() +
      data.recoveryRemainingMs;
  } else {
    recoveryEndsAt = 0;
  }
}

function eraseArtworkFromNetwork(data) {
  if (
    data.roundId != null &&
    roundId != null &&
    data.roundId !== roundId
  ) {
    return;
  }

  const ownerId =
    data.creatorId ??
    data.participantId;

  if (
    ownerId != null &&
    ownerId !== CREATE_ID
  ) {
    return;
  }

  const artworkId =
    data.artworkId ??
    data.id;

  if (artworkId == null) return;

  const now = millis();

  for (const k of kaleidoscopes) {
    if (
      String(k.id) === String(artworkId) ||
      String(k.networkId) === String(artworkId)
    ) {
      if (!k.erasing) {
        updateArtworkOpacity(k);

        k.erasing = true;
        k.eraseStartedAt = now;
        k.eraseFrom = k.opacity;
      }
    }
  }

  researchEvent(
    "artwork_erased",
    "disrupt_hit"
  );
}

function finishGame(data) {
  if (
    data.roundId != null &&
    roundId != null &&
    data.roundId !== roundId
  ) {
    return;
  }

  gamePhase = "finished";
  gameWinner = data.winner || null;

  recoveryEndsAt = 0;

  showEndScreen();
}

function resetGame() {
  gamePhase = "lobby";

  roundId = null;
  playerReady = false;
  gameWinner = null;

  roundEndsAt = 0;
  recoveryEndsAt = 0;
  countdownEndsAt = 0;

  kaleidoscopes = [];
  totalScoops = 0;
  nextArtworkId = 1;

  trackedFingerId = null;
  fingerHeld = false;
  touchesWereEmpty = touches.length === 0;

  resetGestureWhenInactive();

  if (readyOverlay) {
    readyOverlay.style.display = "flex";
  }

  if (readyButton) {
    readyButton.disabled = false;
    readyButton.textContent = "I'm Ready";
    readyButton.style.background = "#343B4D";
  }

  if (readyStatus) {
    readyStatus.textContent =
      "Waiting for you to get ready.";
  }

  const endScreen =
    document.getElementById(
      "create-end-screen"
    );

  if (endScreen) {
    endScreen.remove();
  }
}

// ========================================
// WINNER SCREEN
// ========================================

function showEndScreen() {
  const existing =
    document.getElementById(
      "create-end-screen"
    );

  if (existing) {
    existing.remove();
  }

  const createWins =
    gameWinner === "create";

  const noResult =
    gameWinner === "none" ||
    gameWinner === "no-result";

  const heading = noResult
    ? "Round Complete"
    : createWins
      ? "Creation Prevails"
      : "All Artworks Erased";

  const subtitle = noResult
    ? "Try another round together."
    : createWins
      ? "Creation is vulnerable, but creativity is continuous."
      : "Keep creating. We never stop.";

  const screen =
    document.createElement("div");

  screen.id = "create-end-screen";

  screen.style.cssText = `
    position:fixed;
    inset:0;
    z-index:8500;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(233,234,240,.96);
    font-family:system-ui,sans-serif;
    text-align:center;
    padding:24px;
    box-sizing:border-box;
  `;

  screen.innerHTML = `
    <div style="
      max-width:370px;
      color:#343B4D;
    ">

      <div style="
        font-size:11px;
        letter-spacing:2px;
        color:#85899A;
        margin-bottom:30px;
      ">
        ROUND COMPLETE
      </div>

      <div style="
        font-size:48px;
        margin-bottom:20px;
      ">
        ${createWins ? "✦" : "◇"}
      </div>

      <h1 style="
        font-size:32px;
        font-weight:400;
        line-height:1.2;
      ">
        ${heading}
      </h1>

      <p style="
        font-size:14px;
        color:#74798A;
        line-height:1.7;
      ">
        ${subtitle}
      </p>

      <p style="
        font-size:12px;
        color:#85899A;
        margin-top:30px;
      ">
        Waiting for the next round...
      </p>

    </div>
  `;

  document.body.appendChild(screen);
}

// ========================================
// GENTLE SCOOP SOUND
// ========================================

function unlockGameAudio() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext =
        new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  } catch (error) {
    console.warn(
      "Audio unavailable:",
      error
    );
  }
}

function playScoopTone() {
  if (!audioContext) return;

  if (audioContext.state !== "running") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;

  playSoftNote(523.25, now, 0.17);
  playSoftNote(659.25, now + 0.09, 0.23);
}

function playSoftNote(
  frequency,
  start,
  duration
) {
  if (!audioContext) return;

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(
    frequency,
    start
  );

  gain.gain.setValueAtTime(
    0.0001,
    start
  );

  gain.gain.exponentialRampToValueAtTime(
    GAME.soundVolume,
    start + 0.025
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    start + duration
  );

  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  oscillator.start(start);
  oscillator.stop(
    start + duration + 0.02
  );
}

// ========================================
// SCOOP RECOGNITION
// ========================================

function resetGestureWhenInactive() {
  gesture = null;
  scoopState = "waiting";

  lastFilteredX = null;
  lastMotionAt = 0;
  motionSpeedX = 0;
}

function updateScoopGesture() {
  const now = performance.now();
  const x = rotationX;

  if (!Number.isFinite(x)) {
    return;
  }

  if (!fingerHeld) {
    resetGestureWhenInactive();
    return;
  }

  const dt = lastMotionAt
    ? (now - lastMotionAt) / 1000
    : 0;

  const previous = lastFilteredX;

  const filtered =
    previous === null
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

  } else if (scoopState === "dipped") {
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

      researchEvent(
        "scoop_success",
        "recognized"
      );

      g.reversalPeak = filtered;

      scoopState = "rearm";
    }

  } else if (scoopState === "rearm") {
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
// CREATE ARTWORK
// ========================================

function addScoop() {
  if (gamePhase !== "playing") {
    return;
  }

  totalScoops++;

  const now = millis();

  playScoopTone();

  for (const k of kaleidoscopes) {
    if (k.erasing) continue;

    k.opacityFrom = k.opacity;

    k.opacityTo = max(
      ART.oldestOpacity,
      k.opacityTo -
        (ART.newestOpacity -
          ART.oldestOpacity) /
        ART.fadeLayers
    );

    k.transitionStartedAt = now;
  }

  const newArtwork =
    createKaleidoscope();

  kaleidoscopes.push(newArtwork);

  if (
    kaleidoscopes.length >
    ART.maxLayers
  ) {
    kaleidoscopes.shift();
  }

  // Use globally unique IDs:
  // CREATE phone ID + artwork sequence.
  // The display sends this same ID back
  // when DISRUPT destroys the artwork.

  if (typeof shareEmit === "function") {
    shareEmit("scoop", {
      player: 1,
      mode: "create",
      participantId: CREATE_ID,
      roundId,

      artwork: {
        id: newArtwork.id,
        artworkId: newArtwork.id,
        creatorId: CREATE_ID,

        x: newArtwork.homeX / width,
        y: newArtwork.homeY / height,

        radius:
          newArtwork.radius /
          Math.min(width, height),

        sections: newArtwork.sections,
        colors: newArtwork.colors,
        fragments: newArtwork.fragments,

        rotation: newArtwork.rotation,
        rotationSpeed:
          newArtwork.rotationSpeed,

        phase: newArtwork.phase,

        orbitRadius:
          newArtwork.orbitRadius /
          Math.min(width, height),

        orbitSpeed:
          newArtwork.orbitSpeed,

        orbitDirection:
          newArtwork.orbitDirection,

        orbitPhase:
          newArtwork.orbitPhase,

        driftX:
          newArtwork.driftX / width,

        driftY:
          newArtwork.driftY / height,

        driftSpeedX:
          newArtwork.driftSpeedX,

        driftSpeedY:
          newArtwork.driftSpeedY,

        breathSpeed:
          newArtwork.breathSpeed
      }
    });
  }
}

function createKaleidoscope() {
  const shortest =
    min(width, height);

  const radius = random(
    shortest * ART.minRadius,
    shortest * ART.maxRadius
  );

  const orbitRadius = random(
    shortest * ART.orbitMin,
    shortest * ART.orbitMax
  );

  const margin =
    radius * 0.6 + orbitRadius;

  const left = margin;
  const right = max(
    left,
    width - margin
  );

  const top = margin + 115;
  const bottom = max(
    top,
    height - margin - 65
  );

  const x = random(left, right);
  const y = random(top, bottom);

  const colors = [];

  for (let i = 0; i < 4; i++) {
    colors.push([
      ...random(PALETTE)
    ]);
  }

  const fragments = [];

  const count = floor(
    random(6, 11)
  );

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

  const now = millis();

  const artworkId =
    CREATE_ID +
    "-" +
    nextArtworkId++;

  return {
    id: artworkId,
    networkId: artworkId,

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
      random(0.001, 0.004) *
      random([-1, 1]),

    phase: random(TWO_PI),

    orbitRadius,

    orbitSpeed:
      random(0.00025, 0.0009),

    orbitDirection:
      random([-1, 1]),

    orbitPhase: random(TWO_PI),

    driftX: random(3, 10),
    driftY: random(3, 10),

    driftSpeedX:
      random(0.0015, 0.004),

    driftSpeedY:
      random(0.0015, 0.004),

    breathSpeed:
      random(0.006, 0.014),

    opacity: 0,
    opacityFrom: 0,
    opacityTo: ART.newestOpacity,

    createdAt: now,
    transitionStartedAt: now,

    erasing: false,
    eraseStartedAt: 0,
    eraseFrom: 0
  };
}

// ========================================
// ARTWORK ANIMATION
// ========================================

function smoothFade(t) {
  t = constrain(t, 0, 1);

  return t * t * (3 - 2 * t);
}

function updateArtworkOpacity(k) {
  const now = millis();

  if (k.erasing) {
    const progress = smoothFade(
      (now - k.eraseStartedAt) /
      ART.eraseMs
    );

    k.opacity = lerp(
      k.eraseFrom,
      0,
      progress
    );

    return;
  }

  const isNew =
    k.opacityFrom === 0 &&
    k.opacityTo ===
      ART.newestOpacity;

  const duration = isNew
    ? ART.appearMs
    : ART.transitionMs;

  const progress = smoothFade(
    (now - k.transitionStartedAt) /
    duration
  );

  k.opacity = lerp(
    k.opacityFrom,
    k.opacityTo,
    progress
  );
}

function drawAllKaleidoscopes() {
  const count =
    kaleidoscopes.length;

  const now = millis();

  for (let i = 0; i < count; i++) {
    const k = kaleidoscopes[i];

    updateArtworkOpacity(k);

    if (
      k.erasing &&
      now - k.eraseStartedAt >=
        ART.eraseMs
    ) {
      continue;
    }

    const age =
      count - 1 - i;

    const ageProgress =
      constrain(
        age / ART.fadeLayers,
        0,
        1
      );

    const speedMultiplier =
      lerp(
        1,
        0.2,
        ageProgress
      );

    k.rotation +=
      k.rotationSpeed *
      speedMultiplier;

    // Each artwork orbits around
    // its own original position.

    const elapsed =
      now - k.createdAt;

    const orbitAngle =
      k.orbitPhase +
      elapsed *
        k.orbitSpeed *
        k.orbitDirection;

    const x =
      k.homeX +
      cos(orbitAngle) *
        k.orbitRadius;

    const y =
      k.homeY +
      sin(orbitAngle) *
        k.orbitRadius;

    drawKaleidoscope(
      k,
      x,
      y,
      k.opacity
    );
  }

  kaleidoscopes =
    kaleidoscopes.filter(
      k =>
        !k.erasing ||
        now - k.eraseStartedAt <
          ART.eraseMs
    );
}

function drawKaleidoscope(
  k,
  x,
  y,
  opacity
) {
  push();

  translate(x, y);

  const breathing =
    1 +
    sin(
      frameCount *
        k.breathSpeed +
        k.phase
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

  circle(
    0,
    0,
    k.radius * 2.25
  );

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

    drawFragmentGroup(
      k,
      opacity
    );

    scale(1, -1);

    drawFragmentGroup(
      k,
      opacity
    );

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

  circle(
    0,
    0,
    k.radius * 0.25
  );

  noStroke();

  fill(
    255,
    255,
    255,
    180 * opacity
  );

  circle(
    0,
    0,
    k.radius * 0.06
  );

  pop();
}

function drawFragmentGroup(
  k,
  opacity
) {
  for (const f of k.fragments) {
    push();

    const drift =
      sin(
        frameCount * 0.005 +
        f.phase
      ) *
      k.radius *
      0.02;

    translate(
      k.radius *
        f.distance +
        drift,

      k.radius *
        f.offset
    );

    rotate(
      f.rotation +
      sin(
        frameCount * 0.002 +
        f.phase
      ) * 0.06
    );

    const size =
      k.radius * f.size;

    const c =
      k.colors[f.colorIndex];

    drawGlassFragment(
      f.type,
      size,
      c,
      opacity
    );

    pop();
  }
}

function drawGlassFragment(
  type,
  s,
  c,
  opacity
) {
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

    vertex(
      -s * 0.5,
      -s * 0.1
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
      s * 0.3,
      s * 0.38
    );

    vertex(
      -s * 0.3,
      s * 0.28
    );

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
    circle(
      0,
      0,
      s * 0.7
    );
  }

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
    s * 0.14
  );
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

      researchSession++;

      researchEvent(
        "finger_down"
      );
    }

  } else {
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

      resetGestureWhenInactive();
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
// DEBUG + INSTRUCTIONS
// ========================================

function drawDebugReadout() {
  if (gamePhase !== "playing") {
    return;
  }

  push();

  noStroke();
  fill(85, 92, 110);

  textSize(12);
  textAlign(LEFT, TOP);
  textStyle(NORMAL);

  const debugX = 24;
  const debugY = 105;
  const lineHeight = 19;

  const xText =
    Number.isFinite(rotationX)
      ? rotationX.toFixed(2)
      : "-";

  const yText =
    Number.isFinite(rotationY)
      ? rotationY.toFixed(2)
      : "-";

  const visibleCount =
    kaleidoscopes.filter(
      k => !k.erasing
    ).length;

  const lines = [
    "rotationX " + xText,
    "rotationY " + yText,

    "finger " +
      (fingerHeld ? "down" : "up") +
      "  id " +
      (
        trackedFingerId === null
          ? "-"
          : trackedFingerId
      ),

    "state " + scoopState,

    "successful scoops " +
      totalScoops,

    "visible layers " +
      visibleCount
  ];

  for (
    let i = 0;
    i < lines.length;
    i++
  ) {
    text(
      lines[i],
      debugX,
      debugY +
        lineHeight * i
    );
  }

  pop();
}

function drawInstruction() {
  if (gamePhase !== "playing") {
    return;
  }

  push();

  noStroke();
  fill(105, 110, 125);

  textSize(12);
  textAlign(CENTER, CENTER);

  text(
    "CREATE — Hold + Scoop to add a new layer",
    width / 2,
    height - 38
  );

  pop();
}

// ========================================
// RESIZE
// ========================================

function windowResized() {
  const oldWidth = width;
  const oldHeight = height;

  resizeCanvas(
    windowWidth,
    windowHeight
  );

  for (const k of kaleidoscopes) {
    k.homeX *=
      width / oldWidth;

    k.homeY *=
      height / oldHeight;

    k.x *=
      width / oldWidth;

    k.y *=
      height / oldHeight;

    k.radius *=
      Math.min(width, height) /
      Math.min(oldWidth, oldHeight);

    k.orbitRadius *=
      Math.min(width, height) /
      Math.min(oldWidth, oldHeight);
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
        if (!sensorsReady) {
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
// RESEARCH RECORDING
// ========================================

function researchEvent(
  eventName,
  outcome = ""
) {
  if (!researchOn) return;

  researchRows.push(
    researchRow(
      "event",
      eventName,
      outcome
    )
  );
}

function researchRow(
  kind,
  event = "",
  outcome = ""
) {
  return {
    kind,

    session:
      researchSession,

    cycle:
      researchCycle,

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

    state:
      scoopState,

    event,
    outcome,

    speedX:
      motionSpeedX,

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

function recordResearchSample() {
  if (
    !researchOn ||
    !sensorsReady
  ) {
    return;
  }

  const now =
    performance.now();

  if (
    now - researchLastSample <
    50
  ) {
    return;
  }

  researchLastSample = now;

  researchRows.push(
    researchRow("sample")
  );
}

// ========================================
// EXPORT RESEARCH CSV
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

  const blob =
    new Blob(
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
    "scoop-create-v2c-" +
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        "-"
      ) +
    ".csv";

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    1000
  );
}
