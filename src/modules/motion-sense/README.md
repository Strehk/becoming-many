<!--
Purpose: Document the Motion Sense module's ownership and boundaries.
Context: Level 04 makes movement the primary way the world becomes visible.
Responsibility: Explain the fly swarms, the trail ring, and the actor seam.
Boundary: Level values live in presets; composition lives in the Level Runtime.
-->

# Motion Sense

Motion Sense is the level-04 content module: persistent ambient fly swarms
and invisible circling bird flocks whose movement prints fading motion-trail
ring buffers — movement literally leaves a visible trace. It is a port of
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
  sampling, soft cloud envelopes, a hard ground-clearance clamp, epoch-based
  re-anchoring, and the opaque fly point pool.
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

## Per-frame cost is bounded uploads plus uniforms

The rendering-constraints rule "CPU sets up, GPU animates" is honoured by
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

## Known simplifications

- Trail expansion directions point away from the global fly centroid
  (bm-base parity); a per-swarm centroid is the known refinement.
- Trail length is authored in rendered frames for bm-base parity; a
  fixed-cadence spawn accumulator is the known fix for frame-rate
  dependence.
- The path-flyby swarm event from bm-base is blocked on the runtime
  coordination decision (`docs/direction/open-decisions.md` §2); the
  current swarms are persistent and statically authored.
