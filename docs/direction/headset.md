# PICO Headset Integration

Research result: **PICO exposes no PC-side API** for passthrough or telemetry.
The enterprise capabilities are **on-device APIs** (PICO enterprise/ToB SDK:
`EnableSeeThroughManual`, `OpenVSTCamera`, `SwitchSystemFunction`, kiosk and
app control) — available because the stations use PICO 4 Enterprise hardware.

## XR model: switching, not blending

In `idle`/`boarding` and on `safety-exit`/`return`, the visitor sees the real
room via **native see-through**; on `tutorial`/`piece` start the headset
switches to VR (streamed or standalone per
[Open Decision 1](open-decisions.md)), fading in from white. Passthrough is
never blended *under* PC-streamed content — see rejected alternatives below.

## Headset agent (streaming path)

A small on-device Android app connected to the station server:

- **See-through switching** commanded by the session state machine, handing
  the foreground between the streaming client and see-through.
- **Telemetry backstream**: battery, proximity/worn state, streaming-client
  foreground/connection state → station server → operator page.
- **Protocol discipline** (proven in `pico-remote-control`): every command is
  correlated and distinguishes **requested → pending → headset-confirmed** —
  a successful socket `send()` is never proof the headset applied anything.
  The operator page renders confirmed state only.
- **The agent is optional.** If unreachable, staff guide the visitor manually
  and the operator page shows the degraded state; the piece is unaffected.

## SPIKE P1 (highest-risk item)

On real hardware, in this order:

1. **Business Streaming seethrough first.** PICO Business Streaming 2.2 lists
   "Seethrough during streaming" for specific Enterprise device/software
   combinations. If it works on our exact matrix, boarding/safety see-through
   comes from the streaming client and the agent shrinks to telemetry-only.
2. **Agent-driven handover as the in-spike fallback**: foreground handover in
   both directions (including clean streaming-client reconnect after being
   backgrounded), see-through control, telemetry access.

Record the outcome with its full hardware/software matrix
([Quality and Operations](quality-operations.md)).

## Provisioning and diagnostics

A maintenance plane, never part of runtime control:

- A tethered technician CLI over USB-C ADB (pattern proven by `picoctl`):
  inspect versions, install the agent APK and streaming client, launch
  intents, reboot, screenshot, and a bounded read-only scrcpy mirror
  (≤640 px, ≤15 fps, failure-isolated). scrcpy answers "what is the visitor
  actually seeing" during boarding and failures — diagnostics, not operations.
- **Kiosk/boot configuration** via PICO Business Device Manager: the boot
  foreground app is pinned, so a power-cycled headset returns to a known state
  without touching headset menus.

## Rejected alternatives (recorded so they are not re-litigated)

- **Blended passthrough under PC-streamed content** — architecturally
  impossible: headset cameras never reach the PC, and streaming clients cannot
  composite passthrough under a streamed frame. `immersive-ar` does not help —
  desktop Chrome has no AR runtime. "Seethrough during streaming" *switches*
  to the camera view; it does not blend.
- **On-headset browser as the primary platform** — sacrifices the desktop GPU
  and the streaming pipeline, but is a runnable, evidenced escape hatch:
  `pico-remote-control` proved a persistent `immersive-ar` session with remote
  passthrough ↔ opaque switching over plain WebSocket on real hardware. This
  overlaps with [Open Decision 1](open-decisions.md); note the evidence
  hardware was a PICO 4 **Ultra** Enterprise — results bind to the tested
  matrix.
- **BLE / Web Bluetooth for the M5**, **TLS on the ESP32, relays, pairing
  tokens** — pointless once the page is a localhost secure context on a
  controlled station network.
