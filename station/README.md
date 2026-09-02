<!--
Purpose: Document the localhost broker that joins a station's two windows.
Context: The show runs in one window and the conductor page in another.
Responsibility: Explain what this process does and what it deliberately does not.
Boundary: The wire contract and both clients live in ../src/station.
-->

# Station broker

`bun run station` starts the localhost server that
[Deployment](../docs/direction/deployment.md) calls for: the experience page and
the operator page each hold one WebSocket to it, and it passes messages between
them.

It runs under Bun, not in a browser, which is why it sits here rather than in
`src/` — the same split as the Chromium benchmark runner in `tests/benchmark/`,
which drives `src/benchmark`. Nothing in either page's module graph imports it,
so Vite never bundles it and it exports nothing.

`bun run m5-sim` starts a second small Bun process from this folder: a stand-in
M5 controller answering `GET /state` with a slow tilt sweep, for developing the
polling chain without hardware (`--device` and `--firmware` flags exercise the
wrong-device and firmware-mismatch warnings).

## What it does

- Accepts `?role=show` and `?role=conductor`, and refuses anything else.
- Relays conductor commands to the show, and show status back to conductors.
- States peer presence when a socket opens or closes, so a conductor can tell a
  closed show window from a show that is merely paused.
- Drops any message the contract does not describe, and drops presence claimed
  by a page — that is the broker's own statement, and accepting it would let one
  window lie about another.

## What it does not do

It holds no show state, keeps no schedule, and decides nothing about the piece.
The show clock stays the single authority; this process only carries words
between two windows. The show does not depend on it either: with no broker
running, the station link retries quietly and the piece plays exactly as it does
without a station.
