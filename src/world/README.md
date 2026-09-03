<!--
Purpose: Document the permanent World Runtime and bounded scheduling contracts.
Context: Content modules share one renderer, viewpoint, chunk grid, and stream budget.
Responsibility: Explain ownership and invariants under src/world.
Boundary: Content lives in src/modules; input in src/control; facts in src/world-surface.
-->

# World

This folder owns permanent execution infrastructure: the single render loop,
WebXR integration, viewer rig, module lifecycle, aligned chunk grid, global wind,
and bounded stream queue.

`world-runtime.ts` creates one XR-compatible WebGL2 renderer, scene, rig with a
child camera, module runtime, and stream queue. Desktop look or headset tracking
owns the camera's local pose; navigation moves the rig. Modules receive the
combined world-space viewpoint.

Every frame follows one order:

```text
update time and navigation
→ update active modules
→ advance bounded streaming work
→ render once
```

`module-runtime.ts` owns the lifecycle
`load → activate → update → deactivate → unload`. Loading creates fixed CPU/GPU
resources; streaming recycles them. Modules never create animation loops.

## Spatial Windows

`chunk-system.ts` defines an aligned X/Z grid and `volume-chunk-window.ts`
extends it through Y. Chunk sizes are power-of-two multiples of the 16-metre
base. Each window maps absolute coordinates onto a fixed slot pool and reports
only changed assignments.

Assignments carry revisions. A producer checks that its revision remains
current before publishing delayed work, preventing a recycled slot from
receiving stale content.

## Stream Queue

`stream-queue.ts` advances cooperative jobs within one shared frame budget.
Every job receives at most one step per update, and a stable resource key lets
newer pending work replace older work for the same slot. JavaScript cannot be
interrupted mid-step, so producers keep each step small.

The only shared priority is the current Terrain-before-dependent-content rule.
There is no generic dependency graph, worker pool, asset prefetcher, or adaptive
quality framework.

## Wind

`wind.ts` is the single deterministic source of global wind direction and
strength over time. Scent and other dynamic consumers sample it; the legacy
Grass material currently samples only the mean direction. Aligning every
consumer with the time-varying sample is tracked in issue #28.

World Runtime does not know whether a slot contains terrain, particles, grass,
or another feature. Each consumer owns generation, resources, rendering, and
disposal.
