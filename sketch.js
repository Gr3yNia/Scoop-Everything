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

// Keep counting successful scoops even
// though only 4 are displayed at once.
let totalScoops = 0;


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

  // STEP 4 originally added fingerHeld as
  // a gate so tilting without a finger did
  // not create a scoop.
  //
  // PHONE TEST UPDATE:
  // Recognition now uses the full movement:
  // finger down → dip → return up.
  updateScoopGesture();


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
    // Colour is now stored with each scoop
    // so it stays the same when an old scoop
    // disappears from the array.
    fill(s.colour);


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


  if (totalScoops === 0) {

    text(
      "Hold + Scoop!",
      width / 2,
      height - 50
    );

  } else {

    // PHONE TEST UPDATE:
    // No 4-scoop game limit anymore.
    text(
      totalScoops + " scoops",
      width / 2,
      height - 50
    );

  }


  // STEP 3 — TEMPORARY DEBUG
  drawDebugReadout();
}


// -------------------------
// PHONE TEST UPDATE
// FULL SCOOP GESTURE
// -------------------------

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
  // phone is already dipped, nothing
  // starts.
  if (scoopState === "waiting") {

    if (rotationX > resetTrigger) {

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

    if (rotationX < scoopTrigger) {

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

    if (rotationX > resetTrigger) {

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


// -------------------------
// ADD ONE SCOOP
// -------------------------

function addScoop() {

  totalScoops++;


  // Temporary colours
  let colours = [
    "#FFBEC8",
    "#BEDCFF",
    "#DCC3FF",
    "#FFE1AA"
  ];


  // Cycle through the 4 colours forever.
  let colourIndex =
    (totalScoops - 1) % colours.length;


  scoops.push({

    x: width / 2,

    // Starts OUTSIDE screen
    y: -80,

    // Target position will be updated
    // below when the visible scoops restack.
    targetY: height * 0.72,

    size: 110,

    colour: colours[colourIndex]

  });


  // -------------------------
  // PHONE TEST UPDATE
  // CONTINUOUS PLAY
  // -------------------------

  // The interaction no longer stops
  // after 4 scoops.
  //
  // Keep only the latest 4 visible
  // so the phone does not accumulate
  // circles forever.
  if (scoops.length > 4) {

    scoops.shift();
  }


  // Restack the visible scoops.
  //
  // Newest scoop sits lowest.
  // Older scoops move upward.
  for (let i = 0; i < scoops.length; i++) {

    scoops[i].targetY =
      height * 0.72 -
      (scoops.length - 1 - i) * 75;
  }
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

      // PHONE TEST UPDATE:
      // Releasing the original finger
      // cancels/resets the scoop gesture.
      scoopState = "waiting";
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


  // PHONE TEST UPDATE:
  // Show the gesture state so we can see
  // exactly where recognition succeeds/fails.
  text(
    "state " + scoopState,
    12,
    48
  );

  text(
    "successful scoops " + totalScoops,
    12,
    66
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