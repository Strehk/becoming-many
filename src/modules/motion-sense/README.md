<!--
Purpose: Document the Motion Sense module's ownership and boundaries.
Context: Level 04 makes movement the primary way the world becomes visible.
Responsibility: Explain the fly swarms, the trail ring, and the actor seam.
Boundary: Level values live in presets; composition lives in the Level Runtime.
-->

# Motion Sense

Motion Sense is the level-04 content module: persistent ambient fly swarms,
invisible circling bird flocks, and one raptor holding a ring over the
landscape, whose movement prints fading motion-trail ring buffers — movement
literally leaves a visible trace. The raptor's body joins from level 05 on,
where the heat view first shows a warm body at all; before that its ring is
a line drawn across the sky and nothing else. It is a port of
the proven bm-base motion layer (`mosquito-flocks` plus the
`ParticleTrailBuffer`), rewritten from WebGPU/TSL to this repository's
WebGL2 idiom: `THREE.Points`, `PointsMaterial`, `onBeforeCompile` patches,
and raw GLSL ES 3.00 files.

## Ownership

- `motion-sense.ts` connects the actors to the shared `WorldModule`
  lifecycle, pairs each `MotionPointSource` with its own trail ring, and
  exports the level contract. It never imports a sibling module.
- `fly-swarms.ts` owns the fly boid simulation: deterministic hash placement
  on player-centred distance rings, stepped-noise buzz, strided flockmate
  sampling, lobe cohesion, a hard clamp above the anchor's fitted ground
  plane, epoch-based re-anchoring, and the opaque fly point pool.
- `raptor-flight.ts` owns the one bird that circles a **place** rather than
  the visitor: a ring standing over a fixed point of the landscape, which a
  traveller flies past and leaves behind. Only when the ring is far enough
  behind to be out of the world does another open ahead. It prints the same
  three points a flock bird does — body and both wingtips — through the same
  seam.
- `raptor-body.ts` owns the model flying that ring, and is the only body in
  the piece with a skeleton of its own: one actor can afford what sixty
  cannot. Its authored beat plays back at a fifth speed, because a soaring
  bird holds the wing and lets the air work.
- `swarm-shape.ts` owns the volume a swarm buzzes inside: the per-swarm
  anisotropic axes and yaw, the drifting density lobes flies clump around,
  the Gaussian seeding, the per-fly binding, and the envelope spring whose
  outer hold relaxes rather than stiffens. It is what keeps the clouds
  irregular, unequal, dense in the middle, and free of any boundary but the
  ground.
- `bird-flocks.ts` owns the perception-only bird flocks: deterministic
  orbits on air rings that drift after the traveler, three points per bird
  (body plus two wingtips on a hashed flap oscillation), and no scene
  object at all — only the position stream.
- `motion-random.ts` keeps the shared stateless hash streams both actors
  derive their placement and character from.
- `motion-trail-buffer.ts` owns the ring of `pointCount × lifetimeFrames`
  particles: newest-slot printing, frame-to-frame motion intensity,
  deterministic density thinning, and bounded partial uploads.
- `motion-trail-material.ts` and `fly-swarm-material.ts` own the two
  materials; the GLSL files beside them carry all shader logic.
- A swarm is never relocated where it can be seen doing it. Crossing the
  travel threshold only asks the swarms to leave: each one shrinks its specks
  away over a per-fly arrival attribute, places its anchor in the frame that
  reaches nothing, and swells back at its new ring. They take their turns a
  stagger apart, so a re-anchor reads as one cloud thinning out and another
  thickening rather than as the whole layer blinking.

## Per-frame cost is bounded uploads plus uniforms

The performance rule "CPU sets up, GPU animates" is honoured by
splitting the work: the boid simulation is irreducibly CPU (like Animals)
but bounded by the authored pool, and the trail ring stores only immutable
spawn-time attributes. Each frame the CPU writes exactly one ring slot and
the live fly positions as contiguous `addUpdateRange` requests (≈ 32 KB at
the authored 720 flies); age, fade, outward drift, and collapse derive
GPU-only from one advancing `motionFrame` uniform. Deactivation stops
printing and hides both objects; nothing per-particle is ever rewritten.

## The `MotionPointSource` seam

Every actor prints trails through the same seam: a trail ring consumes
nothing but a packed world-position stream, so the module pairs each source
with its own ring and appearance. Flies and birds implement it today;
further moving actors join without a bus, a sibling import, or any change
to the existing paths. Upgrading the point birds to bm-base's rigged
wing-vertex sampling is recorded in
`docs/levels/04-motion-perception/README.md`.

## Where the clouds are

Besides the point streams the trails print from, both actors report where
their *clouds* sit: one packed world position per bird flock and per fly
swarm, read through `readActorCenters` on the module handle. Spatial audio
places a voice on the nearest cloud of a group through it, so it never has
to scan hundreds of individual actors. The module answers with an empty
array for a group this level does not carry, and while it is unloaded.

## Known simplifications

- Flies are held above a plane fitted to the ground under their anchor, not
  above their own sampled ground. The plane follows a slope but not a
  curve, so a stray far out over a crest or a stream bank can still clear
  the terrain by the wrong margin. Per-fly sampling is the exact fix and was
  measured at 140 µs per frame at the authored density — more than the whole
  fly update — so the plane stands until that budget exists.
- Trail expansion directions point away from the global fly centroid
  (bm-base parity); a per-swarm centroid is the known refinement.
- Trail length is authored in rendered frames for bm-base parity; a
  fixed-cadence spawn accumulator is the known fix for frame-rate
  dependence.
- The current swarms are persistent and statically authored. A path-flyby event
  would be a new product feature and needs its own issue and capacity budget.
