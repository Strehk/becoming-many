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
- `control-source.ts` — composes the stages, latches button edges
  consume-on-read for the frame body's single reader, and goes neutral when
  polls stop. `readLatestState` is the non-consuming read for a second,
  glanceable view.
- `m5-adapter.ts` — the only network code: the poll timer and fetch, idle
  until the conductor (or `?m5=`) sets a host. It is the station's one poll of
  the device, which serves a single client at a time; the conductor's preview
  reads `readLatestState` rather than opening a second one.

The device runs `normalize → axis-map → calibrate` itself; what steers from a
frame lives in `src/control/m5-flight.ts`.
