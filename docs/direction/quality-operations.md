# Quality and Operations Direction

Extends the current gates (`bun test`, `bun run check`, `bun run lint`,
[engineering standards](../engineering-standards.md)) toward the installation.

## Gates and CI

- **One gate command.** Direction: `bun run check` chains format check, lint,
  typecheck, and tests, and CI runs exactly that command on every push — the
  same one a human runs locally. Scripts without CI enforcement decay.
- **Performance evidence in CI.** The deterministic harness gates exact
  `renderer.info` counters. Frame-time percentiles remain comparable
  same-machine evidence and physical acceptance uses the confirmed Windows PC,
  USB-C, SteamVR, streaming-client, and PICO matrix. Do not add a runtime
  governor before a measurement proves that fixed budgets are insufficient.
- **Firmware artifact CI:** build the M5 firmware and esp-web-tools manifest
  together so the application, protocol version, and binary cannot drift.

## Spikes (throwaway, before dependent work)

- **P1 — see-through path on real hardware** ([Headset](headset.md)). The
  highest-risk item in the project.
- **H1 — esp-web-tools flash** of the M5StickS3 through the landed
  `/flash.html` page, on real hardware ([Controls and M5](controls-m5.md)).
  The page, firmware, and merged binary exist; the spike is the physical
  evidence that the flow works end to end.

## Evidence rules

- **Dated hardware evidence.** Every spike result and every station acceptance
  run records its exact matrix: headset edition and model number, PICO OS,
  streaming-client/TobService versions, GPU/driver, build revision. A result
  without its matrix is not evidence.
- **Station acceptance protocol**: a two-hour soak cycling the full session
  state machine; streaming and M5 disconnect/reconnect recovery without manual
  repair; renderer resource counts returning to baseline after repeated
  cycles; a bounded overhead budget if the scrcpy diagnostic mirror is used
  during measurement.
