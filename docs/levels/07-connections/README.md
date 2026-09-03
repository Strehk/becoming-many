# 07 — Connections

## Current Experience

Connections is the final synthesis. From 5:35, a viewer-centred underground
reveal exposes a pulsing mycelium/root web linking deterministic plants, scent
emitters, rocks, and soil nodes. Earlier sensory layers remain present until the
show begins its return to White World at 7:26.

Animals are deliberately not authored as network sources in the current level.

## Runtime Ownership

[`connections.level.ts`](../../../src/levels/connections.level.ts) carries the
Magnetic preset and authors the Connections parameters. The Mycelium module
owns topology generation, its worker, and two fixed render pools. Neutral
`ConnectionNodeSource` contracts expose anchors; Level Runtime wires enabled
providers, so the module imports no concrete sibling.

Worker results are discarded when stale and published into existing buffers.
The worker is module-specific and does not establish a generic worker system.

## Current Risks

The final layered state is a worst-case visual composition and requires physical
PICO measurement. New node families or denser topology are product and
performance changes and require a dedicated issue.
