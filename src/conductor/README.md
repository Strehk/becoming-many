<!--
Purpose: Document ownership of the conductor page.
Context: The operator runs the piece from the one window a station opens.
Responsibility: Explain what belongs in src/conductor.
Boundary: Show time lives in src/dramaturgy; the world lives in src/world.
-->

# Conductor

This folder owns the **station window**: the surface a person runs the piece
from, and the page that hosts the piece itself. It is the page
[Session and Operator](../../docs/direction/session-operator.md) describes,
opened at `/conductor.html` — the world runs in-process behind a small stage
view, and the headset stream starts from this page's own button. The default
page at `/` stays the bare rehearsal and development world.

`conductor-page.ts` is the page's composition root. It starts the show level,
takes one `ShowSnapshot` of it per frame, and redraws every panel from that
instant. `conductor-main.ts` is the entry `conductor.html` loads.

`show-actions.ts` is the operator's command surface over the running level —
transport, language, resets, the M5 host, and the between-visitors
`restartExperience` (rewind, flight reset, play). Panels call actions; nothing
else touches the clock.

`stage-panel.ts` frames the world's stage view and holds the visitor-facing
controls: the stream button (`stream-button.ts` decides its one label from the
XR session state) and the restart button. While a session streams to the
glasses, Three.js renders into the headset and the stage view holds its last
frame under a "streaming — paused" overlay — a live mirror would cost a second
render pass per session frame, so the frozen preview is deliberate.

`show-timeline.ts` draws the schedule against show time and scrubs it. Each cue
is a slot; the filled bar inside is that cue's recording in the current
language, and the gap to the slot's right edge is the silence before the next
cue. A recording that outlasts its slot is marked, because its successor would
cut it off — the same invariant `tests/dramaturgy/piece-schedule.test.ts`
guards, made visible while cue times are being tuned by ear.

`transport-panel.ts` holds the clock, the cue countdown, and the transport
controls. `m5-panel.ts` points the show at the station's M5 tilt controller
(applied directly to the level's adapter, remembered in this browser's
localStorage unless the deployment config locks it) and previews the device on
a crosshair — the page's own slow poll of `/state`, glanceable and never fed
into steering. `status-strip.ts` answers "is everything all right", including
the audio state: a context that never received a gesture freezes show time
while looking exactly like a pause, and any click or key press on this page
clears it. `cue-inspector.ts` reads out the authored numbers behind a selected
cue. `conductor-keys.ts` maps keys to actions.

## Boundaries

- **The world enters through one contract.** This folder imports
  `startLevel`/`RunningLevel` from `src/levels/level-runtime`, the presets
  from `src/levels/level-catalog`, and the XR session contract from
  `src/world/xr-session` — and commands it all through `show-actions.ts`. It
  never imports `src/world` internals or concrete `src/modules`; reaching
  around the level contract is how a second world authority would start.
- **Slot arithmetic is not here.** `cueSlots` lives in
  `src/dramaturgy/schedule-layout.ts` beside the schedule it measures; a second
  copy would be a second schedule authority.
- **The page never authors a schedule.** It reads `PIECE_SCHEDULE` and writes
  nothing back. Cue times are changed by editing the typed data file.
- **The page holds no show time.** Every frame reads the show clock fresh; the
  only page-held position is the operator's own while scrubbing, which wins
  over the clock until the drag ends.

## Not here yet

The session state machine and M5 and headset telemetry are planned and
deliberately absent. [Open Decision 2](../../docs/direction/open-decisions.md)
still owns the state machine; this page commands the show clock, not session
phases.
