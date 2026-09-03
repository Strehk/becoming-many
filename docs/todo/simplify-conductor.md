<!--
Purpose: Track the reduction of Conductor to a small operator-only browser application.
Context: The current page mixes live operation, rehearsal analysis, diagnostics, M5 setup, and programmatic DOM construction.
Responsibility: Define the smallest useful operator surface and remove its internal UI framework.
Boundary: Entry isolation and the same-origin control wire are tracked separately.
-->

# Simplify the Conductor Application

**Status:** Open
**Priority:** Architecture and operator clarity
**Issue:** [#36](https://github.com/Strehk/becoming-many/issues/36)

## Goal

Make `/conductor/` a separate, independently buildable PC operator application
with one clear job: operate and monitor the running show. It must not become a
second world runtime, a diagnostics dashboard, or a technician setup suite.

## Current Problem

`src/conductor/` contains roughly 1,300 lines of TypeScript plus a large CSS
file. Stable markup is constructed imperatively across multiple files. A
`ConductorPanel` abstraction, shared `ConductorState`, and a page-wide
`requestAnimationFrame` loop update every panel continuously even though most
values change only when a show status arrives.

The page also mixes distinct responsibilities:

- live transport and show health;
- cue timing and recording-headroom inspection;
- alternate rehearsal playback rates;
- raw M5 host setup and a second device poller;
- FPS diagnostics and show-window reload tools.

That scope makes the production operator UI larger and less legible than the
task requires.

## Product Boundary

Keep in Conductor:

- show live/stale state;
- audio, active level, language, and summarized M5 health;
- play and pause;
- reset and jump to authored cues;
- the minimal timeline needed during live conducting;
- future confirmed session and safety controls;
- the minimal M5 host field that binds this station to its rig, because no
  other production configuration owner currently exists.

Move to `/test/` or existing setup tooling:

- FPS and p95 diagnostics;
- recording-length and cue-headroom inspection;
- alternate playback speeds;
- raw M5 orientation preview and its independent poller;
- development-only reload and detailed rehearsal controls.

Do not duplicate these tools in both applications.

## Target Structure

```text
conductor/index.html             stable semantic operator markup
src/conductor/conductor-main.ts  bind events, receive status, render changes
src/conductor/timeline.ts        timeline geometry and scrubbing, only if retained
src/conductor/conductor.css      operator styling
```

Keep another source file only when it owns one independently testable behavior.
Do not collapse complex timeline pointer handling into a God file merely to
reduce the file count.

## Smallest Migration

1. Agree on the exact production control and status set.
2. Move stable DOM structure into `conductor/index.html`.
3. Bind controls once from `conductor-main.ts`.
4. Render on status and operator events; animate only the playhead while needed.
5. Remove `ConductorPanel`, the generic panel update fan-out, and redundant
   connection state.
6. Keep the host field as a command on the existing show-owned M5 connection,
   but move rehearsal diagnostics and raw M5 preview ownership to `/test/`.
7. Delete superseded panel files, settings, CSS, and tests rather than retaining
   compatibility wrappers.

## Constraints

- no frontend framework, component system, store, event bus, or UI registry;
- no import from VR, Test, levels, world, render code, or Three.js;
- no second M5 network poll when show status already answers operator health;
- no second M5 configuration store or technician settings framework;
- no page-wide frame loop for values that update at status rate;
- no loss of keyboard accessibility or destructive-action confirmation.

## Verification

- Conductor builds as an independent entry with no Three.js or VR chunks.
- Core transport remains usable by mouse and keyboard.
- A stale or missing show disables commands instead of silently dropping them.
- Show, audio, language, level, and M5 health update from validated status.
- No M5 polling, frame sampling, or page-wide redraw loop runs in Conductor.
- Browser smoke tests cover startup, live/stale transitions, transport, cue jump,
  reset, and channel teardown.
- Run tests, typecheck, lint, build, and Fallow.

## Related Tasks

- [#19 Isolate VR, Test, and Conductor Browser Entries](https://github.com/Strehk/becoming-many/issues/19)
- [#37 Replace the Station Broker With BroadcastChannel](https://github.com/Strehk/becoming-many/issues/37)
