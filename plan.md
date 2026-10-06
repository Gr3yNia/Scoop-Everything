# Plan: Scoop Everything — slice 1, recognizing the scoop

## Project
The phone as an ice cream scoop: one participant holds a finger on the screen and tilts
the phone to take a scoop, for someone in a room where others can watch the screen.

This slice is a p5.js 2 sketch for phones, using p5-phone 1.15.2.

## The question
Can a held finger *plus* the tilt gesture recognize an intentional scoop reliably?

A scoop is intentional when the person holds one finger down, dips the phone past the
trigger, and brings it back up — all without lifting that finger.

What would tell me it works:
- Every complete arc is counted exactly once.
- Lifting the original finger mid-arc is never counted.
- Landing the finger while the phone is already dipped is never counted.
- Tilting with no finger down is never counted.
- One movement never produces two scoops.

## The experience
One person picks up the phone and taps the button to enable motion sensors. They hold one
finger anywhere on the screen and scoop: the phone tips down toward about -90° and comes
back up, while the finger stays put. A scoop drops in from the top of the screen and
stacks on the ones below it. They can take four; after that the sketch stops, and they
reload to start again.

They are standing or sitting, holding the phone in one hand. Anyone watching sees the
scoops appear and stack; they do not see the debug readout in detail.

## Input, transformation, output, fallback
- Input: tilt from `rotationX` (p5 default, radians — no `angleMode(DEGREES)`), with the
  existing thresholds untouched: `scoopTrigger = -0.7`, `resetTrigger = -0.3`. Touch from
  `touches[]`, tracked by the `id` of the finger that starts the attempt. No speed.
- Transformation: a five-state machine — `idle → held → dipping → rising → scooped`.
  An attempt starts only when a finger lands while `rotationX > resetTrigger`. The scoop
  registers only after `rotationX` crosses `scoopTrigger` downward **and** returns past
  `resetTrigger`, with the original finger still down. Only that finger's disappearance
  cancels; a second finger is ignored. The existing `readyToScoop` latch becomes the
  guard between `dipping` and `rising`, so one movement still yields one scoop.
- Output: the existing circles falling in from `y: -80` and stacking, capped at four,
  unchanged. Plus a temporary debug readout, top-left: current state, live `rotationX`,
  attempt/success counts.
- Fallback: nothing on a laptop. The sketch loads and the button appears, but `rotationX`
  stays 0 with no tilt sensor, so no scoop can happen. Test on the phone.

## References
| File | Use it as | Take | Leave |
|---|---|---|---|
| *(none yet)* | — | — | — |

No reference images yet. Add them here when the artwork side starts.

## Limits
- Change `sketch.js`, and `index.html` (only to move to p5.js 2 and add p5-phone).
  Everything else stays untouched.
- Not now: speed detection, a relative starting angle, finger-sliding rules, other touch
  edge cases, a mouse fallback for the laptop, raising the four-scoop cap, removing the
  debug readout, and the full Scoop → Fragment → Play/Shake → Drop → Next Scoop cycle.

## How I will check it
- On my laptop: the page loads with no console errors, the enable button shows, the debug
  readout appears top-left reading `idle · rotationX 0 · 0/0`, and no scoop is possible.
- On my phone: the button grants sensor permission once and disappears; tilting with no
  finger down does nothing; a full held arc drops exactly one circle; lifting the finger
  partway through drops nothing; landing a finger while the phone is dipped does nothing
  until I come back up and scoop again; the readout's state, angle and counts match what
  I just did; at four scoops it stops.

## Steps
<!-- Written by the agent. Each step small enough to check on your phone. -->

**Step 1 — Move to p5.js 2 and add p5-phone.**
In `index.html`, replace `p5@1.11.10` with `p5@2.2.3`, add the p5.js compatibility shim,
and add `p5-phone@1.15.2`. Nothing else changes; `sketch.js` is untouched.
Check on your phone: the page loads, the "Enable Motion Sensors" button is there and
tappable, there are no console errors, and the existing tilt scoop still fires at the
same angles. If the p5 2 button API has changed, fix it here — this step must end with
your current behaviour fully intact.

**Step 2 — Swap the hand-rolled permission for p5-phone's.**
Delete `enableSensors()` and its "KEEP THIS SECTION" block. Keep your own button — give
it an id and bind it with `enableSensorOn('#…')` so its position and size stay as they
are. Add `lockGestures()` in `setup()`. Read permission from `window.sensorsEnabled`
instead of your local flag.
<!-- Two traps: your top-level `let sensorsEnabled` shadows p5-phone's
     `window.sensorsEnabled` and would sit at false forever — remove it. And
     lockGestures() snapshots the mouse/touch callbacks, so define them before
     locking and `return false` from them. -->
Check on your phone: one tap grants permission and the button disappears; the scoop
behaves exactly as before, same thresholds, same circles.

**Step 3 — Track the finger and put up a temporary readout.**
Add `mousePressed` / `mouseReleased` that record the `id` of the finger that went down and
whether it is still present in `touches[]`. Add the top-left readout showing live
`rotationX` and whether the tracked finger is down. Mark the readout clearly as temporary.
Check on your phone: the angle number moves as you tilt, `finger` flips to down when you
touch and up when you lift, and the id does not change when you add a second finger.

**Step 4 — Gate the scoop on the held finger.**
The scoop now requires the original tracked finger to be down. Tilting with no finger does
nothing. Lifting that finger cancels the attempt; a second finger neither helps nor hurts.
The dip threshold and the re-arm threshold are unchanged.
Check on your phone: tilt with no finger — nothing. Finger down, tilt — circle appears.
Start a scoop and lift early — no circle.

**Step 5 — Clean start and the full arc.**
An attempt begins only when the finger lands while `rotationX > resetTrigger`. Landing
while already dipped does nothing until the phone comes back up and is dipped again.
The scoop registers only after the dip crosses `scoopTrigger` and returns past
`resetTrigger`, finger held throughout. Name the states and show the current one in the
readout.
Check on your phone: land while dipped — nothing happens until you recover; complete arc —
one circle; lift anywhere in the arc — nothing, and you need a fresh touch.

**Step 6 — Counts, then run the whole checklist.**
Add attempt/success counts to the readout (an attempt = a valid start; a success = a
completed arc). Then run every case in "How I will check it" on the phone and report what
happened, including any case that failed.
Check on your phone: the counts match what you did — cancelled attempts raise attempts
but not successes, and the four-scoop limit still stops everything at 4/4.

## Changes
<!-- Yours. One line each time you change this plan, and why. -->
