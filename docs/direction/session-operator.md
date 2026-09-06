# Session and Operator

## Current

`/conductor.html` is the station window and hosts the show in-process. It
provides:

- show play/hold, seeking, cue jumps, rehearsal speeds, and current/next cue;
- language selection and a between-visitors time/position reset;
- flight reset and WebXR entry;
- M5 host configuration, preview, and status;
- sound, picture, controller, and headset status summaries;
- a technician drawer with raw details and destructive controls.

The page reads the running level once per frame and commands it through one
typed actions contract. It does not own a second schedule or show clock. During
an XR session the stage preview deliberately freezes instead of adding a second
render pass.

## Planned

Show owns playback, language and time commands; the existing Runtime owns full
visitor termination and fresh startup. All surfaces share those commands and own
only presentation/input. Remove forwarding-only adapters and duplicate rules;
no command bus, UI state store or extra coordinator.

Present the smallest concrete operator sequence for boarding, start, restart and
safety exit before implementation. Validate a full-page reload candidate on
Windows-PCVR, including XR termination/re-entry and audio permission. It is not
yet selected. Staff must see meaningful start failures and missing device
acknowledgements; no new phase machine is authorized merely by this requirement.

Language should be fixed before a visitor begins. Passthrough and headset state
belong to this session flow only after the delivery-platform tests establish a
controllable mechanism.

## Open

- Required tutorial: concrete content, timing, audio rights and start behavior.
- Which device confirmations must block start versus warn and permit override.
- Exact reset, safety exit, and recovery behavior at the venue.

Do not introduce a command bus or remote operator service for this flow; the
current page already owns the show in-process.
