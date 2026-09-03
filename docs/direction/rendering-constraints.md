# Rendering Constraints

Hard-won constraints for the confirmed Windows-to-PICO PCVR path. The
rendering stack is WebGL2 with raw GLSL ES 3.00 files
([architecture decisions](../architecture-decisions.md)). Several constraints
are already the idiom of the current modules; they are recorded here so they
survive refactors.

- **WebXR rig rule.** The camera lives in a `Group` that locomotion moves.
  Mutating `camera.position` directly is a silent no-op in immersive sessions —
  this failure cost a full demo once.
- **CPU sets up, GPU animates.** Setup work produces immutable typed arrays;
  per-frame cost is uniforms and bounded uploads. Every rendering reference
  project converged on this independently.
- **Integer-cell hashing.** Procedural per-instance variation (jitter,
  rotation, size, wind phase, fades) derives from hashing the **integer world
  cell** — never a buffer index or floating position. This is what keeps
  streaming, recycling, and any future re-origining flicker-free.
- **Undeformed footprint.** A sense that paints a field pattern onto animated
  geometry samples the field at the *undeformed* world position, passed
  alongside the deformed vertex. Wind moves the rendered blade; the pattern
  stays nailed to the landscape.
- **Capacities are runtime values.** Buffers are allocated at preset ceilings;
  visible counts are draw-range/instance-count values that can be turned at
  runtime — never compile-time constants baked into a dispatch size.
- **No measurement overhead in the audience path.** Performance sampling and
  GPU timing exist only while a diagnostics overlay is open; never permanently
  wrap the render call.
