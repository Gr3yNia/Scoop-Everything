
# Plan: Scoop Everything — Phase 2, Many Phones, One Artwork

## Project

Scoop Everything turns a phone into a physical
ice cream scoop. A participant holds a finger on
the screen and tilts the phone through a scooping
gesture to generate visual artwork.

Phase 1 focused on recognizing the scoop reliably.

Phase 2 explores how multiple participants can
create and transform one collective artwork using
different interactions.

The project continues in p5.js 2 with p5-phone
1.15.2, hosted on GitHub Pages.

## The question

Can two or more people use different phone
interactions to create an artwork together, while
making each person's contribution visible to
everyone in the room?

What would tell me it works:

- A successful scoop on Player 1 creates one
  kaleidoscope on the shared display.
- A successful scoop on Player 2 creates glass
  fragments on the shared display.
- The display receives contributions from both
  players without needing to refresh.
- Each phone still responds independently.
- Participants can recognize which actions
  contributed to the collective artwork.
- A person watching without a phone can
  understand that the artwork is being created
  collaboratively.

## The experience

Two participants stand or sit near a shared
screen, each holding a phone.

Player 1 scoops to generate layered kaleidoscopes.
The newest artwork remains visible while older
artworks gradually fade as new scoops are added.

Player 2 scoops to generate translucent glass
fragments. Phone movement influences how the
fragments float, and shaking scatters them.

Both players contribute to the same shared
composition, which can be viewed by people
who are not holding phones.

The shared display begins with an introduction
screen and a Play Together button. The button
opens the exhibition canvas.

## Input, transformation, output, fallback

### Player 1

Input:
- Touch from the tracked finger
- Phone rotationX for scoop recognition

Transformation:
- A completed scoop creates a new kaleidoscope.
- Older artwork layers gradually fade as newer
  scoops are added.
- A successful scoop will also generate a
  network event.

Output:
- Layered pastel kaleidoscopes on the phone.
- A corresponding kaleidoscope on the
  shared display once networking is connected.

### Player 2

Input:
- Touch and rotationX for scoop recognition
- Phone rotation for movement
- Motion changes for shake detection

Transformation:
- Each successful scoop creates three glass
  fragments.
- Tilt affects fragment movement.
- Shake scatters the fragments.
- Scoop events will be sent to the shared display.

Output:
- Floating translucent fragments on the phone.
- Corresponding fragments on the shared display
  once networking is connected.

### Shared display

Input:
- Successful scoop events from both players
- Potential movement updates from Player 2

Transformation:
- Identify which player sent an event.
- Create the corresponding visual elements.
- Maintain one combined composition.

Output:
- One evolving collective artwork on a
  large screen.

### Fallback

If networking fails, each phone continues
to generate its own artwork.

The shared display should indicate when
it is waiting for a connection rather than
pretending to receive live contributions.

## References

| Reference | Take | Leave |
| --- | --- | --- |
| Phase 1 Scoop Everything | Existing scoop recognition and sensor permissions | Original four-scoop limit |
| Class 11: Looking Through | Public visibility, lowest necessary technical complexity | AR and three.js unless needed |
| Many Phones, One Space | Shared communication between devices | Unnecessary complexity |

The specific networking implementation will be
selected after reviewing the class example.

## Limits

- Preserve the existing Player 1 artwork.
- Preserve the existing Player 2 floating behaviour.
- Do not change scoop recognition while
  implementing networking.
- Keep the existing shared display welcome screen.
- Connect one player at a time.
- Begin with discrete scoop events rather than
  continuously streaming all sensor values.
- Do not introduce AR or three.js unless
  the interaction requires them.

Not now:
- Four fully implemented player roles
- Complex physics between devices
- Persistent user accounts
- Saving artwork to an external database
- Rebuilding the existing phone interfaces

## How I will check it

### On Player 1

- Sensor permission works.
- Holding and scooping generates one kaleidoscope.
- Tilting without a finger does not count.
- The layered artwork continues fading correctly.
- The research CSV controls still work.

### On Player 2

- Sensor permission works.
- Each successful scoop generates three fragments.
- Fragments float gently.
- Tilting changes their movement.
- Shaking scatters them.
- One gesture is not counted twice.

### On the shared display

- The welcome screen appears correctly.
- Play Together opens the exhibition canvas.
- The display receives a Player 1 scoop event.
- One Player 1 scoop creates one kaleidoscope.
- Player 2 scoop events create glass fragments.
- Both types of artwork can appear together.
- The display does not require a manual refresh.

### With participants

- Two people can interact at the same time.
- Each participant can identify their contribution.
- An observer can understand the connection
  between the physical actions and the artwork.
- The artwork remains readable after many scoops.

## Steps

### Step 1 — Preserve the working V2C players

Status: Completed

Keep Player 1 and Player 2 in separate files.

Player 1:
- player1.html
- player1.js

Player 2:
- player2.html
- player2.js

Check:
Both pages load on phones and the existing
interactions continue working.

Do not change the visual systems or gesture
recognition while adding networking.

### Step 2 — Prepare the shared display

Status: Partially completed

Use display.html.

Preserve the welcome screen, animated preview,
Play Together button, and Reset Session button.

The exhibition canvas currently exists but
does not receive player-generated artwork.

Check:
The page loads on a laptop, Play Together
opens the empty exhibition canvas, and Reset
returns to the welcome screen.

### Step 3 — Establish one shared connection

Status: Planned

Review the Many Phones, One Space class example.

Select a communication method compatible with
the existing GitHub Pages website.

First connect Player 1 to the shared display.

Send a small event when a scoop succeeds.

Example event structure:

{
  "player": 1,
  "type": "scoop",
  "timestamp": 0
}

The timestamp is an example field; the actual
message format will depend on the networking
method selected.

Check:
One scoop on Player 1 causes the shared
display to receive one event.

### Step 4 — Render Player 1 contributions

Status: Planned

Use the incoming scoop event to create a
kaleidoscope on the shared canvas.

Check:
- One event creates one artwork.
- Repeated scoops create repeated artworks.
- The display does not refresh between scoops.
- The artwork remains visible after the
  phone stops moving.

### Step 5 — Connect Player 2

Status: Planned

Send Player 2 scoop events through the
same communication system.

Each successful scoop creates three
glass fragments on the shared display.

Check:
- Player 1 still works.
- Player 2 sends events independently.
- Both contributions appear on the
  same display.

### Step 6 — Add movement interaction

Status: Planned

Explore sending limited tilt and shake
updates from Player 2.

Avoid sending unnecessary data every frame.

Check:
- Fragments respond to Player 2 movement.
- Motion is not excessively fast.
- Network delays do not make the
  artwork unusable.
- Player 1 artwork remains unaffected.

### Step 7 — Test with two players

Status: Planned

Set up:
- Phone A: Player 1
- Phone B: Player 2
- Laptop: Shared display

Run a short playtest.

Observe:
- Gesture recognition
- Event delivery
- Visual response
- Participant coordination
- Observer understanding

Record unexpected behaviour and failures.

### Step 8 — Revise and extend

Status: Planned

Use playtest observations to decide what
to improve.

Possible future work:
- Additional player roles
- Hand-off between players
- More direct interaction between
  kaleidoscopes and glass fragments
- Clearer feedback for observers
- More deliberate shared composition

Do not implement all extensions at once.

## Workflow

For each development slice:

1. State the change being made.
2. Identify the files allowed to change.
3. Preserve existing working behaviour.
4. Implement one small feature.
5. Test it locally where possible.
6. Test it on physical phones.
7. Record the result, including failures.
8. Commit the working version to GitHub.
9. Update this plan before the next slice.

AI-assisted coding can help with implementation,
but generated code must be inspected and tested
on actual devices.

## Changes

### V2C — Current working prototype

- Player 1 creates layered kaleidoscopes.
- Player 1 includes research CSV recording.
- Player 2 creates floating glass fragments.
- Player 2 responds to tilt and shake.
- Shared display has an introduction and
  exhibition screen.
- Live communication is not yet implemented.

### Next change

Connect one successful Player 1 scoop
to the shared display.
