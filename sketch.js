// Scoop Everything
// Mobile motion interaction experiment

// Permission comes from p5-phone as window.sensorsEnabled.
// Do NOT redeclare sensorsEnabled.
let button;


// =====================================
// TOUCH TRACKING
// =====================================

let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;


// =====================================
// SCOOP SETTINGS
// =====================================

// IMPORTANT:
// Keep these values unchanged.
// They were tested successfully on the phone.

let scoopTrigger = -0.7;
let resetTrigger = -0.3;


// =====================================
// SCOOP STATE
// =====================================

let scoopState = "waiting";
let totalScoops = 0;


// =====================================
// ARTWORK PALETTES
// =====================================

// The artwork cycles through these
// after every successful scoop.
//
// First scoop = Burnt Orange,
// then Dusty Lavender, Mist Blue,
// Sage Glass, then back to orange.
//
// The Burnt Orange entries are the
// original hand-tuned colours.
//
// Every palette shares orange's
// supporting colours: the translucent
// white, the smoke grey, the warm tan
// circle and the pale void accents.
//
// So each palette shows the same mix
// as the original artwork: the colour
// comes from main, everything else
// stays neutral.
//
// Only main, mainStroke and the halo
// change from palette to palette.
//
// mainStroke for the three newer
// palettes was lightened from main:
// lerp(main, white, 0.25).
// Orange keeps its original stroke.
//
// Alphas live at the call sites and
// never change.

const PALETTES = [
  {
    name: "Burnt Orange",

    main: [186, 91, 45],
    smoke: [78, 75, 72],
    light: [218, 214, 202],

    mainStroke: [226, 146, 100],
    smokeStroke: [155, 150, 140],
    lightStroke: [240, 236, 222],

    warm: [205, 181, 145],
    warmStroke: [230, 214, 190],

    atmosphere: [220, 205, 180],
    voidOuter: [220, 211, 195],
    voidPoint: [225, 214, 195]
  },

  {
    name: "Dusty Lavender",

    main: [157, 137, 180],
    smoke: [78, 75, 72],
    light: [218, 214, 202],

    mainStroke: [182, 167, 199],
    smokeStroke: [155, 150, 140],
    lightStroke: [240, 236, 222],

    warm: [205, 181, 145],
    warmStroke: [230, 214, 190],

    atmosphere: [154, 105, 211],
    voidOuter: [220, 211, 195],
    voidPoint: [225, 214, 195]
  },

  {
    name: "Mist Blue",

    main: [123, 158, 181],
    smoke: [78, 75, 72],
    light: [218, 214, 202],

    mainStroke: [156, 182, 200],
    smokeStroke: [155, 150, 140],
    lightStroke: [240, 236, 222],

    warm: [205, 181, 145],
    warmStroke: [230, 214, 190],

    atmosphere: [105, 169, 211],
    voidOuter: [220, 211, 195],
    voidPoint: [225, 214, 195]
  },

  {
    name: "Sage Glass",

    main: [132, 158, 143],
    smoke: [78, 75, 72],
    light: [218, 214, 202],

    mainStroke: [163, 182, 171],
    smokeStroke: [155, 150, 140],
    lightStroke: [240, 236, 222],

    warm: [205, 181, 145],
    warmStroke: [230, 214, 190],

    atmosphere: [105, 211, 150],
    voidOuter: [220, 211, 195],
    voidPoint: [225, 214, 195]
  }
];


// Which palette the artwork shows now.
// Advanced inside addScoop().

let paletteIndex = 0;


// =====================================
// ARTWORK
// =====================================

let artworkActive = false;
let fragments = [];

let rotationNow = 0;
let spreadNow = 1;


// =====================================
// SETUP
// =====================================

function setup() {

  createCanvas(windowWidth, windowHeight);

  textAlign(CENTER, CENTER);


  // -------------------------
  // SENSOR BUTTON
  // -------------------------

  button = createButton(
    "Enable Motion Sensors"
  );

  button.id("enable-sensors");

  button.position(
    width / 2 - 90,
    height / 2 - 25
  );

  button.size(
    180,
    50
  );


  // p5-phone handles permission

  enableSensorOn(
    "#enable-sensors"
  );

  lockGestures();


  // -------------------------
  // ARTWORK SETUP
  // -------------------------

  // IMPORTANT:
  // Do NOT use angleMode(DEGREES).
  //
  // The scoop thresholds were tested
  // using the current angle behaviour.

  createFragments();
}


// =====================================
// DRAW
// =====================================

function draw() {

  background(
    14,
    14,
    15
  );


  // =====================================
  // BEFORE SENSOR PERMISSION
  // =====================================

  if (!window.sensorsEnabled) {

    drawGameHeader();

    fill(210);
    noStroke();

    textFont("monospace");
    textStyle(NORMAL);
    textSize(13);

    textAlign(
      CENTER,
      CENTER
    );

    text(
      "TAP TO BEGIN",
      width / 2,
      height / 2 - 70
    );

    return;
  }


  // Hide permission button
  // once permission is granted.

  if (button) {
    button.hide();
  }


  // =====================================
  // UPDATE INTERACTION
  // =====================================

  updateFinger();

  updateScoopGesture();


  // =====================================
  // ARTWORK
  // =====================================

  if (artworkActive) {

    drawArtwork();

  } else {

    // Before first successful scoop.

    fill(
      225,
      200
    );

    noStroke();

    textFont("monospace");
    textStyle(NORMAL);
    textSize(13);

    textAlign(
      CENTER,
      CENTER
    );

    text(
      "HOLD + SCOOP",
      width / 2,
      height / 2
    );
  }


  // =====================================
  // GAME UI
  // =====================================

  drawGameHeader();

  drawGameHUD();
}


// =====================================
// GAME HEADER
// =====================================

function drawGameHeader() {

  push();


  // -------------------------
  // MAIN TITLE
  // -------------------------

  textFont("monospace");

  textAlign(
    LEFT,
    TOP
  );

  noStroke();


  // SCOOP

  fill(
    245,
    245,
    242
  );

  textStyle(BOLD);

  textSize(
    constrain(
      width * 0.058,
      21,
      29
    )
  );

  text(
    "SCOOP",
    20,
    22
  );


  // EVERYTHING

  text(
    "EVERYTHING",
    20,
    48
  );


  // -------------------------
  // SMALL INTERACTION LINE
  // -------------------------

  textStyle(NORMAL);

  textSize(9);

  fill(
    190,
    190,
    185,
    170
  );

  text(
    "SCOOP  ·  MOVE  ·  COLLECT",
    21,
    82
  );


  // -------------------------
  // SMALL ACCENT LINE
  // -------------------------

  stroke(
    186,
    91,
    45,
    150
  );

  strokeWeight(1);

  line(
    21,
    101,
    67,
    101
  );


  pop();
}


// =====================================
// GAME HUD
// =====================================

function drawGameHUD() {

  push();

  textFont("monospace");

  textAlign(
    LEFT,
    TOP
  );

  noStroke();


  // Position HUD from bottom-left.

  let x = 20;

  let bottomMargin = 22;

  let hudHeight = 138;

  let y =
    height -
    bottomMargin -
    hudHeight;


  // =====================================
  // MOTION LABEL
  // =====================================

  fill(
    190,
    190,
    185,
    150
  );

  textStyle(NORMAL);

  textSize(8);

  text(
    "MOTION",
    x,
    y
  );


  // =====================================
  // X + Y VALUES
  // =====================================

  fill(
    235,
    235,
    230,
    210
  );

  textSize(10);

  text(
    "X",
    x,
    y + 17
  );

  text(
    rotationX.toFixed(2),
    x + 28,
    y + 17
  );


  text(
    "Y",
    x,
    y + 32
  );

  text(
    rotationY.toFixed(2),
    x + 28,
    y + 32
  );


  // =====================================
  // DIVIDER
  // =====================================

  stroke(
    220,
    220,
    215,
    35
  );

  strokeWeight(1);

  line(
    x,
    y + 53,
    x + 125,
    y + 53
  );

  noStroke();


  // =====================================
  // TOUCH
  // =====================================

  fill(
    160,
    160,
    155,
    160
  );

  textSize(8);

  text(
    "TOUCH",
    x,
    y + 66
  );


  fill(
    235,
    235,
    230,
    210
  );

  textSize(9);

  text(
    fingerHeld
      ? "DOWN"
      : "UP",
    x + 55,
    y + 65
  );


  // =====================================
  // STATE
  // =====================================

  fill(
    160,
    160,
    155,
    160
  );

  textSize(8);

  text(
    "STATE",
    x,
    y + 83
  );


  fill(
    235,
    235,
    230,
    210
  );

  textSize(9);


  // Friendlier message than the raw
  // state name.
  //
  // waiting = nothing to do yet:
  //   before the first scoop, ask for
  //   a scoop; afterwards, invite the
  //   player to move the device.
  // ready = waiting for the dip.

  let stateLabel =
    scoopState.toUpperCase();


  if (
    scoopState === "ready"
  ) {

    stateLabel = "READY TO SCOOP";
  }


  if (
    scoopState === "waiting"
  ) {

    stateLabel = artworkActive
      ? "MOVE THE DEVICE TO PLAY"
      : "READY TO SCOOP";
  }


  text(
    stateLabel,
    x + 55,
    y + 82
  );


  // =====================================
  // SCOOP COUNT
  // =====================================

  fill(
    160,
    160,
    155,
    160
  );

  textSize(8);

  text(
    "SCOOPS",
    x,
    y + 108
  );


  // Make scoop count more prominent.

  fill(
    225,
    214,
    195,
    240
  );

  textStyle(BOLD);

  textSize(15);

  text(
    totalScoops,
    x + 55,
    y + 103
  );


  pop();
}


// =====================================
// FULL SCOOP GESTURE
// =====================================

function updateScoopGesture() {


  // -------------------------
  // NO FINGER
  // -------------------------

  // Lifting the finger at any point
  // cancels the current attempt.

  if (!fingerHeld) {

    scoopState = "waiting";

    return;
  }


  // -------------------------
  // CLEAN START
  // -------------------------

  // A scoop can begin only when the
  // finger is down AND the phone is
  // above the reset threshold.
  //
  // If the finger lands while the
  // phone is already dipped,
  // nothing starts.

  if (scoopState === "waiting") {

    if (
      rotationX > resetTrigger
    ) {

      scoopState = "ready";
    }

    return;
  }


  // -------------------------
  // DIP DOWN
  // -------------------------

  if (scoopState === "ready") {

    if (
      rotationX < scoopTrigger
    ) {

      scoopState = "dipped";
    }

    return;
  }


  // -------------------------
  // RETURN UP
  // -------------------------

  // Scoop is created only when
  // the full arc is completed.

  if (scoopState === "dipped") {

    if (
      rotationX > resetTrigger
    ) {

      addScoop();

      // Prevent one continuous finger hold
      // from creating multiple scoops.

      scoopState = "complete";
    }

    return;
  }


  // -------------------------
  // COMPLETE
  // -------------------------

  // Wait for finger release.
}


// =====================================
// ADD ONE SCOOP
// =====================================

function addScoop() {

  totalScoops++;


  // Cycle the artwork palette.
  //
  // First scoop shows palette 0,
  // then 1, 2, 3 and back to 0.

  paletteIndex =
    (totalScoops - 1) % PALETTES.length;


  // Successful scoop reveals artwork.

  artworkActive = true;


  // Fresh arrangement for every scoop.

  createFragments();


  // Reset visual movement.

  rotationNow = 0;

  spreadNow = 1;
}


// =====================================
// CREATE ARTWORK
// =====================================

function createFragments() {

  fragments = [];


  for (
    let i = 0;
    i < 12;
    i++
  ) {

    fragments.push({

      distance:
        random(
          0.25,
          1
        ),

      size:
        random(
          25,
          85
        ),

      offset:
        random(
          -28,
          28
        ),

      // Original artwork used degrees.
      // Store as radians.

      rotation:
        radians(
          random(
            -25,
            25
          )
        ),

      phase:
        radians(
          random(360)
        ),

      type:
        floor(
          random(4)
        )
    });
  }
}


// =====================================
// DRAW ARTWORK
// =====================================

function drawArtwork() {


  // =====================================
  // PHONE KALEIDOSCOPE INTERACTION
  // =====================================

  // NO FINGER:
  // gentle phone movement controls artwork.
  //
  // FINGER DOWN:
  // artwork holds position and
  // scoop gesture takes control.

  let targetRotation =
    rotationNow;

  let targetSpread =
    spreadNow;


  if (!fingerHeld) {


    // -------------------------
    // LEFT / RIGHT
    // -------------------------

    targetRotation =
      constrain(
        rotationY * 0.45,
        -0.45,
        0.45
      );


    // -------------------------
    // FORWARD / BACK
    // -------------------------

    targetSpread =
      map(
        rotationX,
        -0.6,
        0.6,
        1.45,
        0.55,
        true
      );
  }


  // -------------------------
  // SMOOTH MOVEMENT
  // -------------------------

  rotationNow =
    lerp(
      rotationNow,
      targetRotation,
      0.08
    );


  spreadNow =
    lerp(
      spreadNow,
      targetSpread,
      0.08
    );


  // =====================================
  // DRAW VISUAL
  // =====================================

  push();


  translate(
    width / 2,
    height / 2
  );


  drawAtmosphere();


  // -------------------------
  // RADIAL STRUCTURE
  // -------------------------

  let sections = 6;


  for (
    let i = 0;
    i < sections;
    i++
  ) {

    push();


    rotate(
      i *
      (TWO_PI / sections)
      +
      rotationNow
    );


    drawFragmentGroup(i);


    // Mirrored version

    scale(
      1,
      -1
    );


    drawFragmentGroup(i);


    pop();
  }


  drawVoid();


  pop();
}


// =====================================
// FRAGMENT GROUP
// =====================================

function drawFragmentGroup(section) {

  let maxRadius =
    min(
      width,
      height
    ) * 0.38;


  for (
    let i = 0;
    i < fragments.length;
    i++
  ) {

    let f =
      fragments[i];


    push();


    let radius =
      maxRadius *
      f.distance *
      spreadNow;


    // Very subtle internal movement.
    // Gives fragments a living quality.

    let drift =
      sin(
        frameCount * 0.003
        +
        f.phase
      ) * 4;


    translate(
      radius + drift,
      f.offset
    );


    rotate(
      f.rotation
      +
      rotationNow * 0.25
    );


    drawFragment(
      f.type,
      f.size
    );


    pop();
  }
}


// =====================================
// FRAGMENT SHAPES
// =====================================

function drawFragment(
  type,
  s
) {


  // Current artwork palette.

  let c = PALETTES[paletteIndex];


  strokeWeight(0.8);


  if (
    type === 0
  ) {

    // Palette main colour

    fill(
      c.main[0],
      c.main[1],
      c.main[2],
      115
    );

    stroke(
      c.mainStroke[0],
      c.mainStroke[1],
      c.mainStroke[2],
      150
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


  else if (
    type === 1
  ) {

    // Palette light colour

    fill(
      c.light[0],
      c.light[1],
      c.light[2],
      55
    );

    stroke(
      c.lightStroke[0],
      c.lightStroke[1],
      c.lightStroke[2],
      110
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


  else if (
    type === 2
  ) {

    // Palette smoke colour

    fill(
      c.smoke[0],
      c.smoke[1],
      c.smoke[2],
      125
    );

    stroke(
      c.smokeStroke[0],
      c.smokeStroke[1],
      c.smokeStroke[2],
      80
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

    // Small circular fragment
    // Tinted from the palette

    fill(
      c.warm[0],
      c.warm[1],
      c.warm[2],
      75
    );

    stroke(
      c.warmStroke[0],
      c.warmStroke[1],
      c.warmStroke[2],
      100
    );


    circle(
      0,
      0,
      s * 0.55
    );
  }
}


// =====================================
// BACKGROUND ATMOSPHERE
// =====================================

function drawAtmosphere() {

  let c = PALETTES[paletteIndex];

  noStroke();


  for (
    let d = 400;
    d > 20;
    d -= 25
  ) {

    let a =
      map(
        d,
        400,
        20,
        0,
        28
      );


    fill(
      c.atmosphere[0],
      c.atmosphere[1],
      c.atmosphere[2],
      a
    );


    circle(
      0,
      0,
      d
    );
  }
}


// =====================================
// CENTRAL VOID
// =====================================

function drawVoid() {

  let c = PALETTES[paletteIndex];

  push();


  // Outer circle

  noFill();

  stroke(
    c.voidOuter[0],
    c.voidOuter[1],
    c.voidOuter[2],
    70
  );

  strokeWeight(1);


  circle(
    0,
    0,
    105
  );


  // Palette inner circle

  stroke(
    c.main[0],
    c.main[1],
    c.main[2],
    150
  );


  circle(
    0,
    0,
    70
  );


  // Dark centre

  noStroke();

  fill(
    10,
    10,
    11
  );


  circle(
    0,
    0,
    48
  );


  // Tiny point

  fill(
    c.voidPoint[0],
    c.voidPoint[1],
    c.voidPoint[2]
  );


  circle(
    0,
    0,
    5
  );


  pop();
}


// =====================================
// FINGER TRACKING
// =====================================

function updateFinger() {

  let empty =
    touches.length === 0;


  if (
    trackedFingerId === null
  ) {


    // Start only on a NEW touch.
    // A second finger is ignored.

    if (
      !empty &&
      touchesWereEmpty
    ) {

      trackedFingerId =
        touches[0].id;
    }

  } else {


    // Only tracked finger can
    // end the attempt.

    let stillDown =
      false;


    for (
      let i = 0;
      i < touches.length;
      i++
    ) {

      if (
        touches[i].id ===
        trackedFingerId
      ) {

        stillDown =
          true;

        break;
      }
    }


    if (
      !stillDown
    ) {

      trackedFingerId =
        null;


      // Releasing original finger
      // resets scoop gesture.

      scoopState =
        "waiting";
    }
  }


  fingerHeld =
    trackedFingerId !== null;


  touchesWereEmpty =
    empty;
}


// =====================================
// TOUCH CALLBACKS
// =====================================

function mousePressed() {

  updateFinger();

  return false;
}


function mouseReleased() {

  updateFinger();

  return false;
}


// =====================================
// RESIZE
// =====================================

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