# Controls: ICAROS Rig and M5

**Keyboard remains a fully supported control source.** The piece is playable
with no device at all — works-in-any-state is the rule.

## ControlFrame contract

Proven in the previous stack (50 pipeline tests — port them with the code):

- `pitch`/`roll` in −1..1.
- `quality` 0..1 where **`quality: 0` means "nothing is steering" and is a
  normal state, not an error**.
- One-frame `buttonDown`/`buttonUp` edges, latched so fast render loops cannot
  miss them.

This matches the approved navigation boundary
(`device adapter → normalized input → navigation state → world update`,
[architecture decisions](../architecture-decisions.md)): the M5 adapter is one
more device adapter beside desktop.

**Landed** (2026-09-01): `src/m5/control-frame.ts` owns the contract;
`src/m5/control-source.ts` turns polls into render frames. Button edges are
**consume-on-read**: a press between two polls is latched and delivered by the
frame body's single `readFrame` call, so an edge between two polls is visible
exactly one render frame and cannot be missed. While an M5 host is configured the glider
**flies every frame**: a stale or failed poll carries neutral steering — a
steady forward glide with the configured gentle descent — because `quality: 0`
means "nothing is steering", never "stop". Keyboard movement returns when the
host is cleared; mouse look stays live throughout. The flight model is the
proven ICAROS glider (`src/control/m5-flight.ts`): constant forward glide, roll
→ yaw rate about world-up (heading persists, horizon never banks), pitch →
climb rate around a downward bias. `src/control/flight-settings.ts` authors the
shared 5 m/s glide, 1 m/s neutral descent, and 30-degree upward view assistance.
The glider moves the parent viewer rig in desktop and `immersive-vr` runs alike;
the child camera remains free for mouse look or the headset pose. The comfort
pitch sits between them, so WebXR composes it with the head pose instead of
overwriting it. Flight reset and terrain-relative height limits target the same
rig; each level may author its own maximum clearance.

The conductor owns enablement: an **M5 host** panel points the show it hosts
at the device, the show polls that host, and the status strip shows the device
state (`off / connecting / live / wrong-device`, quality, firmware mismatch).
The panel also previews the orientation on a crosshair, read from the show's
own samples so the device — which serves one client at a time — sees a single
poll from the station window; never fed into steering.
`?m5=<host>` polls directly for development, and `station/m5-sim.ts`
(`bun run m5-sim`) stands in for hardware.

## Transport (PC-VR path)

The controller is an **M5StickS3** (decided 2026-09-01; it replaced the
M5StickC Plus2 of the previous stack). The device is a **polled HTTP server on
the station network**: it serves its full state as JSON on `GET /state`
(CORS-enabled, port 80), and every client — experience, operator page, setup
diagnostics — polls the same endpoint. No relay, no TLS, no BLE, no pairing,
no WebSocket ([Deployment](deployment.md)).

- The device announces itself via mDNS (`<deviceId>.local`, `_http._tcp`).
- Every response carries `deviceId`, and each station's config binds exactly
  one M5. A wrong or unknown device is an operator-visible warning — never
  silent steering by the neighbour rig.
- **Button edges survive polling** through monotonic press/release counters in
  the payload: a press-and-release between two polls still advances both
  counters, and the client diffs them to synthesize the one-frame edges the
  ControlFrame contract promises.
- The firmware samples at 50 ms and pre-serializes the payload, so polling is
  a buffer send. The device still serves one client at a time, so the station
  budgets its requests rather than matching that cadence: one poll per page at
  167 ms (under 6 requests/s), which reads a fresh sample every time.

## Firmware

**Landed**: an in-repo PlatformIO project at `firmware/m5/`
([Open Decision 3](open-decisions.md)), ported from the Icaros_Host firmware.
`src/m5/protocol.ts` is the shared wire-protocol module; its
`M5_FIRMWARE_VERSION` must match the firmware's version constant, and the app
checks the payload's `firmwareVersion` with an operator-visible warning.

StickS3 notes (differences from the StickC Plus2 the old plan assumed):

- ESP32-S3 with **native USB** — flashing and the serial setup channel share
  the one USB-C port; no UART bridge, no GPIO4 power-hold (the M5PM1 power
  chip and M5Unified handle power). PlatformIO has no StickS3 board
  definition; the generic `esp32-s3-devkitc-1` with 8MB partitions matches the
  official examples.
- The IMU is a BMI270 behind the same M5Unified read; accel-only pitch/roll
  carries over unchanged.
- **Built-in buttons only** — no external rig button. Front button A is the
  logical control button; holding B for 1.5 s calibrates at the rig.
- Kept from the old firmware: NVS config storage, self-owned WiFi reconnect,
  LCD as diagnostics surface (level pad, IP, device id, and a heartbeat dot
  that flickers with each handled poll and freezes when polling stops).
- **Pipeline split by ownership**: `normalize → axis-map → calibrate` run on
  the device (calibration persisted in NVS at the rig — one rig, one zero,
  every client agrees). `safety → auto-neutralize → smooth` run in the client
  as a per-station **rig profile** — landed in `src/m5/m5-settings.ts` with
  the old ICAROS safety numbers; the rest pose is 0/0 because the device
  calibrates its own zero, so the neutralizer only pins idle drift.

## Setup page (operator/technician only)

**Landed** at `/flash.html` (`src/flash/`):

1. **Flashing in the browser** via esp-web-tools (Web Serial). The merged
   binary and manifest are committed under `public/firmware/` and built
   manually for now (see `firmware/m5/README.md`); CI automation per release
   remains planned (SPIKE H1,
   [Quality and Operations](quality-operations.md)).
2. **Configuration** over USB-serial newline-JSON:
   `configure / getConfig / diagnose / calibrate / clearCalibration / reboot /
   factoryReset`. Config surface: station WiFi credentials, `deviceId`, and
   the mount's axis map. No server URL or IP — the device *is* the server.
   The page remembers the last-used credentials in localStorage.
3. **Diagnostics**: the device log pane mirrors the firmware's state lines and
   command results; `diagnose` runs the device-side self-test. The richer live
   level pad with staleness detection can join the page once the polling
   adapter exists to share.
