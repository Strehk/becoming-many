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
opened at `/conductor.html` — the world runs in-process behind the page, and
the headset stream starts from this page's own button. The default page at `/`
stays the bare rehearsal and development world.

The surface is **touch-first and plain-worded**, because the station is run by
front-of-house staff, not technicians: every target is thumb-sized, the
readings are words like "OK" and "Check" rather than numbers, and everything
that can break or mislead during a live show — rehearsal speeds, the split
resets, the page reload, the M5 host, the raw readings, the stage view — sits
behind the technician drawer. The keyboard map still works for a technician
at the desk.

`conductor-page.ts` is the page's composition root. It starts the show level,
takes one `ShowSnapshot` of it per frame (including the one page-held copy of
the XR session state), and redraws every panel from that instant.
`conductor-main.ts` is the entry `conductor.html` loads.

`show-actions.ts` is the operator's command surface over the running level —
transport, language, resets, the M5 host, and the between-visitors
`restartExperience` (rewind, flight reset, hold). Panels call actions; nothing
else touches the clock.

`status-strip.ts` answers "is everything all right" as four plain tiles —
Sound, Picture, Controller, Headset — plus the one banner a fault that needs
a person deserves (a stranger's device answering as this station's
controller). The numbers behind the words live in the drawer's readouts.
`wake-overlay.ts` owns the suspended-audio state: a context that never
received a gesture freezes show time while looking exactly like a pause, so
until the audio runs the page is one full-screen "tap to wake" — the tap
itself is handled by the show's own gesture listener.

`transport-panel.ts` holds the clock, the status pill, the now/next cue
readouts, and the hold/play and ten-second-nudge buttons.
`show-timeline.ts` draws the schedule as chapters against show time and
scrubs it; each chapter shows its played progress under the playhead, and one
tap on a chapter button recovers a lost cue. The silent pre-roll before the
first word is folded into the first chapter for display, so the track never
shows an unnamed gap. Recording lengths and headroom are a tuning concern and
are no longer drawn here — `tests/dramaturgy/piece-schedule.test.ts` still
guards the overrun invariant, and the authored numbers stay in the typed
schedule.

`session-bar.ts` holds the between-visitors controls: the language switch
(switching mid-piece is a re-arm and holds the show, per the session rules),
the headset button (`stream-button.ts` decides its one label from the XR
session state), the two-tap "New visitor" reset, and the technician-drawer
toggle.

`tech-drawer.ts` is where the breaking and misleading controls live:
rehearsal speeds, rewind-and-hold, the flight reset, the two-tap page reload,
the M5 host panel, the raw readouts, and the stage view. The drawer slides
rather than unmounts so the world's canvas inside it keeps its layout size.
`stage-panel.ts` frames that stage view; while a session streams, Three.js
renders into the headset and the view holds its last frame under a
"streaming — paused" overlay — a live mirror would cost a second render pass
per session frame, so the frozen preview is deliberate. `m5-panel.ts` points
the show at the station's M5 tilt controller (applied directly to the level's
adapter, remembered in this browser's localStorage unless the deployment
config locks it) and previews the device on a crosshair — the show's own
samples, read without consuming button edges, so the device sees one poll
from this page; glanceable and never fed into steering.

`conductor-keys.ts` maps keys to actions.

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
