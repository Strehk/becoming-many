# World Streaming

World streaming maps an infinite deterministic coordinate space onto bounded,
module-owned resource pools. It is implemented infrastructure, not a general
asset-streaming framework.

## Data Flow

```text
viewer world position
→ fixed chunk-window assignments
→ module-owned deterministic generation jobs
→ shared bounded StreamQueue
→ atomic publication into recycled resources
```

`src/world/chunk-system.ts` owns the aligned surface grid and
`volume-chunk-window.ts` extends it through Y. Base chunks are 16 metres and
higher levels are power-of-two multiples, so all windows share grid lines.

## Fixed Windows

A window has a fixed radius and slot count for its lifetime. Crossing a chunk
boundary reassigns only entering edges or faces to slots that left the opposite
side. Each assignment carries absolute coordinates, an origin, a resource slot,
and a revision.

The revision is the stale-work guard. A job must check that its assignment still
owns the slot before publishing. Crossing the world never grows a pool or
creates an unbounded history.

## Stream Queue

`src/world/stream-queue.ts` advances every pending cooperative job at most once
per frame and stops starting steps when its time budget is exhausted. A stable
resource key lets newer work replace older pending work for the same slot.
JavaScript cannot be interrupted mid-step, so each producer must keep one step
small.

Terrain work currently has the minimal priority needed to publish support
before dependent static populations. No generic priority graph, worker pool,
adaptive quality system, or asset-prefetch framework exists.

## Current Consumers

- Terrain samples `WorldSurface` into recycled chunk geometry using fixed
  staging arrays.
- Air and Scent Particles update fixed point-buffer ranges.
- Vegetation and Rocks replay deterministic placements into compact instanced
  draws.
- Legacy Grass recycles chunk assignments into its fixed instanced mesh.
- Grass Clipmap keeps fixed chunk anchors and refills a camera-following height
  texture through queued work.
- Connections uses its own worker for topology, then publishes into fixed
  render pools; it does not change the shared queue into a worker framework.

Animals use a small bounded actor population rather than the shared chunk
window.

## Rules for New Consumers

- Reuse the aligned coordinates and existing assignment contracts.
- Own the complete resource pool and disposal in the consumer.
- Derive procedural content from stable world coordinates and seeds.
- Keep work replaceable and reject stale results before publication.
- Size range, preload, and capacity explicitly; do not inherit unrelated level
  distances by accident.
- Add broader scheduling infrastructure only after a measured current need.

Automated coverage for windows and queue invariants lives under `tests/world`;
consumer contracts are tested in their matching module suites.
