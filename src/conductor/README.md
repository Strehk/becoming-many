# Conductor

## Responsibility

The operator UI at `/conductor.html` presents transport, timeline, language,
headset and controller controls. The show runs in this same browser page.
The target folder owns DOM, input bindings, gesture preview, confirmations,
status presentation and UI cleanup. It owns no Show clock or visitor policy.

## Existing implementation and planned boundary

`conductor-main.ts` currently loads deployment facts; `conductor-page.ts`
starts `startLevel`, assembles the panels and samples Show/M5/XR/metrics.
`show-actions.ts` forwards commands and implements the current soft reset:
rewind, reset flight, then hold. This is not a fresh Run.

#36 moves bootstrap to `src/conductor.entry.ts`, makes `conductor.page.ts`
UI-only and replaces the actions adapter with narrow Show/Run/M5/XR contracts.
The entry applies initial M5 configuration; mounting a panel must not start
polling. Show owns playback/language; Run owns experience lifetime. Browser
reload and stored operator preferences stay at the browser boundary.

## Public interface and retained interaction

Panels draw a local view state and invoke only their needed public commands.
The current `ShowSnapshot` includes XR, M5 and diagnostics and will be named as
UI state. Drag preview, seek throttling, `wasPlaying`, keyboard mapping and
confirmation timers are legitimate UI behavior. Schedule arithmetic remains
in `dramaturgy`; device validity remains in M5.

The wake overlay displays suspended audio; Audio owns its user-activation
listeners. The technician drawer keeps the canvas mounted. During XR the stage
preview intentionally retains its last frame; no second render pass is added.
M5 preview observes accepted samples without consuming flight button edges.
"Picture OK" is a browser-metric heuristic, not Windows-PCVR acceptance.

## Resources and styling

UI releases its listeners, subscriptions, timers and DOM. The entry connects
page exit/cancellation to Run's awaited cleanup; UI never unloads its children.
#84 replaces the current `conductor.css` and inline styles with the central
stylesheet under the [Engineering Standards](../../docs/engineering-standards.md#application-styling).
The [target architecture](../../docs/target-architecture.md#3-target-structure)
owns diagrams and placement; the [roadmap](../../docs/roadmap.md) owns order.
The full visitor restart and XR/calibration operation remain #9/#46.
