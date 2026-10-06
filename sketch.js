// Scoop Everything
// Mobile motion interaction experiment

// Permission now comes from p5-phone as window.sensorsEnabled.
// Do NOT redeclare `sensorsEnabled` here: a top-level `let` would shadow
// p5-phone's flag and sit at false forever.
let button;

// STEP 3 — TEMPORARY DEBUG
// Remove this whole block once the scoop gesture is reliable.
let trackedFingerId = null;
let fingerHeld = false;
let touchesWereEmpty = true;

// SCOOP SETTINGS
let scoops = [];
let readyToScoop = true;

// Based on tests:
// scoop X was roughly -0.8 to -1.4
let scoopTrigger = -0.7;

// Phone must come back past this
// before another scoop is allowed
let resetTrigger = -0.3;


function setup() {

  createCanvas(windowWidth, windowHeight);
  textAlign(CENTER, CENTER);

  button = createButton("Enable Motion Sensors");

  // p5-phone binds the permission request to this element
  button.id("enable-sensors");

  button.position(
    width / 2 - 90,
    height / 2 - 25
  );

  button.size(180, 50);

  enableSensorOn("#enable-sensors");

  lockGestures();
}


function draw() {

  background(245);


  // -------------------------
  // BEFORE SENSOR PERMISSION
  // -------------------------

  if (!window.sensorsEnabled) {

    fill(20);
    noStroke();

    textSize(18);

    text(
      "Tap the button to start",
      width / 2,
      height / 2 - 70
    );

    return;
  }


  // enableSensorOn leaves the element on the
  // page, so hide it once permission is granted
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

  // Scoop tests were around
  // X = -0.8 to -1.4
  //
  // STEP 4: the held finger now gates this —
  // tilting with no finger down does nothing.
  // It still fires on the way DOWN; the full
  // arc arrives in Step 6.
  if (
    rotationX < scoopTrigger &&
    readyToScoop &&
    fingerHeld &&
    scoops.length < 4
  ) {

    addScoop();

    // Prevent one movement from
    // creating lots of circles
    readyToScoop = false;
  }


  // -------------------------
  // RESET FOR NEXT SCOOP
  // -------------------------

  // Bring phone back toward
  // normal position
  if (rotationX > resetTrigger) {

    readyToScoop = true;

  }


  // -------------------------
  // DRAW SCOOPS
  // -------------------------

  for (let i = 0; i < scoops.length; i++) {

    let s = scoops[i];

    // Make the scoop fall
    // into the screen
    s.y = lerp(
      s.y,
      s.targetY,
      0.08
    );


    noStroke();


    // Temporary colours
    if (i === 0) {
      fill(255, 190, 200);
    }

    if (i === 1) {
      fill(190, 220, 255);
    }

    if (i === 2) {
      fill(220, 195, 255);
    }

    if (i === 3) {
      fill(255, 225, 170);
    }


    circle(
      s.x,
      s.y,
      s.size
    );
  }


  // -------------------------
  // TEXT
  // -------------------------

  fill(20);
  noStroke();

  textSize(18);


  if (scoops.length === 0) {

    text(
      "Scoop!",
      width / 2,
      height - 50
    );

  } else if (scoops.length < 4) {

    text(
      scoops.length + " / 4",
      width / 2,
      height - 50
    );

  } else {

    text(
      "4 / 4",
      width / 2,
      height - 50
    );

  }


  // STEP 3 — TEMPORARY DEBUG
  drawDebugReadout();
}


// -------------------------
// ADD ONE SCOOP
// -------------------------

function addScoop() {

  let number = scoops.length;

  scoops.push({

    x: width / 2,

    // Starts OUTSIDE screen
    y: -80,

    // Each new scoop stacks
    // slightly higher
    targetY:
      height * 0.72 -
      number * 75,

    size: 110

  });
}


// -------------------------
// STEP 3 — TEMPORARY DEBUG
// Finger tracking + readout.
// Remove this whole block once the
// scoop gesture is reliable.
// -------------------------

function updateFinger() {

  let empty = touches.length === 0;

  if (trackedFingerId === null) {

    // Start an attempt only on a NEW touch
    // (0 -> 1). A second finger landing while
    // one is already down is ignored, and a
    // finger that is already down is never
    // adopted as the tracked one.
    if (!empty && touchesWereEmpty) {
      trackedFingerId = touches[0].id;
    }

  } else {

    // Only the tracked finger can end the
    // attempt. Another finger lifting does not.
    let stillDown = false;

    for (let i = 0; i < touches.length; i++) {
      if (touches[i].id === trackedFingerId) {
        stillDown = true;
        break;
      }
    }

    if (!stillDown) {
      trackedFingerId = null;
    }
  }

  fingerHeld = trackedFingerId !== null;
  touchesWereEmpty = empty;
}


function mousePressed() {
  updateFinger();
  return false; // let p5-phone manage the touch
}


function mouseReleased() {
  updateFinger();
  return false;
}


function drawDebugReadout() {

  // TEMPORARY — delete once the gesture works
  fill(20);
  noStroke();
  textSize(12);
  textAlign(LEFT, TOP);

  text(
    "rotationX " + rotationX.toFixed(2),
    12,
    12
  );

  text(
    "finger " + (fingerHeld ? "down" : "up") +
      "  id " + (trackedFingerId === null ? "-" : trackedFingerId),
    12,
    30
  );

  // put the main text back
  textAlign(CENTER, CENTER);
}


// -------------------------
// RESIZE
// -------------------------

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