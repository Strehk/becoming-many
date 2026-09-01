<!--
Purpose: Document ownership of the conductor page.
Context: The operator runs the piece from the station's second monitor.
Responsibility: Explain what belongs in src/conductor.
Boundary: Show time lives in src/dramaturgy; the wire lives in src/station.
-->

# Conductor

This folder owns the **operator page**: the surface a person runs the piece
from. It is the page [Session and Operator](../../docs/direction/session-operator.md)
describes, opened at `/conductor.html` on the station's second monitor while the
show runs at `/?show&station` in the other window.

`conductor-page.ts` is the page's composition root. It holds the station link
and the last status the show sent, and redraws every panel from one instant each
frame. `conductor-main.ts` is the entry `conductor.html` loads.

`show-timeline.ts` draws the schedule against show time and scrubs it. Each cue
is a slot; the filled bar inside is that cue's recording in the current
language, and the gap to the slot's right edge is the silence before the next
cue. A recording that outlasts its slot is marked, because its successor would
cut it off — the same invariant `tests/dramaturgy/piece-schedule.test.ts`
guards, made visible while cue times are being tuned by ear.

`transport-panel.ts` holds the clock, the cue countdown, and the controls.
`status-strip.ts` answers "is everything all right", including the audio state:
a context that never received a gesture freezes show time while looking exactly
like a pause, and only a click in the *show* window can clear it. `cue-inspector.ts`
reads out the authored numbers behind a selected cue. `conductor-keys.ts` maps
keys to actions, and `playhead.ts` carries the playhead between statuses.

## Boundaries

- **Nothing here imports `src/levels` or `src/world`.** A single value import
  from either would pull all of Three.js into this page's bundle, which is
  otherwise a few kilobytes. This folder imports only `src/station` and
  `src/dramaturgy`.
- **Slot arithmetic is not here.** `cueSlots` lives in
  `src/dramaturgy/schedule-layout.ts` beside the schedule it measures; a second
  copy would be a second schedule authority.
- **The page never authors a schedule.** It reads `PIECE_SCHEDULE` and writes
  nothing back. Cue times are changed by editing the typed data file.
- **The page holds no show time.** It projects the last reported instant
  forward for smoothness and is corrected by the next status.

## Not here yet

The session state machine, the live visitor view, and M5 and headset telemetry
are planned and deliberately absent. [Open Decision 2](../../docs/direction/open-decisions.md)
still owns the state machine; this page commands the show clock, not session
phases.
