// Scoop Everything
// Mobile motion interaction experiment
let sensorsEnabled = false;
let button;

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

  button.position(
    width / 2 - 90,
    height / 2 - 25
  );

  button.size(180, 50);

  button.mousePressed(enableSensors);
}


function draw() {

  background(245);


  // -------------------------
  // BEFORE SENSOR PERMISSION
  // -------------------------

  if (!sensorsEnabled) {

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


  // -------------------------
  // DETECT SCOOP
  // -------------------------

  // Scoop tests were around
  // X = -0.8 to -1.4
  if (
    rotationX < scoopTrigger &&
    readyToScoop &&
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
// SENSOR PERMISSION
// KEEP THIS SECTION
// -------------------------

function enableSensors() {

  if (
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {

    DeviceOrientationEvent.requestPermission()

      .then(function(response) {

        if (response === "granted") {

          sensorsEnabled = true;

          button.remove();

        } else {

          alert(
            "Motion sensor permission was not granted."
          );

        }

      })

      .catch(function(error) {

        alert(
          "Sensor error: " + error
        );

      });

  } else {

    sensorsEnabled = true;

    button.remove();

  }
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