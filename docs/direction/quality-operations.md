# Quality and Operations Direction

Extends the current gates (`bun test`, `bun run check`, `bun run lint`,
[engineering standards](../engineering-standards.md)) toward the installation.

## Gates and CI

- **One gate command.** Direction: `bun run check` chains format check, lint,
  typecheck, and tests, and CI runs exactly that command on every push — the
  same one a human runs locally. Scripts without CI enforcement decay.
- **Performance budgets in CI.** The deterministic benchmark grows into
  per-profile CI budgets for frame-time p50/p95/p99, draw calls, and triangles.
  Physical acceptance covers the complete wired Windows, SteamVR, PICO
  Business Streaming, and headset presentation chain.
- **Runtime governor.** Frame-histogram-driven tier degradation turning module
  capacity values (render scale, instance counts, draw ranges) — possible by
  construction because capacities are runtime values
  ([Rendering Constraints](rendering-constraints.md)).
- **Multi-artifact CI** builds the browser application, firmware, and
  esp-web-tools manifest together once the installation pipeline requires it.

## Spikes (throwaway, before dependent work)

- **P1 — wired PCVR path on real hardware** ([Headset](headset.md)). Validate
  session startup, tracking, audio, controls, recovery, see-through behavior,
  and performance on the pinned station matrix.
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
