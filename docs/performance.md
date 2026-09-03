# Performance

Performance is the primary product requirement. The complete physical Windows,
SteamVR, wired PICO Business Streaming, and headset presentation chain is the
final authority; desktop checks only detect regressions.

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
- Magnetic Sense adds one opaque sky-dome draw call, no geometry and no
  render pass, and since 2026-09-01 no Terrain fragment work at all. Its
  four-octave noise runs only inside the two pole cones, behind one coherent
  early-out; the open sky costs a gradient and a handful of scalar ops
- fixed Terrain staging arrays and no geometry allocation during recycling
- fixed chunk-window capacity
- stream queue capacity of 256 jobs
- provisional stream-work deadline of 0.5 ms per frame
- no geometry or material allocation during particle, grass, vegetation, or
  rock recycling
- the clipmap grass field runs in every level from echolocation on and is
  the largest single addition since this list was written: one 786 KB
  instance buffer shared by every chunk and level, no vertex buffer written
  after load, per-blade culling in the vertex shader, and a one-time 35.8 ms
  fill of its height texture during `load`. Measured against the same level with the
  field removed, on the quick profile, Apple GPU: it adds 78 draw calls,
  0.3 M triangles, and about 2 ms p95 — Thermal Perception goes from 81 draw
  calls and 3.7 ms p95 to 159 and 5.6 ms. `renderer.info.triangles` counts
  every culled blade as a degenerate triangle, so that count overstates the
  work.

  Where that cost sits was measured too, and it is not where reaching
  further would put it. Reducing the fade distance from 128 m to 72 m moved
  nothing, because the density law has already thinned the distance to a few
  percent: at 100 m four blades in a hundred survive and a far chunk starts
  twenty instances. The near field is the whole cost. Halving it — 19 tufts
  per square metre to 12 — took the surcharge from 3.0 ms to 2.6 ms, and two
  blade segments instead of three took it to 2.1 ms. Pulling the
  full-density radius in from 20 m to 14 m would reach 1.4 ms and was
  rejected: the viewer flies seven metres up, so nearly everything in frame
  already sits in the thinning zone and the meadow reads as bare ground.

  That machine is not the gate: the target headset at 90 FPS allows 11.1 ms per
  frame, and neither this field nor its cost under the heat view has been
  measured across the wired PCVR path.

The 2026-08-24 short desktop Chromium settling smoke reported 89–93 FPS,
16.8–17.1 ms p95, 61 draw calls, and 5.90 million triangles after every
configured GLB loaded successfully. The current expanded view and dense
landscape still miss the 90-Hz browser budget and require physical PCVR
validation.
Before compaction, zero-scaled static capacity produced about 26 million
triangles and 35 FPS; that path remains removed.
A separate ten-minute browser soak is recorded in the
[2026-08-24 performance audit](performance-audit-2026-08-24.md); there is still
no physical wired PCVR measurement.

The 2026-08-23 World Surface refactor removed hard zone classification and
vertex colors from Terrain generation. Neutral Terrain samples only ground
height. The optional Zone Visualizer instead writes four continuous conditions
per vertex and classifies them after GPU interpolation. The earlier Terrain
initialization benchmark predates this final visualizer path and is therefore
not retained as current evidence.

The overlay provides quick development feedback from recent frame intervals
and `renderer.info`. It is not visible inside immersive WebXR and does not
replace repeatable browser profiling or physical PCVR measurements. The
current structure therefore supports performance testing but does not yet
prove a frame-rate target.

## Deterministic Benchmark

`bun run benchmark` replays one authored camera route through any level and
writes a report artifact. It exists so two measurements can be compared at
all; the overlay cannot do that, because a free-running session never repeats
the same workload.

Four substitutions make a run repeatable, and each one is a deliberate
departure from interactive behavior:

- a fixed timestep replaces the wall clock, so world state follows the frame
  index instead of machine speed
- an authored route replaces desktop controls
- a fixed frame count replaces a duration
- a virtual clock replaces the stream queue's 0.5 ms wall-clock budget

The last one matters when reading a report. Production streaming completes as
much work as fits in a time budget, so a faster machine leaves more content
resident. A benchmark instead advances a fixed number of stream steps per
frame. Its counters therefore repeat exactly, but its streaming behavior is
not the production one, and streaming spikes must still be judged from a
normal session.

Only `renderer.info` counters are treated as facts. They are exact integers,
they repeat across machines, and `tests/benchmark/benchmark-baseline.ts`
records the accepted values so `--check` fails on a real change in what the
scene draws. Frame times from the same run are measurements: comparable to
another run on the same machine and rendering path, and nothing else. Headless
runs use SwiftShader and describe a software rasterizer, not a headset.

The harness is documented in [src/benchmark](../src/benchmark/README.md) and
[tests/benchmark](../tests/benchmark/README.md).

## Acceptance Targets

- Primary target: stable 90 Hz with an 11.11 ms frame interval.
- Candidate fallback: stable 72 Hz with a 13.89 ms frame interval.
- The application must leave time for the browser, XR compositor, audio, and
  streaming instead of consuming the complete frame interval.
- A profile becomes accepted only after repeatable testing across the complete
  wired PCVR chain.

## Metrics to Add

The benchmark already reports frame-time percentiles, missed-frame runs,
`renderer.info` counters, peak queue depth, and the frame at which streaming
drains. Still missing:

- module update, stream work, and GPU upload time
- stale stream jobs
- memory growth during a long flight
- module load, activation, deactivation, and unload cost
- PC render, encode, transport, decode, presentation, and total latency

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
→ measure across wired PCVR → simplify → measure again → checkpoint
```

A performance regression blocks completion until it is removed or explicitly
accepted with measured evidence.
