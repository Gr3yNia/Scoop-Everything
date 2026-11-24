
/*
  SCOOP EVERYTHING — DISRUPT V2C

  SENSOR → GUIDE → READY → COUNTDOWN → PLAY → RESULT

  Hold + Scoop: release one glass fragment
  Tilt: move fragments
  Shake: scatter fragments
  Rest: fragments slow down
  Fragments expire after 10 seconds

  The shared display controls:
  - Start and countdown
  - 30-second round
  - 5-second CREATE recovery
  - Collisions and winner
*/

// ========================================
// SETTINGS
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
  fragmentsPerScoop: 1,
  maxFragments: 20,
  lifetimeMs: 10000,
  minSize: 24,
  maxSize: 72,
  movementStrength: 0.0045,
  maxSpeed: 0.006,
  motionDeadzone: 0.05,
  movementThreshold: 0.06,
  fullTilt: 0.3,
  movingFriction: 0.91,
  restingFriction: 0.68,
  shakeThreshold: 1.8,
  shakeMaximum: 15,
  shakeCooldown: 250,
  shakeStrength: 0.008,
  appearMs: 350,
  fadeOutMs: 500
};

const GAME = {
  roundMs: 30000,
  recoveryMs: 5000,
  countdownMs: 3000,
  soundVolume: 0.03
};

const PALETTE = [
  [217, 167, 160],
  [169, 196, 196],
  [199, 180, 219],
  [227, 197, 162],
  [155, 170, 205],
  [238, 230, 223],
  [177, 159, 193],
  [203, 190, 216],
  [190, 212, 225],
  [235, 204, 190],
  [183, 202, 180],
  [222, 185, 202]
];

// Fragments stay dark charcoal with a strong cyan glow in BOTH rounds.
// They were hard to track in Playtest 1, so their look never changes —
// only the artwork palette and background differ per round.
const FRAGMENT_COLOR = [40, 44, 52];
const FRAGMENT_GLOW =
  "rgba(64, 224, 255, .95)";

// Cyan outline. Charcoal alone disappears against the Round 1 black
// background, so the silhouette is always edged in cyan.
const FRAGMENT_EDGE = [64, 224, 255];

// Everything that differs between the lobby and the two rounds lives
// in one block. The lobby and Round 2 share the original light-grey
// background, so they only differ in name.
const THEMES = {
  lobby: {
    background: [233, 234, 240],
    hud: null
  },

  1: {
    background: [0, 0, 0],
    hud: [226, 233, 240]
  },

  2: {
    background: [233, 234, 240],
    hud: null
  }
};

// Read only while Round 1 runs, so Round 2 and the lobby keep their
// original grey HUD text exactly as it was.
let hudOverride = null;

// ========================================
// NETWORK
// ========================================

const SHARE_HOST =
  "https://p5-phone-share.npuckett.workers.dev";

const SHARE_ROOM = "scoop-everything-v2c-pt2";
const SHARE_APP = "scoop-everything";

const DISRUPT_ID =
  "disrupt-" + Math.random().toString(36).slice(2, 10);

const SEND_INTERVAL = 65;

let lastSendAt = 0;

// ========================================
// STATE
// ========================================

let sensorButton;
let readyOverlay;
let readyButton;
let readyStatus;
let gameOverlay;
let briefingOverlay;

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

// Neutral holding pose for the round. Captured from the first frames of
// play, so "neutral" means however the player is already holding the
// phone rather than one fixed orientation.
let neutralX = null;
let neutralY = null;
let neutralSamples = 0;

// Normalised tilt, -1..1 per axis. updateFragment() turns these into
// fragment velocity.
let motionX = 0;
let motionY = 0;
let motionMagnitude = 0;

let previousAcceleration = null;
let lastShakeAt = 0;
let shakeEnergy = 0;
let totalShakes = 0;
let totalHits = 0;

const spentFragmentIds = new Set();

let gamePhase = "lobby";
let playerReady = false;
let roundId = null;

// 1 = Discover (practice), 2 = Compete. The display decides this and
// sends it on every game event; this phone only follows.
let currentRound = 1;

let roundEndsAt = 0;
let countdownEndsAt = 0;
let recoveryEndsAt = 0;

let gameWinner = null;
let audioContext = null;

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
  sensorButton.size(220, 54);

  sensorButton.style("background", "#343B4D");
  sensorButton.style("color", "#FFFFFF");
  sensorButton.style("border", "none");
  sensorButton.style("border-radius", "28px");
  sensorButton.style("font-size", "13px");
  sensorButton.style("z-index", "9000");

  positionSensorButton();

  enableSensorOn("#enable-sensors");
  lockGestures();

  shareSetup({
    host: SHARE_HOST,
    room: SHARE_ROOM,
    app: SHARE_APP,
    me: {
      name: "DISRUPT",
      role: 2,
      participantId: DISRUPT_ID
    }
  });

  shareConnect().catch(err => console.warn("share:", err));

  setupReadyScreen();
  setupGameOverlay();
  setupBriefingScreen();

  textAlign(CENTER, CENTER);
}

function positionSensorButton() {
  if (!sensorButton) return;

  sensorButton.position(
    width / 2 - 110,
    height / 2 - 27
  );
}

function motionSensorsAreEnabled() {
  return typeof sensorsEnabled !== "undefined"
    ? Boolean(sensorsEnabled)
    : Boolean(window.sensorsEnabled);
}

// ========================================
// DRAW
// ========================================

function draw() {
  background(...ART.background);

  const sensorsOn = motionSensorsAreEnabled();

  // STEP 1: SENSOR PERMISSION
  if (!sensorsOn) {
    if (readyOverlay) {
      readyOverlay.style.display = "none";
    }

    if (sensorButton) {
      sensorButton.show();
    }

    noStroke();
    fill(...(hudOverride || [52, 59, 77]));
    textAlign(CENTER, CENTER);
    textSize(17);

    text(
      "Enable motion sensors to begin",
      width / 2,
      height / 2 - 80
    );

    return;
  }

  if (sensorButton) {
    sensorButton.hide();
  }

  // STEP 2: ROLE GUIDE
  if (readyOverlay) {
    readyOverlay.style.display =
      gamePhase === "lobby" ? "flex" : "none";
  }

  updateFinger();

  // STEP 3: GAMEPLAY
  if (gamePhase === "playing") {
    updateScoopGesture();
    updatePhoneMovement();
    updateShake();

    const now = millis();
    const oldCount = fragments.length;

    fragments = fragments.filter(f =>
      now < f.expiresAt &&
      !spentFragmentIds.has(f.id)
    );

    for (const f of fragments) {
      updateFragment(f);
      drawFragment(f);
    }

    sendFragmentPositions(
      fragments.length !== oldCount
    );

    if (fragments.length === 0) {
      noStroke();
      fill(...(hudOverride || [100, 106, 123]));
      textAlign(CENTER, CENTER);
      textSize(18);

      text(
        "DISRUPT — Hold + Scoop!",
        width / 2,
        height * 0.62
      );
    }

    drawDebug();
    drawInstructions();

  } else {
    resetGestureWhenInactive();
  }

  updateGameOverlay();

  // Reannounce readiness for late connections.
  if (
    playerReady &&
    gamePhase === "lobby" &&
    frameCount % 60 === 0
  ) {
    sendReady();
  }
}

// ========================================
// READY GUIDE
// ========================================

function setupReadyScreen() {
  readyOverlay = document.createElement("div");

  readyOverlay.id = "disrupt-ready-overlay";

  readyOverlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:8000;
    background:#E9EAF0;
    display:none;
    align-items:center;
    justify-content:center;
    padding:20px;
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
      margin:auto;
      background:#F8F8FA;
      border-radius:24px;
      padding:28px 23px;
      box-sizing:border-box;
    ">

      <div style="
        font-size:10px;
        letter-spacing:2px;
        color:#85899A;
        margin-bottom:16px;
      ">
        SCOOP EVERYTHING / V2C
      </div>

      <div style="
        font-size:38px;
        line-height:1.2;
        margin-bottom:12px;
      ">
        ◇
      </div>

      <h1 style="
        font-size:30px;
        font-weight:400;
        margin:0 0 10px;
      ">
        DISRUPT
      </h1>

      <p style="
        font-size:13px;
        line-height:1.7;
        color:#74798A;
        margin:0 0 24px;
      ">
        Practice scooping to release glass fragments and tilting your phone to move them.
      </p>

      <div style="
        font-size:11px;
        letter-spacing:2px;
        color:#85899A;
        margin-bottom:12px;
      ">
        ROUND 1 · DISCOVER
      </div>

      <img
        src="./assets/Instructional-Guide-1.png"
        alt="Three-step scoop gesture: hold the phone with a finger on the screen, scoop downward, then lift the phone back up without releasing your finger."
        draggable="false"
        style="
          display:block;
          width:100%;
          height:auto;
          border-radius:14px;
          background:white;
          margin-bottom:22px;
        "
      >

      <p style="
        font-size:12px;
        color:#74798A;
        margin:0 0 18px;
      ">
        You have 30 seconds to disrupt.
      </p>

      <button
        id="disrupt-ready-button"
        style="
          width:100%;
          padding:15px;
          background:#343B4D;
          color:white;
          border:0;
          border-radius:30px;
          font-size:14px;
          cursor:pointer;
        "
      >
        I'm Ready
      </button>

      <p
        id="disrupt-ready-status"
        style="
          font-size:12px;
          color:#85899A;
          margin:18px 0 0;
          line-height:1.5;
        "
      >
        Waiting for you to get ready.
      </p>

    </div>
  `;

  document.body.appendChild(readyOverlay);

  readyButton = document.getElementById(
    "disrupt-ready-button"
  );

  readyStatus = document.getElementById(
    "disrupt-ready-status"
  );

  readyButton.addEventListener("click", () => {
    if (playerReady) return;

    unlockGameAudio();

    playerReady = true;
    readyButton.disabled = true;
    readyButton.textContent = "Ready ✓";
    readyButton.style.background = "#9B9EAD";

    readyStatus.textContent =
      "Waiting for CREATE to be ready...";

    sendReady();
  });
}

function sendReady() {
  if (
    !playerReady ||
    typeof shareEmit !== "function"
  ) {
    return;
  }

  shareEmit("player-ready", {
    player: 2,
    mode: "disrupt",
    participantId: DISRUPT_ID,
    ready: true
  });
}

// ========================================
// ROUND 2 BRIEFING
// ========================================

// Shown in the gap between Round 1 and Round 2. The display owns the
// five-second timer: this panel appears on round-briefing and is
// dismissed by the existing game-countdown event, so the phones never
// run a clock of their own and cannot drift from the display.
function setupBriefingScreen() {
  briefingOverlay = document.createElement("div");

  briefingOverlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:8500;
    background:#E9EAF0;
    display:none;
    align-items:center;
    justify-content:center;
    padding:24px;
    box-sizing:border-box;
    font-family:system-ui,sans-serif;
    color:#343B4D;
    text-align:center;
  `;

  briefingOverlay.innerHTML = `
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
        margin-bottom:14px;
      ">
        ROUND 1 IS COMPLETE
      </div>

      <h1 style="
        font-size:27px;
        font-weight:400;
        margin:0 0 22px;
      ">
        ROUND 2 · COMPETE
      </h1>

      <div style="
        background:white;
        border-radius:16px;
        padding:18px;
        text-align:left;
        font-size:13px;
        line-height:1.75;
      ">
        <b>DISRUPT</b> — Find and destroy! Scoop
        to release one fragment, then tilt to
        hit artworks. Each fragment lasts
        10 seconds.
      </div>

    </div>
  `;

  document.body.appendChild(briefingOverlay);
}

// ========================================
// GAME HUD
// ========================================

function setupGameOverlay() {
  gameOverlay = document.createElement("div");

  gameOverlay.id = "disrupt-game-overlay";

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
    width:calc(100% - 120px);
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
    gamePhase === "waiting" ||
    gamePhase === "finished" ||
    gamePhase === "briefing"
  ) {
    gameOverlay.style.display = "none";
    return;
  }

  gameOverlay.style.display = "block";

  if (gamePhase === "countdown") {
    const seconds = Math.max(
      1,
      Math.ceil((countdownEndsAt - now) / 1000)
    );

    gameOverlay.innerHTML = `
      <div style="
        font-size:46px;
        font-weight:300;
      ">
        ${seconds}
      </div>
      <div style="font-size:12px">
        Get ready to disrupt
      </div>
    `;

    // Do not start gameplay until the
    // shared display sends game-start.
    if (now >= countdownEndsAt) {
      gameOverlay.innerHTML = `
        <div style="
          background:rgba(255,255,255,.9);
          border-radius:24px;
          padding:12px 18px;
          font-size:13px;
        ">
          Starting...
        </div>
      `;
    }

    return;
  }

  if (gamePhase === "playing") {
    const remaining = Math.max(
      0,
      Math.ceil((roundEndsAt - now) / 1000)
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
            Stop CREATE from recovering.
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
        DISRUPT · ${remaining}s
      </div>
      ${recoveryHTML}
    `;
  }
}

// ========================================
// ROUND THEME
// ========================================

function applyTheme(key) {
  const theme = THEMES[key] || THEMES.lobby;

  ART.background = theme.background;

  hudOverride = theme.hud;
}

// The display is the authority on which round is running. Every game
// event carries roundNumber, so a phone that joins late still lands on
// the right background.
function applyRoundTheme(roundNumber) {
  const round = Number(roundNumber);

  if (Number.isFinite(round) && THEMES[round]) {
    currentRound = round;
  }

  applyTheme(currentRound);
}

// ========================================
// SHARED EVENTS
// ========================================

function shareEvent(name, data, from) {
  if (!data) return;

  switch (name) {
    case "round-briefing":
      beginBriefing(data);
      break;

    case "game-countdown":
      beginCountdown(data);
      break;

    case "game-start":
      beginGame(data);
      break;

    case "game-state":
      synchronizeGame(data);
      break;

    case "fragment-hit":
      receiveFragmentHit(data);
      break;

    case "game-over":
      finishGame(data);
      break;

    case "game-reset":
      resetGame();
      break;
  }
}

// The display runs a five-second briefing between the rounds. Show this
// role's objectives and wait: game-countdown is what dismisses it.
function beginBriefing(data) {
  if (
    data.roundId != null &&
    roundId != null &&
    data.roundId !== roundId
  ) {
    return;
  }

  roundId = data.roundId ?? roundId;

  applyRoundTheme(data.roundNumber);

  gamePhase = "briefing";

  if (readyOverlay) {
    readyOverlay.style.display = "none";
  }

  if (gameOverlay) {
    gameOverlay.style.display = "none";
  }

  if (briefingOverlay) {
    briefingOverlay.style.display = "flex";
  }
}

function beginCountdown(data) {
  roundId = data.roundId ?? roundId;

  applyRoundTheme(data.roundNumber);

  gamePhase = "countdown";

  // Round 1's fragments must not survive into Round 2, so drop them at
  // the transition rather than three seconds later when the new round
  // begins. The display clears its copy at the same moment.
  fragments = [];

  countdownEndsAt = Date.now() +
    (Number.isFinite(Number(data.countdownMs))
      ? Math.max(0, Number(data.countdownMs))
      : GAME.countdownMs);

  recoveryEndsAt = 0;

  if (readyOverlay) {
    readyOverlay.style.display = "none";
  }

  // Dismisses the Round 2 briefing.
  if (briefingOverlay) {
    briefingOverlay.style.display = "none";
  }
}

function beginGame(data) {
  roundId = data.roundId ?? roundId;
  applyRoundTheme(data.roundNumber);
  gamePhase = "playing";
  gameWinner = null;

  const remaining = Number(data.remainingMs);

  roundEndsAt = Date.now() +
    (Number.isFinite(remaining)
      ? Math.max(0, remaining)
      : GAME.roundMs);

  countdownEndsAt = 0;

  const recovery = Number(data.recoveryRemainingMs);

  recoveryEndsAt =
    Number.isFinite(recovery) && recovery > 0
      ? Date.now() + recovery
      : 0;

  fragments = [];
  spentFragmentIds.clear();

  totalScoops = 0;
  totalHits = 0;
  totalShakes = 0;

  nextFragmentId = 1;
  lastSendAt = 0;

  previousTiltX = null;
  previousTiltY = null;
  previousMotionTime = null;
  previousAcceleration = null;

  neutralX = null;
  neutralY = null;
  neutralSamples = 0;

  shakeEnergy = 0;

  trackedFingerId = null;
  fingerHeld = false;
  touchesWereEmpty = touches.length === 0;

  resetGestureWhenInactive();

  if (readyOverlay) {
    readyOverlay.style.display = "none";
  }

  const oldEndScreen = document.getElementById(
    "disrupt-end-screen"
  );

  if (oldEndScreen) {
    oldEndScreen.remove();
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

  applyRoundTheme(data.roundNumber);

  if (gamePhase !== "playing") return;

  const remaining = Number(data.remainingMs);

  if (Number.isFinite(remaining)) {
    roundEndsAt = Date.now() +
      Math.max(0, remaining);
  }

  const recovery = Number(
    data.recoveryRemainingMs
  );

  recoveryEndsAt =
    Number.isFinite(recovery) && recovery > 0
      ? Date.now() + recovery
      : 0;
}

// ========================================
// COLLISION CONFIRMATION
// ========================================

function receiveFragmentHit(data) {
  if (data.participantId !== DISRUPT_ID) {
    return;
  }

  if (
    data.roundId != null &&
    roundId != null &&
    data.roundId !== roundId
  ) {
    return;
  }

  const id = Number(data.fragmentId);

  if (!Number.isFinite(id)) return;

  if (!spentFragmentIds.has(id)) {
    spentFragmentIds.add(id);
    totalHits++;
  }

  fragments = fragments.filter(
    f => f.id !== id
  );

  emitDisrupt("move", {
    fragments: getNetworkFragments()
  });
}

// ========================================
// FINISH AND RESET
// ========================================

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

  // Back to a fresh session: the next game starts at Round 1 and the
  // phone returns to the original light-grey lobby look.
  currentRound = 1;
  applyTheme("lobby");

  roundId = null;
  playerReady = false;
  gameWinner = null;

  roundEndsAt = 0;
  countdownEndsAt = 0;
  recoveryEndsAt = 0;

  fragments = [];
  spentFragmentIds.clear();

  nextFragmentId = 1;
  totalScoops = 0;
  totalHits = 0;
  totalShakes = 0;

  previousTiltX = null;
  previousTiltY = null;
  previousMotionTime = null;
  previousAcceleration = null;

  neutralX = null;
  neutralY = null;
  neutralSamples = 0;

  shakeEnergy = 0;
  lastSendAt = 0;

  trackedFingerId = null;
  fingerHeld = false;
  touchesWereEmpty = touches.length === 0;

  resetGestureWhenInactive();

  if (briefingOverlay) {
    briefingOverlay.style.display = "none";
  }

  if (readyOverlay) {
    readyOverlay.style.display =
      motionSensorsAreEnabled() ? "flex" : "none";
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

  const endScreen = document.getElementById(
    "disrupt-end-screen"
  );

  if (endScreen) {
    endScreen.remove();
  }
}

// ========================================
// END SCREEN
// ========================================

function showEndScreen() {
  const existing = document.getElementById(
    "disrupt-end-screen"
  );

  if (existing) existing.remove();

  const createWins = gameWinner === "create";

  const noResult =
    gameWinner === "none" ||
    gameWinner === "no-result" ||
    !gameWinner;

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

  const screen = document.createElement("div");

  screen.id = "disrupt-end-screen";

  screen.style.cssText = `
    position:fixed;
    inset:0;
    z-index:8500;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(233,234,240,.97);
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
// AUDIO
// ========================================

function unlockGameAudio() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
  } catch (error) {
    console.warn("Audio unavailable:", error);
  }
}

function playScoopTone() {
  if (!audioContext) return;

  if (audioContext.state !== "running") {
    audioContext.resume();
  }

  const now = audioContext.currentTime;

  playSoftNote(392.00, now, 0.17);
  playSoftNote(493.88, now + 0.09, 0.23);
}

function playSoftNote(frequency, start, duration) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(
    frequency,
    start
  );

  gain.gain.setValueAtTime(0.0001, start);

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
  oscillator.stop(start + duration + 0.02);
}

// ========================================
// SCOOP DETECTION
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

  if (!Number.isFinite(x)) return;

  if (!fingerHeld) {
    resetGestureWhenInactive();
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

  } else if (scoopState === "dipped") {
    g.minX = Math.min(g.minX, filtered);

    if (now - g.start > SCOOP.maxMs) {
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

      scoopState =
        g.maxX - filtered >= SCOOP.dip
          ? "dipped"
          : "ready";
    }
  }
}

// ========================================
// SPAWN FRAGMENTS
// ========================================

function addScoop() {
  if (gamePhase !== "playing") return;

  // One fragment at a time, in both rounds: a new one can only be
  // released after the current fragment has expired or been destroyed.
  // The display removes destroyed fragments and sends fragment-hit,
  // which clears this phone's copy, so the path back is automatic.
  const now = millis();

  const active = fragments.some(
    f => now < f.expiresAt && !spentFragmentIds.has(f.id)
  );

  if (active) return;

  totalScoops++;
  playScoopTone();

  fragments.push(createFragment());

  emitDisrupt("spawn", {
    fragments: getNetworkFragments()
  });
}

function createFragment() {
  const now = millis();

  return {
    id: nextFragmentId++,

    x: random(0.38, 0.62),
    y: random(0.35, 0.65),

    vx: 0,
    vy: 0,

    speedFactor: random(0.75, 1.3),

    size: random(
      ART.minSize,
      ART.maxSize
    ),

    rotation: random(TWO_PI),

    rotationSpeed: random(
      -0.012,
      0.012
    ),

    color: [...FRAGMENT_COLOR],
    shape: floor(random(4)),

    createdAt: now,
    expiresAt: now + ART.lifetimeMs
  };
}

// ========================================
// TILT MOVEMENT
// ========================================

// Averages the first frames of a round into the neutral holding pose, so
// one jittery sample is never mistaken for "rest".
const NEUTRAL_FRAMES = 15;

// Deadzone plus smoothstep: no drift at rest, then speed ramps up with
// the tilt angle until ART.fullTilt is reached.
function tiltResponse(delta) {
  const magnitude = abs(delta);

  if (magnitude <= ART.motionDeadzone) {
    return 0;
  }

  const t = constrain(
    (magnitude - ART.motionDeadzone) /
      (ART.fullTilt - ART.motionDeadzone),
    0,
    1
  );

  const eased = t * t * (3 - 2 * t);

  return delta < 0 ? -eased : eased;
}

function updatePhoneMovement() {
  const rx = Number.isFinite(rotationX)
    ? rotationX
    : 0;

  const ry = Number.isFinite(rotationY)
    ? rotationY
    : 0;

  // Capture the neutral holding pose for this round.
  if (neutralX === null || neutralY === null) {
    neutralX = rx;
    neutralY = ry;
    neutralSamples = 1;
  } else if (neutralSamples < NEUTRAL_FRAMES) {
    neutralSamples++;

    neutralX += (rx - neutralX) / neutralSamples;
    neutralY += (ry - neutralY) / neutralSamples;
  }

  // Tilt relative to that pose. Tipping the top of the phone forward
  // makes rotationX fall, tipping the right edge down raises rotationY.
  // rotationY drives screen X, rotationX drives screen Y, so a forward
  // tilt moves fragments up and a right tilt moves them right.
  motionX = tiltResponse(ry - neutralY);
  motionY = tiltResponse(rx - neutralX);

  motionMagnitude = sqrt(
    motionX * motionX +
    motionY * motionY
  );
}

// ========================================
// FRAGMENT PHYSICS
// ========================================

function updateFragment(f) {
  const engaged =
    motionMagnitude > ART.movementThreshold;

  // Target velocity comes from the tilt angle: the greater the tilt,
  // the faster the fragment travels, and it keeps travelling for as
  // long as the phone is held at that angle.
  const targetX = engaged
    ? motionX * ART.movementStrength * f.speedFactor
    : 0;

  const targetY = engaged
    ? motionY * ART.movementStrength * f.speedFactor
    : 0;

  // Ease toward the target instead of accumulating forces. While a
  // shake is still ringing out the moving friction is held a little
  // longer so the push reads as a shove; otherwise the resting friction
  // brings the fragment smoothly back to a stop.
  const gliding = shakeEnergy > 0;

  const dampingX =
    targetX !== 0 || gliding
      ? ART.movingFriction
      : ART.restingFriction;

  const dampingY =
    targetY !== 0 || gliding
      ? ART.movingFriction
      : ART.restingFriction;

  f.vx = targetX + (f.vx - targetX) * dampingX;
  f.vy = targetY + (f.vy - targetY) * dampingY;

  if (abs(f.vx) < 0.000025) f.vx = 0;
  if (abs(f.vy) < 0.000025) f.vy = 0;

  const maxV =
    ART.maxSpeed + shakeEnergy * 0.004;

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

  f.x = constrain(f.x, 0, 1);
  f.y = constrain(f.y, 0, 1);

  if (f.x === 0 || f.x === 1) f.vx = 0;
  if (f.y === 0 || f.y === 1) f.vy = 0;

  if (f.vx !== 0 || f.vy !== 0) {
    f.rotation += f.rotationSpeed;
  }
}

// ========================================
// SHAKE
// ========================================

function updateShake() {
  const now = millis();

  const ax = Number.isFinite(accelerationX)
    ? accelerationX
    : 0;

  const ay = Number.isFinite(accelerationY)
    ? accelerationY
    : 0;

  const az = Number.isFinite(accelerationZ)
    ? accelerationZ
    : 0;

  const current = { ax, ay, az };

  if (previousAcceleration !== null) {
    const dx = ax - previousAcceleration.ax;
    const dy = ay - previousAcceleration.ay;
    const dz = az - previousAcceleration.az;

    const change = sqrt(
      dx * dx +
      dy * dy +
      dz * dz
    );

    if (
      change > ART.shakeThreshold &&
      now - lastShakeAt > ART.shakeCooldown
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
    intensity * ART.shakeStrength;

  for (const f of fragments) {
    f.vx +=
      random(-force, force) *
      f.speedFactor;

    f.vy +=
      random(-force, force) *
      f.speedFactor;
  }

  emitDisrupt("shake", {
    intensity,
    fragments: getNetworkFragments()
  });
}

// ========================================
// SEND TO SHARED DISPLAY
// ========================================

function emitDisrupt(action, extra = {}) {
  if (
    typeof shareEmit !== "function" ||
    gamePhase !== "playing"
  ) {
    return;
  }

  shareEmit("disrupt", {
    player: 2,
    mode: "disrupt",
    participantId: DISRUPT_ID,
    roundId,
    action,
    ...extra
  });
}

function getNetworkFragments() {
  const now = millis();

  return fragments.map(f => ({
    id: f.id,
    x: f.x,
    y: f.y,

    size:
      f.size / Math.min(width, height),

    rotation: f.rotation,
    color: f.color,
    shape: f.shape,

    remainingMs: Math.max(
      0,
      f.expiresAt - now
    )
  }));
}

function sendFragmentPositions(force = false) {
  const now = performance.now();

  const interval =
    fragments.length > 0
      ? SEND_INTERVAL
      : 500;

  if (
    !force &&
    now - lastSendAt < interval
  ) {
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
  const now = millis();

  const appear = constrain(
    (now - f.createdAt) / ART.appearMs,
    0,
    1
  );

  const remaining = Math.max(
    0,
    f.expiresAt - now
  );

  const fadeOut = constrain(
    remaining / ART.fadeOutMs,
    0,
    1
  );

  const opacity = appear * fadeOut;

  const x = f.x * width;
  const y = f.y * height;

  push();

  translate(x, y);
  rotate(f.rotation);

  const c = f.color;
  const s = f.size * 0.65;

  // Cyan halo, matching the shared display. p5 hands the native canvas
  // over through drawingContext, and the pop() at the end of this
  // function clears both the shadow and the transform again.
  drawingContext.shadowColor = FRAGMENT_GLOW;
  drawingContext.shadowBlur = max(16, s * 0.75) * opacity;

  fill(
    c[0],
    c[1],
    c[2],
    165 * opacity
  );

  stroke(
    FRAGMENT_EDGE[0],
    FRAGMENT_EDGE[1],
    FRAGMENT_EDGE[2],
    210 * opacity
  );

  strokeWeight(0.8);

  if (f.shape === 0) {
    rectMode(CENTER);
    rect(0, 0, s, s * 0.46);

  } else if (f.shape === 1) {
    beginShape();

    vertex(-s * 0.5, -s * 0.25);
    vertex(s * 0.25, -s * 0.4);
    vertex(s * 0.5, s * 0.2);
    vertex(-s * 0.2, s * 0.35);

    endShape(CLOSE);

  } else if (f.shape === 2) {
    triangle(
      -s * 0.45,
      s * 0.3,
      0,
      -s * 0.45,
      s * 0.5,
      s * 0.25
    );

  } else {
    rectMode(CENTER);
    rect(0, 0, s * 0.5, s * 0.9);
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

  } else {
    let stillDown = false;

    for (let i = 0; i < touches.length; i++) {
      if (touches[i].id === trackedFingerId) {
        stillDown = true;
        break;
      }
    }

    if (!stillDown) {
      trackedFingerId = null;
      fingerHeld = false;
      resetGestureWhenInactive();
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
  fill(...(hudOverride || [85, 92, 110]));
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
    "finger " + (fingerHeld ? "down" : "up"),
    24,
    top + 36
  );

  text("state " + scoopState, 24, top + 54);

  text(
    "successful scoops " + totalScoops,
    24,
    top + 72
  );

  text(
    "active fragments " + fragments.length,
    24,
    top + 90
  );

  text(
    "movement " + motionMagnitude.toFixed(2),
    24,
    top + 108
  );

  text("shakes " + totalShakes, 24, top + 126);
  text("artworks hit " + totalHits, 24, top + 144);

  const connected =
    typeof shareConnected !== "undefined" &&
    shareConnected;

  text(
    connected
      ? "Shared display: connected"
      : "Shared display: waiting",
    24,
    top + 162
  );

  textAlign(CENTER, CENTER);
}

// ========================================
// GAME INSTRUCTIONS
// ========================================

function drawInstructions() {
  noStroke();
  fill(...(hudOverride || [105, 110, 125]));
  textSize(12);
  textAlign(CENTER, CENTER);

  text(
    "Scoop · Tilt to chase · Shake to scatter",
    width / 2,
    height - 35
  );
}

// ========================================
// RESIZE
// ========================================

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  positionSensorButton();
}
