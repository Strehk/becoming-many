# Controls and M5

## Current

Keyboard flight remains a complete fallback. The M5StickS3 path is implemented
as another input adapter:

```text
HTTP /state payload
→ validation and device checks
→ normalized ControlFrame
→ safety, auto-neutralization, smoothing
→ shared viewer-rig flight
```

`ControlFrame` exposes normalized pitch/roll, quality, and one-frame button
edges. `quality: 0` means neutral steering rather than a fatal error. The
controller is polled by one page; Conductor reuses the show's samples for its
preview.

The repository contains PlatformIO firmware, a merged browser-flash binary,
`/flash.html` for Web Serial setup, and an M5 simulator. Firmware and browser
share a versioned protocol contract. Each response carries a device id and
monotonic button counters.

## Known Gaps

- Changing the host does not yet fully isolate old in-flight polls (#17).
- Sequence, calibration, firmware, liveness, and wrong-device behavior need a
  stricter enforcement policy (#18 and #38).
- The setup page currently persists and may expose Wi-Fi credentials; issue #12
  makes that unacceptable behavior explicit.
- The firmware binary is built manually; release automation and physical
  flash/setup acceptance are not recorded.

## Planned

Keep setup technician-only and separate from normal station operation. Physical
acceptance must test flash, configure, calibrate, reboot, reconnect, wrong
device, stale device, and controller removal. Keyboard fallback must continue to
work when no device is configured.

Do not add BLE, relays, pairing infrastructure, or another control protocol
without a demonstrated deployment requirement.
