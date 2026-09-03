<!--
Purpose: Record why the superseded station browser transport needs no replacement.
Context: The Conductor now hosts and commands the show in one browser window.
Responsibility: Preserve the resolution evidence for GitHub issue #37.
Boundary: The static station server, M5 HTTP polling, and PICO Business Streaming remain separate concerns.
-->

# Verify Removal of the Superseded Station Transport

**Status:** Resolved and verified
**Priority:** Architecture simplification
**Issue:** [#37](https://github.com/Strehk/becoming-many/issues/37)
**Resolved by:** `9982d18` (`Host the show in-process on the conductor page`)
**Verified:** 2026-09-02 against `328b2b9`

## Resolution

The original issue proposed replacing a WebSocket broker with
`BroadcastChannel` because the show and Conductor ran in separate browser
windows. That premise no longer matches the application.

`src/conductor/conductor-page.ts` now starts the show in-process. Its controls
call the typed functions in `src/conductor/show-actions.ts`, and its panels read
status directly from the running show. Commit `9982d18` removed the serialized
station protocol, reconnect and presence logic, separate show client, station
widget, and their protocol tests.

No replacement transport is required. Adding one would recreate a second
communication path and lifecycle without a current consumer.

## Retained Station Boundary

`station/station-server.ts` remains intentionally. It serves the production
build and exposes deployment configuration at `/config` and process liveness at
`/health`. It owns no show state and provides no WebSocket endpoint.

M5 HTTP polling and wired PICO Business Streaming are separate transports with
different owners. They are not part of this resolved browser-transport issue.

## Removal Evidence

The following former transport files must remain absent:

- `src/station/station-protocol.ts`
- `src/station/station-link.ts`
- `src/station/show-station.ts`
- `src/station/station-widget.ts`
- `src/station/station-widget.css`
- `tests/station/station-protocol.test.ts`

Runtime and test sources must also contain no active `BroadcastChannel`,
WebSocket station transport, `StationMessage`, `StationRole`, or `PeerPresence`
contract.

## Non-Goals

- no `BroadcastChannel`, WebSocket, worker, event bus, or transport abstraction;
- no split between the Conductor and show windows;
- no removal of `station/station-server.ts`, `/config`, or `/health`;
- no change to M5 polling or PICO Business Streaming;
- no unrelated Conductor redesign.

## Recorded Verification

- All six former transport files are absent, and a focused source search found
  no active station transport symbols.
- `station/station-server.ts` contains only static serving, `/config`, and
  `/health` responsibilities.
- Focused Conductor action and deployment-config tests passed: 10 tests, zero
  failures.
- `bun test` passed: 366 tests, zero failures.
- `bun run check`, `bun run lint`, `bun run build`, and both diff whitespace
  checks passed.
- Full Fallow retained the known backlog: one unused export, one unused
  dependency override, nine duplicate groups, and 17 complexity findings. The
  `origin/main` diff audit passed with no introduced findings.
- The production browser test passed on `/` and `/conductor.html`: both pages
  rendered, Play and Hold worked, required requests succeeded, and there were no
  console errors or warnings. The local browser reported only the expected XR
  unsupported information.
- The quick `connections` benchmark completed with no failures and stayed
  inside its accepted deterministic counter baseline.
- No physical PCVR run was required because this resolution changes no runtime
  code.

There is no delivery branch or pull request because no code diff remains. The
GitHub issue is closed directly with this evidence.
