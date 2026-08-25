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

## Transport (PC-VR path)

The M5StickC Plus2 is a **plain-WebSocket broadcast server on the station
network**; the localhost page opens `ws://<m5>` directly — no relay, no TLS, no
BLE, no pairing ([Deployment](deployment.md)). Clients (experience, operator
page, setup diagnostics) subscribe and receive the same frames.

- The device announces itself via mDNS/UDP beacon.
- Because two stations share one network, **every frame carries `deviceId`**
  and each station's config binds exactly one M5. A wrong or unknown device is
  an operator-visible warning — never silent steering by the neighbour rig.

## Firmware

In-repo PlatformIO/Arduino project when this work lands
([Open Decision 3](open-decisions.md)).

- **Fix the board definition**: `board = m5stick-c-plus2` (the old firmware
  shipped `m5stick-c`) and add **GPIO4 power-hold** so the device survives on
  battery.
- Keep from the old firmware: M5Unified IMU read, accel-only pitch/roll,
  GPIO26 button with firmware edge detection, NVS config storage, self-owned
  reconnect, LCD as diagnostics surface.
- **Pipeline split by ownership**: `normalize → axis-map → calibrate` run on
  the device (calibration persisted in NVS at the rig — one rig, one zero,
  every client agrees). `safety → auto-neutralize → smooth` run in the client
  as a per-station **rig profile** (the old ICAROS rest-pose numbers are the
  starting profile — config, not constants).
- **One wire-protocol module** shared by app and firmware, with a single
  firmware version constant surfaced in the register message and checked by
  the app with an operator-visible warning.

## Setup page (operator/technician only)

1. **Flashing in the browser** via esp-web-tools (Web Serial); CI builds the
   binary and manifest per release (SPIKE H1,
   [Quality and Operations](quality-operations.md)).
2. **Configuration** over USB-serial newline-JSON:
   `configure / diagnose / reboot` plus `getConfig` (read-back of stored
   state) and `factoryReset`. Config surface: station WiFi credentials,
   `deviceId`, rig profile defaults. No server URL — the device *is* the
   server.
3. **Diagnostics**: live level pad with staleness detection, redacting log,
   and a device-side network reachability self-test.
