<!--
Purpose: Track replacement of the PC station WebSocket broker with direct same-origin browser messaging.
Context: The PC show and Conductor are separate pages on one station PC and one HTTP origin.
Responsibility: Define the smallest directional command and status wire between those pages.
Boundary: The later reduced PICO fork and Conductor UI design are outside this task.
-->

# Replace the Station Broker With BroadcastChannel

**Status:** Open
**Priority:** Architecture and operational simplification
**Issue:** [#37](https://github.com/Strehk/becoming-many/issues/37)

## Confirmed Constraint

This repository targets the Windows PC VR installation. The application
renders on the station PC and reaches the PICO headset through SteamVR and
wired PICO Business Streaming. The VR page and Conductor run in separate
browser contexts on that same PC and origin. Remote operation is not required.
A later standalone PICO version will be a reduced fork and does not justify
keeping cross-device browser transport in this codebase.

PICO Business Streaming is the headset transport and remains outside this
browser channel. Its native Windows SDK does not justify retaining a generic
WebSocket broker; any future SDK adapter requires its own concrete operator
need and narrow contract.

## Current Problem

The current connection requires:

- a separately started Bun WebSocket broker;
- socket roles and peer-presence messages;
- port, URL, reconnect, and broker-state handling;
- JSON serialization and one bidirectional `StationMessage` union;
- separate broker-connected, show-connected, and show-live states;
- a station widget and `?station` override.

This infrastructure solves a cross-process and cross-device problem that the
confirmed PC topology does not have. It also creates the trust-boundary defect
tracked in the now-superseded broker security task.

## Target Contract

Use the browser's native `BroadcastChannel` with one fixed channel name and two
directional public APIs:

```ts
interface ShowControlChannel {
  publish(status: ShowStatus): void;
  close(): void;
}

interface ConductorControlChannel {
  send(command: ShowCommand): void;
  close(): void;
}
```

Keep two small shared files:

```text
src/control-wire/messages.ts  command/status types and runtime validation
src/control-wire/channel.ts   BroadcastChannel lifecycle and directional APIs
```

The show-side command application belongs in `src/vr/show-control.ts`, not in
the shared wire. Conductor rendering and behavior stay in `src/conductor/`.

## Direction and Liveness

- Conductor sends only `ShowCommand`.
- VR publishes only `ShowStatus`.
- Parse each direction with its own validator; channel data remains untrusted.
- Do not serialize structured messages to JSON.
- Do not queue commands when no show is listening.
- Do not add presence messages or a handshake.
- Conductor considers the show live only while the last status is fresh.
- Reuse the status beat as the heartbeat; one fact replaces broker presence and
  socket connection state.

The status must exclude FPS and p95 sampling. It reports only current operator
facts: show time, playback, language, active level, audio, and summarized M5
health.

## Delete

- `station/station-server.ts` and the root `station/README.md`;
- the `station` package script;
- `src/station/station-link.ts` and `station-settings.ts`;
- `StationRole`, `PeerPresence`, and generic `StationMessage` sending;
- JSON serialization helpers and WebSocket reconnect logic;
- port and station URL configuration, including `?station`;
- the station corner widget and CSS;
- broker-specific tests and documentation.

Move the few retained status and command concepts out of `src/station/`, then
delete that folder. Keep `station/m5-sim.ts` only if it remains useful, moving it
to an honestly named development-tool location instead of preserving the folder
for symmetry.

## Performance Boundary

The shared Experience must not import the control wire. The PC VR entry attaches
`show-control.ts` after Experience startup. The later PICO fork can therefore
remove PC operator work by deleting one composition import without adding
feature flags or branches to the render hot path.

## Non-Goals

- no transport abstraction supporting both WebSocket and BroadcastChannel;
- no fallback broker, SharedWorker, Service Worker, event bus, or message router;
- no protocol versioning or schema-generation dependency;
- no PICO or cross-device implementation;
- no Conductor visual redesign in this task.

## Verification

- Two same-origin pages exchange commands and statuses without `bun run station`.
- Directional compile-time fixtures reject status sending from Conductor and
  command sending from VR.
- Runtime tests drop malformed commands and statuses.
- Opening, closing, and reloading either page leaves no listeners or timers.
- Missing or stale status disables Conductor commands.
- The PC VR entry contains the small channel adapter; shared Experience modules
  do not.
- The production status path performs no frame sampling or metric sorting.
- Run tests, typecheck, lint, build, Fallow, and a two-page browser smoke test.

## Related Tasks

- [#19 Isolate VR, Test, and Conductor Browser Entries](https://github.com/Strehk/becoming-many/issues/19)
- [#36 Simplify the Conductor Application](https://github.com/Strehk/becoming-many/issues/36)
- [#9 Complete the Application Lifecycle](https://github.com/Strehk/becoming-many/issues/9)
