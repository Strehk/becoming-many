# Performance

Performance is the primary product requirement. The physical PICO headset is
the final authority; desktop checks only detect regressions.

## Current Evidence

The current 180-metre landscape test structure is deliberately bounded:

- one renderer and one render loop
- one browser-only Test Level overlay for FPS, p95, draw calls, and triangles
- one `THREE.Points` object for all 58,320 resident Test Level Air Particles
- fixed position and visibility buffers with partial slot-range updates
- 49 fixed Terrain meshes with 100,352 resident triangles
- one fixed Grass mesh with 152,100 candidates and 304,200 resident triangles
  inside its own 64-metre range, down from 492,804 and 985,608 when the range
  followed the 180-metre view distance
- compact instanced Vegetation and Rock draws that exclude rejected capacity
- ten animal actors with at most four visible animation mixers and slope samples
- Magnetic Sense reuses the Terrain draws and adds no geometry or render pass
- fixed Terrain staging arrays and no geometry allocation during recycling
- fixed chunk-window capacity
- stream queue capacity of 256 jobs
- provisional stream-work deadline of 0.5 ms per frame
- no geometry or material allocation during particle, grass, vegetation, or
  rock recycling

The 2026-08-24 short desktop Chromium settling smoke reported 89–93 FPS,
16.8–17.1 ms p95, 61 draw calls, and 5.90 million triangles after every
configured GLB loaded successfully. The current expanded view and dense
landscape still miss the 90-Hz browser budget and require physical PICO
validation.
Before compaction, zero-scaled static capacity produced about 26 million
triangles and 35 FPS; that path remains removed.
A separate ten-minute browser soak is recorded in the
[2026-08-24 performance audit](performance-audit-2026-08-24.md); there is still
no physical PICO measurement.

The 2026-08-23 World Surface refactor removed hard zone classification and
vertex colors from Terrain generation. Neutral Terrain samples only ground
height. The optional Zone Visualizer instead writes four continuous conditions
per vertex and classifies them after GPU interpolation. The earlier Terrain
initialization benchmark predates this final visualizer path and is therefore
not retained as current evidence.

The overlay provides quick development feedback from recent frame intervals
and `renderer.info`. It is not visible inside immersive WebXR and does not
replace repeatable browser profiling or physical PICO measurements. The current
structure therefore supports performance testing but does not yet prove a
frame-rate target.

## Acceptance Targets

- Primary target: stable 90 Hz with an 11.11 ms frame interval.
- Candidate fallback: stable 72 Hz with a 13.89 ms frame interval.
- The application must leave time for the browser, XR compositor, audio, and
  streaming instead of consuming the complete frame interval.
- A profile becomes accepted only after repeatable physical-headset testing.

## Metrics to Add

Measure at least:

- median, p95, and p99 frame time
- missed-frame runs and visible spikes
- draw calls, triangles, geometries, textures, and programs
- module update, stream work, and GPU upload time
- queue depth, stale jobs, and time until content is ready
- memory growth during a deterministic long flight
- module load, activation, deactivation, and unload cost
- PC render, encode, transport, decode, and total latency if PCVR proceeds

The first instrumentation should remain small: a deterministic route, frame
percentiles, `renderer.info`, queue depth, and streaming duration.

## Current Scheduling Rules

- The world runtime advances the shared queue once per frame before rendering.
- Every job performs at most one cooperative step per queue update.
- The queue checks its deadline between steps and cannot interrupt running
  JavaScript.
- Stable resource keys replace older pending work for the same slot.
- Fixed resource pools are recycled instead of recreated.
- Air Particles and Grass preload one chunk ring outside the visible radius.
  Grass measures that radius against its own 64-metre range rather than the
  level view distance, which is the 2026-08-24 audit's P1 fix: range and
  preload before density, with the authored zone densities left untouched.

Level Runtime asynchronously preloads the fixed asset definitions of enabled
modules before World Runtime starts. Distance priorities, future-level
prefetching, progress UI,
retries, and shader warmup are not part of the current scheduler.

## Terrain Candidate

The implemented first candidate is recycled CPU-sampled chunk terrain:

- 64-metre chunks
- 7×7 fixed resident mesh pool at the current Test Level 180-metre view distance
- 32 segments per side and 2,048 triangles per chunk
- one sampled vertex row per stream-queue step
- fixed staging arrays and atomic publication of complete chunks

Measure browser frame time, streaming spikes, uploads, memory stability, and
future vegetation placement before accepting it. A GPU geometry clipmap should
be built only if this measured candidate is not viable; no strategy framework
is needed in advance.

Do not add workers, generalized pooling, relevance fields, or adaptive quality
before this experiment demonstrates a need.

## Development Loop

```text
build one element → verify correctness → measure in browser
→ measure on PICO → simplify → measure again → checkpoint
```

A performance regression blocks completion until it is removed or explicitly
accepted with measured evidence.
