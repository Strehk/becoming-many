# Mycelium

This module owns the Connections sense of level 07: a pulsing root system read
through the soil inside a viewer-centred radius, connecting the deterministic
world positions of the other modules' content through a mat of its own seeded
soil points.

`createConnectionsModule` returns a handle: one world module beside the
`setIntensity` runtime driver a show fades the sense through.

The module owns the fixed GPU pools (one instanced cord-envelope mesh whose
fragment shader draws three fine meandering filaments plus knots per edge, and
one node point cloud — exactly two transparent draw calls, motion-trail
precedent), two chunk windows, the seeded soil mat, the anchor-gather stream
jobs, and the topology worker. It patches no material; the carried surface
stack stays untouched.

## Seen through the ground, at two strengths

The mat is buried, and a depth-tested cord under an opaque surface is not merely
dim — it is invisible. What it is read through is the ground's own alpha, and
that alpha has two values, because the level's surface has two kinds of place.

**Bare earth** opens to `soilBareOpacity`: enough to read the cords through it,
and no further, because whatever no cord covers blends toward the carried
background instead. **Ground the grass field covers** stays at
`soilCoveredOpacity`, nearly solid — a lawn has to keep looking like a lawn, and
the opaque blades standing on it already hide most of what is below, so the
cords show only between them. That is the weakened reading grass should give,
and it costs nothing: it falls out of the blades' own depth.

Which is which comes from the grass module, not from a second guess at it.
`soil-opening.ts` declares a `coverAt` sampler, Terrain streams it per vertex
beside the thermal warmth it already streams for the same reason, and the
composition root wires it to `getGrassZoneCoverage`. Deriving the zones again in
GLSL would fork the answer the day the grass field changes its coverage table.

The effect is a terrain material effect, the same extension point Thermal and
Echo use, so no foreign material is patched by hand. The order is the reason it
works: the ground joins the transparent pass at the default render order and the
web draws at `-1`, ahead of it, so the mat is painted first and the soil blends
over it. Trees, rocks, animals, and grass blades are opaque and were drawn
before either, so they still occlude the web through ordinary depth testing.
What the ground no longer does is hide the web behind a hill — the terrain's
depth arrives after the web is already drawn. That follows from asking the
ground to be see-through, and it is bounded by the 30-metre reach.

An earlier variant dithered the soil away instead of blending it; it reads as a
pixel screen rather than as earth, and it throws away the carried colour it
punches through. A variant that left the ground untouched and composited the mat
over the finished world with depth testing off was also built: it keeps the
surface perfect but lets cords paint over tree trunks, and it cannot use grass
to weaken anything.

The mat carries bone, sinking to plum at the cord midpoints. Real mycelium is
white, and against thermal's cold half, echo's grey, and green grass it is the
strongest contrast this palette has. The pulses moved to amber, because cream
pulses on cream strands would be no pulses at all.

## Two windows, and why cords never move

Topology is built **per chunk**, not per window. A chunk's cords are a pure
function of its own nodes and its eight neighbours', and both are pure
functions of world coordinates — so a chunk built once is built the same way
forever. Walking therefore only ever adds ground at the rim; nothing already on
screen is recomputed, and no cord reroutes underfoot.

That holds only if a chunk is never built with a partial neighbourhood, which
is what the second window is for. The **gather window** (7×7 of 16-metre
chunks) keeps one ring more ground than the **build window** (5×5) draws, so
every chunk that gets cords has all eight neighbours resident. Nodes in that
outer ring are never nearer than 32 metres to the viewer, so the 30-metre web
radius masks them and their missing cords are never seen.

Cross-chunk cords are claimed by the chunk holding the lexicographically first
endpoint. Both sides derive the same pair and reach the same verdict, so a seam
is drawn exactly once — never doubled into a bright grid, never dropped into a
dark one.

The cost fell with the rework rather than rising: one boundary crossing rebuilds
five chunks at roughly 0.9 million distance evaluations instead of recomputing
the whole window at 22 million. Each chunk's build is one message; the pure math
in `network-topology.ts` stays worker-free for Bun tests, and tests inject a
synchronous fake through the `TopologyPort` seam. A reply for a slot that has
since been reassigned is discarded by its revision.

Both windows stream at `SURFACE_STREAM_PRIORITY`, with Terrain. On the default
priority the queue runs all surface work first and the mat not at all while it
lasts, which is exactly how entering ground came to arrive after the visitor had
already walked onto it.

Cords carry the clock second they were written, and fade in over
`edgeFadeSeconds`. Since resident chunks are never rewritten, only genuinely new
ground ever runs that ramp. The stamp rides a second, unwrapped clock: the pulse
time wraps every minute, and a stamp compared against a wrapped clock would make
a cord vanish for the rest of the loop.

Node anchors enter through the shared `ConnectionNodeSource` /
`ConnectionActorSource` contracts in `src/modules/connection-nodes.ts`.
Providers (vegetation, rocks, scent particles, animals) replay their own
deterministic placement math; this module never imports a sibling. The soil
mat in `soil-nodes.ts` is the module's own content and satisfies the same
contract, so it joins the gather through the one path every anchor takes.

The related [Wurzeln project](https://github.com/dweigend/wurzeln) is the
source of the topology, the density, and the buried mat. Its
traffic-reinforcement simulation is still deliberately absent ("pulses on a
static web"), as is its growth-over-time animation: here the web grows with
proximity instead of with the clock.

## Reach, density, and depth

Reach before density, the rule the grass module recorded: a mat carried at the
wurzeln experiment's density cannot also span the horizon, so the sense keeps a
30-metre radius and fills it properly instead of stretching thin across 88
metres. The world's own anchors are far too sparse for that density — a dense
forest offers a few hundred over five hectares — so the module seeds its own
soil points, deterministic per chunk exactly as grass hashes its cells, and
hangs the world anchors just under their own objects so a tree meets its roots.

The window is 5x5 chunks of 16 metres rather than 7x7 of 32: soil density is
paid per square metre, and the coarser grid would have to over-cover more than
three times the visible disc to guarantee the same 32-metre reach.

Growth is the grass field's density rejection read backwards. The topology is
seeded once at full density; every cord and node carries a stable threshold and
comes out once the density its own camera distance allows reaches it. So
approaching brings out *more roots*, not fatter ones — the mat fills in around
whoever walks into it, and thins to about a third of itself at the rim.
Seeding the density by distance instead would anchor the dense core to the
chunk centre rather than to the visitor, and would rebuild an O(n²) topology on
every step.

Cord thickness is fixed and deliberately generous — roughly two-centimetre
strands, four times the sparse web's — because a root has to be legible at
walking distance. Midpoints sink toward the authored depth tint, which is what
gives the mat its colour: the tint dominates the middle of every strand.

