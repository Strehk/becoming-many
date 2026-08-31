# Mycelium

This module owns the Connections sense of level 07: a pulsing mycelium web
alpha-blended over the unchanged carried world inside a viewer-centred
radius, connecting the deterministic world positions of the other modules'
content.

`createConnectionsModule` returns one world module owning the fixed GPU
pools (one instanced cord-envelope mesh whose fragment shader draws three
fine meandering filaments plus knots per edge, and one node point cloud —
exactly two transparent draw calls, motion-trail precedent), the 7×7
window of 32-metre chunks, the anchor-gather stream jobs, and the topology
worker. It patches no material; the carried surface stack stays untouched.

Topology (kNN plus minimum spanning tree, O(n²)) runs in the repository's
first Web Worker, owned by this module: created on `load`, terminated on
`unload`, reached only through the typed transferable messages in
`topology-messages.ts`. The pure math in `network-topology.ts` stays
worker-free for Bun tests; tests inject a synchronous fake through the
`TopologyPort` seam. Stale replies are discarded by an aggregate window
generation.

Node anchors enter through the shared `ConnectionNodeSource` /
`ConnectionActorSource` contracts in `src/modules/connection-nodes.ts`.
Providers (vegetation, rocks, scent particles, animals) replay their own
deterministic placement math; this module never imports a sibling.

The related [Wurzeln project](https://github.com/dweigend/wurzeln) explored
the extracted topology principles in more depth; its traffic-reinforcement
simulation was deliberately not carried over ("pulses on a static web").
