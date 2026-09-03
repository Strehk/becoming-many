# Session and Operator

## Current

`/conductor.html` is the station window and hosts the show in-process. It
provides:

- show play/hold, seeking, cue jumps, rehearsal speeds, and current/next cue;
- language selection and a between-visitors restart;
- flight reset and WebXR entry;
- M5 host configuration, preview, and status;
- sound, picture, controller, and headset status summaries;
- a technician drawer with raw details and destructive controls.

The page reads the running level once per frame and commands it through one
typed actions contract. It does not own a second schedule or show clock. During
an XR session the stage preview deliberately freezes instead of adding a second
render pass.

## Planned

An installation session model may add explicit boarding, active-show, return,
and safety-exit phases. It should be the smallest state machine that real staff
procedures require. Staff must see why a required device acknowledgement is
missing and retain a documented manual fallback.

Language should be fixed before a visitor begins. Passthrough and headset state
belong to this session flow only after the delivery-platform tests establish a
controllable mechanism.

## Open

- Whether a tutorial is a separate phase or unnecessary after visitor testing.
- Which device confirmations must block start versus warn and permit override.
- Exact reset, safety exit, and recovery behavior at the venue.

Do not introduce a command bus or remote operator service for this flow; the
current page already owns the show in-process.
