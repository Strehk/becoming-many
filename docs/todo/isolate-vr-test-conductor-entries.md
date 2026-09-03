<!--
Purpose: Track the strict separation of the PC VR experience, diagnostics, and operator UI.
Context: The current browser bootstrap mixes show, standalone levels, benchmarks, diagnostics, and operator setup.
Responsibility: Define isolated Vite entries and import boundaries that keep each browser application small.
Boundary: Conductor UI simplification and its same-origin control wire are tracked as separate tasks.
-->

# Isolate VR, Test, and Conductor Browser Entries

**Status:** Open
**Priority:** Performance and architecture blocker
**Issue:** [#19](https://github.com/Strehk/becoming-many/issues/19)

## Confirmed Direction

This repository targets the **PC version** of Becoming Many. The show and its
Conductor run as separate browser applications on the same station PC and the
same HTTP origin. A later PICO version will be a deliberately reduced fork; the
shared Experience must therefore stay independent from PC-only operator and
diagnostic code.

Use three path-based Vite entries:

```text
vr/index.html         -> src/vr/vr-main.ts
test/index.html       -> src/test/test-main.ts
conductor/index.html  -> src/conductor/conductor-main.ts
```

The HTML entry is the mode. Do not add an `AppMode`, client router, environment
switch, feature registry, or compatibility shell.

## Current Problem

`src/main.ts` currently selects between the authored show, standalone levels,
and benchmarks. It also configures language, direct M5 polling, the station
connection, a station widget, and the `window.showClock` rehearsal global.

Separating only the HTML files would leave the production graph mixed:

- `level-runtime.ts` imports Test UI and frame-sampling concerns;
- the shared level catalogue includes diagnostic presets;
- Grass and Zone Visualizer remain reachable from production composition;
- the PC operator connection is not isolated behind one removable import;
- Conductor has a separate HTML entry but no enforced import boundary.

The PICO fork should be able to remove PC operation by deleting one composition
step, not by adding conditionals to the Experience or its render loop.

## Ownership Rules

### `/vr/`

The PC production entry may only:

- start the authored Experience;
- configure narration language;
- attach the PC-only show-control adapter after the Experience has started.

In the final graph, after task #35, the shared Experience must not import
`src/test`, `src/conductor`, browser benchmark code, Test UI, flash/setup code,
or the control wire. The PC entry is the only place allowed to attach Conductor
control.

### `/test/`

The Test entry owns access to all development and rehearsal modes:

- standalone narrative-level selection;
- the one all-feature Test template;
- deterministic benchmark runs and globals;
- the existing frame metrics and diagnostic overlays until task #35 removes
  them;
- detailed cue and recording inspection;
- direct M5 setup and raw controller preview;
- non-production transport tools such as alternate time scales.

Move the all-feature `test.level.ts` beside the Test entry and let a Test-owned
catalog add it to the shared narrative presets. The production catalog must not
import diagnostic presets or their module-only branches.

Point the browser benchmark and the Bun/Playwright harness at `/test/`. Keep
their current source locations unless an import boundary requires a move; do
not relocate code solely to rename it before later cleanup.

### `/conductor/`

Conductor is a small, independent operator application. It may import only:

- the schedule read model needed for operator presentation;
- the shared directional control messages and browser channel;
- its own DOM and CSS.

It must not import levels, world modules, render code, Three.js, Test code, or
the VR entry. Its radical UI simplification is tracked separately so entry
isolation does not become a large visual rewrite.

## Remove Before Abstracting

Remove code with no role in the selected entry instead of retaining it behind
options or no-op hooks.

From the PC production graph remove:

- `window.showClock` and its global declaration;
- direct `?level`, `?benchmark`, and `?m5` handling;
- the station corner widget;
- Test-only startup and level selection;
- static imports of Test-only Grass and Zone Visualizer code;
- the redundant `designTest.level.ts` preset.

Keep `src/test/test.level.ts` as the single all-feature integration template.
Issue #34 keeps the neutral `LevelPreset` contract under `src/levels`, while
this issue owns the diagnostic preset's move out of the production graph.

## Smallest Migration

### 1. Add the three entries

- Move the current show HTML to `vr/index.html`.
- Move `conductor.html` to `conductor/index.html`.
- Add `test/index.html`.
- Update Vite inputs, benchmark URLs, launchers, and documentation.
- Remove the old root entry after every caller uses the new paths.

### 2. Split the bootstrap

- Move production startup to `src/vr/vr-main.ts`.
- Move level and benchmark request handling to `src/test/test-main.ts`.
- Move `test.level.ts` to `src/test/` and create the Test-owned catalog that
  combines it with shared narrative presets.
- Keep only language configuration in the shared show request.
- Attach PC Conductor control in `vr-main.ts`, outside the Experience runtime.
- Delete the old mixed `src/main.ts` after both paths work.

### 3. Coordinate diagnostic removal with task #35

- Do not move `src/test-ui`, `FrameMetrics`, or overlay code that task #35 will
  delete.
- Let `/test/` temporarily reach the existing diagnostics while `/vr/` never
  starts them.
- After the entry split, complete the cold-transition profile and fix tracked
  by the transition-spike task. Then complete task #35 to remove Test UI, frame
  sampling, station FPS/p95 status, and their shared-runtime hooks.
- Keep the deterministic benchmark on its existing frame-control boundary and
  move browser benchmark code only if the entry import graph requires it.
- Dynamically import the two Test-only module branches only from the Test path.
- Delete compatibility hooks that have no production consumer.

### 4. Enforce the graph

Extend the existing Fallow task with these high-value rules:

- shared Experience code cannot import `src/vr`, `src/test`, or `src/conductor`;
- `src/vr` cannot import `src/test` or `src/conductor`;
- `src/conductor` cannot import `src/vr`, `src/test`, `src/levels`, `src/world`,
  or `three`;
- shared runtime never imports back into Test.

Do not introduce another dependency analyzer.

## Related Tasks

- [#35 Remove the Redundant Test UI](https://github.com/Strehk/becoming-many/issues/35).
- [#36 Simplify the Conductor Application](https://github.com/Strehk/becoming-many/issues/36).
- [#37 Replace the Station Broker With BroadcastChannel](https://github.com/Strehk/becoming-many/issues/37).
- [#11 Configure Fallow Architecture Boundaries](https://github.com/Strehk/becoming-many/issues/11).
- [Eliminate Cold-Start CPU Spikes at Level Transitions](level-transition-cpu-spikes.md).

Implement the entry split first, then the cold-transition profile and fix, then
#35, and finally enforce the completed application graph. This order preserves
the evidence path until its durable replacement exists and avoids moving
diagnostics that are deleted in #35.

## Verification

- `bun run build` emits independent `/vr/`, `/test/`, and `/conductor/` entries.
- `/vr/` contains no Test, Conductor UI, benchmark, flash, or diagnostic chunks.
- `/conductor/` contains no Three.js, level, world, Test, or VR modules.
- `/test/` still runs every level and benchmark profile.
- The PC Conductor controls `/vr/` through the separately tested control wire.
- Removing the one PC control import leaves the shared Experience operational.
- Run tests, typecheck, lint, build, Fallow, route smoke tests, and benchmarks.
- Compare production startup and frame measurements before and after; no
  regression is acceptable.

## Non-Goals

- no frontend framework or SPA router;
- no mode, plugin, capability, or application registry;
- no shared mutable store or in-process event bus;
- no optional operator callback in the render hot path;
- no compatibility redirect layer;
- no PICO implementation in this repository;
- no unrelated relocation of the flash page.
