# M5

The M5StickS3 tilt controller as the app sees it: the wire contract and the
polling adapter that turns `GET /state` into ControlFrames.

- `protocol.ts` — the HTTP payload shape and the serial setup commands;
  `M5_FIRMWARE_VERSION` must match `FirmwareVersion` in
  `firmware/m5/src/main.cpp`.
- `control-frame.ts` — the ControlFrame contract every steering consumer reads
  (`quality: 0` means "nothing is steering", a normal state).
- `state-frames.ts`, `control-safety.ts`, `auto-neutralize.ts`,
  `control-smoothing.ts` — the client-owned pipeline stages; their tunables are
  the per-station rig profile in `m5-settings.ts`.
- `control-source.ts` — one identity, firmware, calibration, sequence and
  freshness gate for steering, preview and status. Only fresh trusted button
  edges reach the single frame reader; `readLatestState` consumes no edges.
- `m5-adapter.ts` — the single poller; changing host aborts requests and
  replaces the entire control source. Requests time out; an empty host stops.
  Deployment must supply the expected device ID before samples can steer.

The device runs `normalize → axis-map → calibrate` itself; what steers from a
frame lives in `src/control/m5-flight.ts`.

## UI boundary and resources

M5 owns host replacement, request cancellation, validation and derived input
state. Entry supplies the initial host/device identity; panels edit the host
and observe status. `consumeFrame()` consumes button edges and has one Run caller.
UI receives only configuration/observation capabilities; axis policy is unchanged.
Run owns the adapter's lifetime. No UI can consume edges or call child cleanup.
[Target contracts](../../docs/target-architecture.md#4-responsibilities-and-contracts)
retain physical #18/#38 acceptance separately from this API cleanup.
