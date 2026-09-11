# Conductor

## Responsibility

The operator UI at `/conductor.html` controls the local station.
The show and embedded experience preview run in this same browser page.
The target folder owns DOM, input bindings, gesture preview, confirmations,
status presentation and UI cleanup. It owns no Show clock or visitor policy.

## Operator layout

- Top: Sound, Controller and Headset status, the Picture button, and technician tools.
- Main: large Play/Pause and Stop controls, EN/DE below, and the live preview
  alongside them on desktop. Narrow layouts stack controls and preview.
- Bottom: one continuous timeline with chapter progress and chapter jump buttons.
  There is no separate elapsed-time display.

Status combines an icon, readable text and color. Headset status explicitly shows
Checking, VR unavailable, Ready or Streaming. Icons stay visible regardless
of device connection. The M5Stick
uses Lucide's rectangular `smartphone` glyph with a small button. Icons are
individual SVG assets from the installed package, bound to declared SVG elements.

The existing dark palette and square surfaces are retained. Operator buttons
have at least 56px touch targets; brighter borders, distinct selected states and
readable disabled labels provide contrast without a separate styling system.

## Entry and Engine boundary

`src/entry/conductor.entry.ts` resolves deployment/URL/stored choices, starts one Run,
applies its initial M5 host, mounts the page and connects page exit to cleanup.
`conductor.page.ts` mounts panels against narrow Show/Run/M5/XR capabilities.
Show owns main playback/language; Run owns experience transport and the current
`resetShowAndFlight` operation (rewind, reset flight, prepare a paused tutorial). That operation does
not replace the Run. Browser reload and stored preferences belong to Entry.

## Public interface and retained interaction

Panels draw a local view state and invoke only their needed public commands.
`ConductorViewState` combines Show, XR and M5 observations for drawing. Drag preview, seek throttling, `wasPlaying`, keyboard mapping and
confirmation timers are legitimate UI behavior. Schedule arithmetic remains
in `dramaturgy`; device validity remains in M5.

The Conductor initially waits for Play. Play/Pause controls tutorial and main Show
through Run. Tutorial pause holds speech, lesson time and flight. Stop rewinds the
main Show, resets flight and prepares a paused tutorial, including during training
or its transition. The readout distinguishes running, paused, loading, buffering,
blocked audio and retryable errors; the Tutorial chapter is marked while active.
The Tutorial chapter invokes the same command. The selected main Show language
is retained. The timeline is the only time display. Language changes preserve playback and show position. Language selection sits below transport; the canvas stays in the main
surface when technician tools open or close. The timeline exposes its position
as a keyboard-accessible slider: arrow keys seek by five seconds (thirty with
Shift), Home and End jump to the bounds. Its geometry follows Show time directly.

Technician tools use a native modal dialog: focus stays inside, Escape closes it
and focus returns to the opener. Global show shortcuts are inactive while it is
open. The language panel owns only language controls; the drawer owns speed, resets and diagnostic readouts.

The wake overlay displays suspended audio; Audio owns its user-activation
listeners. Picture intent starts enabled. The main Picture button displays actual session state
and allows explicit start/stop. The headset panel uses the existing bounded observation
tick to request available XR and recover unexpected session ends. Transient failures
retry every two seconds; browser permission failures wait for an operator click or
playback shortcut and display "Picture: click to retry". Explicit picture-off suppresses
automatic starts until the Picture button enables them again. UI cleanup stops retries.
WebXR cannot guarantee activation without a user gesture or detect every native
streaming fault while a session remains active. PICO/SteamVR transport recovery must
be verified on Windows. Battery telemetry is tracked separately in #131. During XR World copies the rendered left eye to the desktop canvas within the
same frame, capped at 1280 × 720; no second scene render is added.
M5 preview observes accepted samples without consuming flight button edges.
The expandable Controller state section shows the last parsed `/state` reply
and bundled firmware inside the drawer. It reuses the existing poll; metadata
differences never prevent steering from the configured host.

## Resources and styling

UI releases its listeners, subscriptions, timers and cloned chapter nodes. Static
markup belongs to `src/ui/conductor.html` and survives UI cleanup. The entry connects
page exit/cancellation to Run's awaited cleanup; UI never unloads its children.
All authored styling lives in `src/ui/app.css` under the
[Development guide](../../../docs/development.md#ui-and-documentation).
The [binding architecture](../../../docs/architecture.md#integration-star)
owns dependencies and placement; GitHub issues own order.
The full visitor restart and XR/calibration operation remain #9/#46.

## Verification

`bun tests/browser/headset-picture.mjs` exercises the real Conductor against a
simulated XR contract: user activation, unexpected end, explicit off, transient
retry spacing, reconnect and UI cleanup. Run Vite on port 4180 first, or pass
the base URL as the first argument.

## Verification record

Historical visual and language evidence remains in Git and the owning issues.
Local checks do not establish physical PICO/M5 or Windows-PCVR acceptance.
