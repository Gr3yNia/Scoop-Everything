// Scoop Everything
// Mobile motion interaction experiment

// Permission now comes from p5-phone as window.sensorsEnabled.
// Do NOT redeclare `sensorsEnabled` here: a top-level `let` would shadow
// p5-phone's flag and sit at false forever.
let button;


// -------------------------
// STEP 3 — TEMPORARY DEBUG
// -------------------------

// Remove this whole block once the scoop gesture is reliable.
let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;


// -------------------------
// SCOOP SETTINGS
// -------------------------

// Based on tests:
// scoop X was roughly -0.8 to -1.4
let scoopTrigger = -0.7;

// Phone must come back past this
// before another scoop is allowed
let resetTrigger = -0.3;


// -------------------------
// PHONE TEST UPDATE
// -------------------------

// Full scoop gesture:
//
// waiting
// → finger touches while phone is above resetTrigger
// → ready
// → phone dips below scoopTrigger
// → dipped
// → phone returns above resetTrigger
// → scoop is created
// → complete
//
// Finger must be released before
// beginning another scoop.
let scoopState = "waiting";

let totalScoops = 0;


// -------------------------
// ARTWORK
// -------------------------

// Instead of stacking 4 circles,
// one successful scoop reveals
// one full-screen artwork.

let artworkActive = false;

let fragments = [];

let rotationNow = 0;
let spreadNow = 1;


// -------------------------
// SETUP
// -------------------------

function setup() {

  createCanvas(windowWidth, windowHeight);

  textAlign(CENTER, CENTER);

  button = createButton(
    "Enable Motion Sensors"
  );

  // p5-phone binds the permission request
  // to this element
  button.id("enable-sensors");

  button.position(
    width / 2 - 90,
    height / 2 - 25
  );

  button.size(
    180,
    50
  );

  enableSensorOn(
    "#enable-sensors"
  );

  lockGestures();


  // -------------------------
  // ARTWORK SETUP
  // -------------------------

  // IMPORTANT:
  // We intentionally DO NOT use
  // angleMode(DEGREES) here.
  //
  // The scoop thresholds were already
  // tested successfully on the phone
  // using the current angle behaviour.

  createFragments();
}


// -------------------------
// DRAW
// -------------------------

function draw() {

  background(
    14,
    14,
    15
  );


  // -------------------------
  // BEFORE SENSOR PERMISSION
  // -------------------------

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


  // enableSensorOn leaves the element
  // on the page, so hide it once
  // permission is granted.
  if (button) {

    button.hide();
  }


  // -------------------------
  // STEP 3 — TEMPORARY DEBUG
  // -------------------------

  updateFinger();


  // -------------------------
  // DETECT SCOOP
  // -------------------------

  // STEP 4 originally added fingerHeld
  // as a gate so tilting without a finger
  // did not create a scoop.
  //
  // PHONE TEST UPDATE:
  // Recognition now uses the full movement:
  //
  // finger down → dip → return up

  updateScoopGesture();


  // -------------------------
  // ARTWORK
  // -------------------------

  if (artworkActive) {

    drawArtwork();

  } else {

    // Before the first successful scoop,
    // keep the visual space empty.

    fill(225);
    noStroke();

    textSize(18);

    text(
      "Hold + Scoop!",
      width / 2,
      height - 50
    );
  }


  // -------------------------
  // STEP 3 — TEMPORARY DEBUG
  // -------------------------

  drawDebugReadout();
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

  // The phone must pass the same scoop
  // threshold used in the original test.

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

  // The scoop is NOT created while
  // dipping down.
  //
  // It is created only when the phone
  // comes back above resetTrigger,
  // completing the full scoop arc.

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

  // Do nothing here.
  //
  // The user must release the tracked
  // finger before a new scoop can begin.
}


// =====================================
// ADD ONE SCOOP
// =====================================

function addScoop() {

  totalScoops++;


  // -------------------------
  // ARTWORK UPDATE
  // -------------------------

  // A successful scoop reveals
  // the fragmented visual space.

  artworkActive = true;


  // Create a fresh arrangement
  // for every new scoop.

  createFragments();


  // Reset the visual movement.

  rotationNow = 0;

  spreadNow = 1;
}


// =====================================
// CREATE ARTWORK
// =====================================

function createFragments() {

  fragments = [];


  // Create a fixed family
  // of fragments.

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
      // Store this as radians instead.

      rotation:
        radians(
          random(
            -25,
            25
          )
        ),

      // Same conversion for
      // animation phase.

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


  // ---------------------------------
  // PHONE KALEIDOSCOPE INTERACTION
  // ---------------------------------

  // The artwork no longer moves
  // automatically.
  //
  // When the user is NOT touching
  // the screen:
  //
  // small left/right tilt
  // → rotate artwork
  //
  // small forward/back tilt
  // → open / close artwork
  //
  // When a finger IS touching,
  // the artwork holds its position
  // and the scoop gesture takes over.


  let targetRotation =
    rotationNow;

  let targetSpread =
    spreadNow;


  if (!fingerHeld) {


    // -------------------------
    // LEFT / RIGHT
    // -------------------------

    // Small changes in rotationY
    // rotate the kaleidoscope.
    //
    // This is intentionally much
    // gentler than the scoop movement.

    targetRotation =
      constrain(
        rotationY * 0.45,
        -0.45,
        0.45
      );


    // -------------------------
    // FORWARD / BACK
    // -------------------------

    // Small changes in rotationX
    // open and close the fragments.

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


  // -------------------------
  // DRAW VISUAL
  // -------------------------

  push();


  translate(
    width / 2,
    height / 2
  );


  drawAtmosphere();


  // ---------------------------------
  // RADIAL STRUCTURE
  // ---------------------------------

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


    // mirrored version

    scale(
      1,
      -1
    );


    drawFragmentGroup(i);


    pop();
  }


  drawVoid();


  pop();


  // ---------------------------------
  // KALEIDOSCOPE INSTRUCTION
  // ---------------------------------

  fill(
    240,
    220
  );

  noStroke();

  textSize(14);

  textAlign(
    CENTER,
    CENTER
  );


  text(
    "Move your phone to reveal the magic of the kaleidoscope.",
    width / 2,
    height - 45
  );
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
    //
    // This is NOT the old automatic
    // open/close interaction.
    //
    // It only gives individual pieces
    // a tiny living quality.

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


  strokeWeight(0.8);


  if (
    type === 0
  ) {

    // Burnt orange glass

    fill(
      186,
      91,
      45,
      115
    );

    stroke(
      226,
      146,
      100,
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

    // Warm translucent white

    fill(
      218,
      214,
      202,
      55
    );

    stroke(
      240,
      236,
      222,
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

    // Smoke glass

    fill(
      78,
      75,
      72,
      125
    );

    stroke(
      155,
      150,
      140,
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

    fill(
      205,
      181,
      145,
      75
    );

    stroke(
      230,
      214,
      190,
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


// =====================================
// CENTRAL VOID
// =====================================

function drawVoid() {

  push();


  // Outer circle

  noFill();

  stroke(
    220,
    211,
    195,
    70
  );

  strokeWeight(1);


  circle(
    0,
    0,
    105
  );


  // Orange inner circle

  stroke(
    186,
    91,
    45,
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
    225,
    214,
    195
  );


  circle(
    0,
    0,
    5
  );


  pop();
}


// =====================================
// STEP 3 — TEMPORARY DEBUG
// Finger tracking + readout.
// Remove this whole block once the
// scoop gesture is reliable.
// =====================================

function updateFinger() {

  let empty =
    touches.length === 0;


  if (
    trackedFingerId === null
  ) {


    // Start an attempt only on a NEW touch
    // (0 -> 1).
    //
    // A second finger landing while one
    // is already down is ignored.
    //
    // A finger that is already down is
    // never adopted as the tracked one.

    if (
      !empty &&
      touchesWereEmpty
    ) {

      trackedFingerId =
        touches[0].id;
    }

  } else {


    // Only the tracked finger can end
    // the attempt.
    //
    // Another finger lifting does not.

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


      // PHONE TEST UPDATE:
      // Releasing the original finger
      // cancels/resets the scoop gesture.

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
  // let p5-phone manage the touch
}


function mouseReleased() {

  updateFinger();

  return false;
}


// =====================================
// STEP 3 — TEMPORARY DEBUG
// =====================================

function drawDebugReadout() {

  // TEMPORARY — delete once
  // the gesture works.

  fill(240);

  noStroke();

  textSize(12);

  textAlign(
    LEFT,
    TOP
  );


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
    (
      fingerHeld
        ? "down"
        : "up"
    )
    +
    "  id "
    +
    (
      trackedFingerId === null
        ? "-"
        : trackedFingerId
    ),
    12,
    48
  );


  text(
    "state " +
    scoopState,
    12,
    66
  );


  text(
    "successful scoops " +
    totalScoops,
    12,
    84
  );


  // Put the main text back.

  textAlign(
    CENTER,
    CENTER
  );
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