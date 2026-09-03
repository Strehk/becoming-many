<!--
Purpose: Track removal of the browser KPI overlay and its production telemetry path.
Context: The isolated Test entry makes run selection explicit, while benchmark reports and physical PCVR runs own performance evidence.
Responsibility: Delete redundant live diagnostics without moving levels or creating a diagnostics framework.
Boundary: Entry and folder ownership belongs to issue #19; this task does not change level composition, benchmarks, controls, or XR locomotion.
-->

# Remove the Redundant Test UI

**Status:** Open
**Priority:** Performance hygiene
**Issue:** [#35](https://github.com/Strehk/becoming-many/issues/35)
**Depends on:** [#19](https://github.com/Strehk/becoming-many/issues/19)

## Goal

Delete the live browser KPI overlay and the frame-metrics path that keeps it in
the production runtime. Use deterministic benchmark reports for repeatable
browser evidence and the physical PCVR protocol for headset acceptance instead
of maintaining a third, non-authoritative diagnostics system.

Issue #19 owns the `/test/` entry. It must leave `src/test-ui/` in place rather
than moving code that this task immediately deletes. This task removes the
live-diagnostics path after the entry boundary exists and after the benchmark
documentation clearly separates static-level, cold-transition, and physical
PCVR evidence.

## Current Problem

`src/test-ui/test-overlay.ts` displays FPS, p95 frame time, draw calls, and
triangles during selected development levels. The overlay itself is optional,
but `FrameMetricsSampler` is created for every run and receives every frame.

The production show uses the same sampler only to publish FPS and p95 through
the station protocol. This gives one development overlay a contract path
through `LevelPreset`, `Level Runtime`, `RunningLevel`, station messages, and
the Conductor status strip.

The static-level benchmark measures the render path under fixed conditions and
writes comparable report artifacts. The planned cold-transition profile covers
first cue activations from a fresh WebGL context. The live overlay is useful for
a glance, but it is neither repeatable evidence nor visible in immersive XR and
does not prove physical PCVR acceptance.

## Smallest YAGNI Solution

Treat this as a deletion task after the dedicated test entry has landed:

1. Delete `src/test-ui/` and `tests/test-ui/`.
2. Remove `testUi` from `LevelPreset` and every level preset.
3. Remove the `SHOW_LEVEL` spread whose only purpose is to unset `testUi`.
4. Remove unconditional `FrameMetricsSampler` creation and per-frame sampling
   from `level-runtime.ts`.
5. Remove `RunningLevel.readFrameMetrics`.
6. Remove `framesPerSecond` and `p95Milliseconds` from control-wire status messages,
   parsing, tests, and the Conductor status strip.
7. Update documentation that describes the overlay or live frame telemetry.

Do not replace the deleted code with a diagnostics manager, callback registry,
generic frame observer, plugin API, event bus, or another overlay. Restore a
small test-only display from Git history only if a concrete workflow later
proves that the benchmark reports are insufficient.

## Explicit Non-Goals

- no move, rename, inheritance change, or parameter rewrite for the Test preset
  within this task;
- no change to narrative level content beyond removing the `testUi` flag;
  `designTest.level.ts` has already been removed by prerequisite issue #19;
- no benchmark route, sampling, report, profile, or baseline change in this
  deletion task; the cold-transition profile is a prerequisite owned by the
  transition-spike task;
- no entry or level-catalog restructuring beyond what issue #19 provides;
- no controls, M5, station transport, Conductor transport, or XR flight change;
- no replacement performance service or runtime instrumentation framework;
- no claim that desktop benchmark results prove physical PCVR performance.

## Affected Files

- `src/test-ui/frame-metrics.ts`
- `src/test-ui/test-overlay.ts`
- `src/test-ui/test-overlay.css`
- `tests/test-ui/frame-metrics.test.ts`
- `src/levels/level-runtime.ts`
- `src/levels/level-catalog.ts`
- level presets that currently author `testUi`
- `src/station/show-station.ts`
- `src/station/station-protocol.ts`
- `src/conductor/status-strip.ts`
- focused level, station, and conductor tests
- `docs/architecture.md`
- `docs/current-status.md`
- level documentation that mentions the overlay

## Verification

### Removal proof

- Repository search finds no `testUi`, `FrameMetricsSampler`,
  `readFrameMetrics`, `framesPerSecond`, or `p95Milliseconds` runtime contract.
- `src/test-ui/` and `tests/test-ui/` no longer exist.
- The production and test entries create no KPI overlay DOM.
- The Conductor continues to report show, audio, language, active world state,
  and M5 status without frame telemetry.

### Regression checks

- The production show starts and remains controllable through the Conductor.
- Every standalone level, including `test`, still starts through `/test/`.
- Every existing benchmark profile still completes and writes an equivalent
  report, and the cold-transition profile retains its independent evidence path.
- `bun test`, `bun run check`, `bun run lint`, `bun run build`, Fallow, and
  `git diff --check` pass.

Benchmark results remain development regression evidence. Physical checks on
the Windows station, SteamVR, USB-C link, and PICO remain the acceptance gate
for immersive performance.

## Related Prerequisite

- [Eliminate Cold-Start CPU Spikes at Level Transitions](level-transition-cpu-spikes.md)
