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
<!-- AGENTS.md says p5-phone 1.15.0; 1.15.2 is current. One of the two documents
     is stale — pick 1.15.2 here and update AGENTS.md yourself. -->
Check on your phone: the page loads, the "Enable Motion Sensors" button is there and
tappable, there are no console errors, and the existing tilt scoop still fires at the
same angles. If the p5 2 button API has changed, fix it here — this step must end with
your current behaviour fully intact.
Also check on your laptop: the page loads with no console errors.
<!-- Steps 3, 7 and 8 each add a laptop check; this is the only step that edits
     index.html, so a load failure is most likely to show up here first. -->

**Step 2 — Swap the hand-rolled permission for p5-phone's.**
Delete `enableSensors()` and its "KEEP THIS SECTION" block. Keep your own button — give
it an id and bind it with `enableSensorOn('#…')` so its position and size stay as they
are. Add `lockGestures()` in `setup()`. Read permission from `window.sensorsEnabled`
instead of your local flag.
Because `enableSensorOn` leaves the element on the page, hide the button yourself in
`draw()` once `window.sensorsEnabled` is true — that replaces the `button.remove()` you
are deleting, and it is what makes the check below pass. (The alternative,
`enableSensorButton()`, hides itself but discards your `position()` / `size()` and the
`windowResized()` repositioning. Only use it if hiding proves awkward.)
<!-- Two traps: your top-level `let sensorsEnabled` shadows p5-phone's
     `window.sensorsEnabled` and would sit at false forever — remove it. And
     lockGestures() snapshots the mouse/touch callbacks, so they must exist by the
     time setup() runs and must `return false` — see Step 3. -->
Check on your phone: one tap grants permission and the button disappears; the scoop
behaves exactly as before, same thresholds, same circles.
Also check on your laptop: the page loads with no console errors.

**Step 3 — Track the finger and put up a temporary readout.**
Add `mousePressed` / `mouseReleased` that record the `id` of the finger that went down and
whether it is still present in `touches[]`. Two rules that the check below depends on:
record an id **only when none is stored** (so a second finger cannot overwrite it), and
clear it **only on a release whose id matches** it (so the second finger lifting never
ends the hold). `mousePressed()` must `return false`.
<!-- Function declarations at top level are hoisted, so these callbacks already exist
     before setup() runs and before lockGestures() snapshots them — adding them in a
     later step is safe. If you would rather avoid that question entirely, read
     `touches[]` in draw() and detect the 0→1 transition instead of using callbacks. -->
Add the top-left readout showing live `rotationX`, the tracked finger's down/up status,
**and the tracked id** — the id has to be on screen or you cannot run the check below.
Mark the readout clearly as temporary.
<!-- The finger status and id are scaffolding: your Output line lists only state,
     rotationX and attempt/success counts. Decide at Step 7 whether to keep them
     as tuning aids or drop them. -->
Check on your phone: the angle number moves as you tilt, `finger` flips to down when you
touch and up when you lift, and the id shown does not change when you add a second finger.
Also check on your laptop: the page loads and the readout appears.

**Step 4 — Gate the scoop on the held finger.**
The scoop now requires the original tracked finger to be down. Tilting with no finger does
nothing; a second finger neither helps nor hurts. Nothing else changes — the scoop still
fires on the way **down**, exactly as it does today, because the full arc does not arrive
until Step 6. The dip threshold and the re-arm threshold are unchanged.
Check on your phone, isolating the gate: tilt past -0.7 with no finger down — nothing.
Finger down, tilt past -0.7 — a circle, firing on the way down as before. Lift the finger,
then tilt — nothing.

**Step 5 — Clean start only.**
An attempt begins only when the finger lands while `rotationX > resetTrigger`. Landing
while already dipped does nothing until the phone comes back up past the reset trigger
and is dipped again. When the finger lands above the reset trigger, the attempt begins but
the scoop still fires on the way down, as before — the arc is Step 6.
Check on your phone: land while dipped — nothing happens until you recover and dip again;
land upright then dip — a circle, same as Step 4.

**Step 6 — The full arc.**
The scoop now registers only after the dip crosses `scoopTrigger` **and** returns past
`resetTrigger`, with the original finger held throughout; the circle therefore appears on
the way back up. Lifting that finger anywhere in the arc cancels the attempt and needs a
new touch to start again. The existing `readyToScoop` latch becomes the guard between
`dipping` and `rising`, so one movement yields one scoop.
Check on your phone: complete arc — one circle; lift anywhere in the arc — nothing, and a
fresh touch is needed; one slow continuous movement — **exactly one circle**, no matter how
long you linger below the trigger. This last case is the "one movement never produces two
scoops" criterion from *The question*.
<!-- That criterion is missing from "How I will check it" — that section is yours to
     edit, so add it there yourself if you want Step 8 to cover it automatically. -->

**Step 7 — Readout: state names and counts.**
Show the current state name (`idle` / `held` / `dipping` / `rising` / `scooped`) and the
attempt/success counts, where an attempt = a valid start (a landing above the reset
trigger) and a success = a completed arc. This completes the readout as your Output line
describes it — so now decide whether the finger status and id from Step 3 stay as tuning
aids or come off.
Check on your phone: the state shown matches what you are doing; cancelled attempts raise
attempts but not successes; successes match the number of circles on screen.
Also check on your laptop: this is where the laptop line in *How I will check it* becomes
true — the readout reads `idle · rotationX 0 · 0/0`.

**Step 8 — Run the whole checklist.**
Run every case in *How I will check it* on your phone, plus the double-count case from
Step 6, and report what happened — including any case that failed.
Check on your phone: tilting with no finger does nothing; a full held arc drops exactly
one circle; lifting partway drops nothing; landing while dipped does nothing until you
recover; one movement never produces two circles; the readout's state, angle and counts
match what you just did; at four scoops it stops at 4/4.
Also check on your laptop: the page loads with no console errors.

## Changes
<!-- Yours. One line each time you change this plan, and why. -->
