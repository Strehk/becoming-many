# Conductor

## Responsibility

The operator UI at `/conductor.html` controls the local station.
The show and embedded experience preview run in this same browser page.
The target folder owns DOM, input bindings, gesture preview, confirmations,
status presentation and UI cleanup. It owns no Show clock or visitor policy.

## Operator layout

- Top: Sound, Picture, Controller and Headset status, plus technician tools.
- Main: large Play/Pause and Stop controls, EN/DE below, and the live preview
  alongside them on desktop. Narrow layouts stack controls and preview.
- Bottom: one continuous timeline with chapter progress and chapter jump buttons.
  There is no separate elapsed-time display.

Status combines an icon, readable text and color. Icons stay visible regardless
of device connection; a dash is a status value, not a missing icon. The M5Stick
uses Lucide's rectangular `smartphone` glyph with a small button. Icons are
individual SVG assets from the installed package, bound to declared SVG elements.

The existing dark palette and square surfaces are retained. Operator buttons
have at least 56px touch targets; brighter borders, distinct selected states and
readable disabled labels provide contrast without a separate styling system.

## Entry and Engine boundary

`src/entry/conductor.entry.ts` resolves deployment/URL/stored choices, starts one Run,
applies its initial M5 host, mounts the page and connects page exit to cleanup.
`conductor.page.ts` mounts panels against narrow Show/Run/M5/XR capabilities.
Show owns playback/language; Run owns experience lifetime and the current
`resetShowAndFlight` operation (rewind, reset flight, hold). That operation does
not replace the Run. Browser reload and stored preferences belong to Entry.

## Public interface and retained interaction

Panels draw a local view state and invoke only their needed public commands.
`ConductorViewState` combines Show, XR, M5 and diagnostic observations for drawing. Drag preview, seek throttling, `wasPlaying`, keyboard mapping and
confirmation timers are legitimate UI behavior. Schedule arithmetic remains
in `dramaturgy`; device validity remains in M5.

Play/Pause toggles playback. Stop immediately rewinds, resets flight and pauses
through Run; the selected language is retained. The timeline is the only time
display. Language changes preserve playback and show position. Language selection sits below transport; the canvas stays in the main
surface when technician tools open or close. The timeline exposes its position
as a keyboard-accessible slider: arrow keys seek by five seconds (thirty with
Shift), Home and End jump to the bounds. Its geometry follows Show time directly.

Technician tools use a native modal dialog: focus stays inside, Escape closes it
and focus returns to the opener. Global show shortcuts are inactive while it is
open. The language panel owns only language controls; the drawer owns its
headset control, speed, resets and diagnostic readouts.

The wake overlay displays suspended audio; Audio owns its user-activation
listeners. Normal operator clicks and the playback shortcut request available XR
by default, within the browser-required user activation. Explicit headset start/stop
remains in technician tools. During XR World copies the rendered left eye to the desktop canvas within the
same frame, capped at 1280 × 720; no second scene render is added.
M5 preview observes accepted samples without consuming flight button edges.
The expandable Controller state section shows the last parsed `/state` reply
and bundled firmware inside the drawer. It reuses the existing poll; metadata
differences never prevent steering from the configured host.
"Picture OK" is a browser-metric heuristic, not Windows-PCVR acceptance.

## Resources and styling

UI releases its listeners, subscriptions, timers and cloned chapter nodes. Static
markup belongs to `src/ui/conductor.html` and survives UI cleanup. The entry connects
page exit/cancellation to Run's awaited cleanup; UI never unloads its children.
All authored styling lives in `src/ui/app.css` under the [Engineering Standards](../../../docs/engineering-standards.md#application-styling).
The [target architecture](../../../docs/target-architecture.md#3-target-structure)
owns diagrams and placement; the [roadmap](../../../docs/roadmap.md) owns order.
The full visitor restart and XR/calibration operation remain #9/#46.

## Verification record

The [design review and evidence](../../../docs/evidence/conductor-ui/design-qa.md)
record the mockup comparison, independent structure/accessibility reviews,
desktop/narrow screenshots, interaction checks and the dialog close-state fix.
The [language follow-up](../../../docs/evidence/conductor-ui/language-smoke.json)
records successful browser checks for continuous EN/DE switching and preserved
pause state. Implementation validation included lint, build and focused tests;
these records do not establish physical PICO/M5 or Windows-PCVR acceptance.
