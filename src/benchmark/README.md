<!--
Purpose: Document ownership of the deterministic benchmark harness.
Context: Performance claims need a workload that repeats identically.
Responsibility: Explain what belongs in src/benchmark and what does not.
Boundary: Rendering, level data, and the browser runner live elsewhere.
-->

# Benchmark

This folder owns the replayed measurement mode. It is inert unless the browser
entry is opened with `?benchmark`.

`benchmark-settings.ts` authors the camera route, the warmup frame count, the
stream step count, the 90 Hz frame budget, and the replay profiles.
`benchmark-route.ts` interpolates a camera pose from a route time.
`benchmark-report.ts` summarizes recorded frames. `benchmark-run.ts` glues them
to the `FrameControl` contract of the World Runtime.

## Why the mode exists

Determinism comes from the application, not from browser automation. Four
things are substituted while a benchmark runs:

- a fixed timestep replaces `Timer.getDelta()`, so world state follows the
  frame index instead of machine speed
- the authored route replaces desktop controls, which need PointerLock
- a fixed frame count replaces a duration
- a virtual clock replaces the stream queue's wall-clock budget, because a
  faster machine would otherwise complete more streaming work per frame and
  leave different content resident

`src/` contains no `Math.random()`, so world generation is already
deterministic once the camera path is. A warmup block of frames runs first and
is discarded, because the stream queue advances a fixed number of steps per
frame and needs a known frame count to fill the resident pools.

The last substitution is a real tradeoff: a benchmark measures a fixed
streaming rate, while production streaming is time-budgeted. Streaming spikes
must therefore still be judged from a normal interactive session.

`streamStepsPerFrame` is the tunable that decides that rate. Too low and the
queue sits at its capacity, rejecting work, so the counters describe dropped
jobs rather than the scene; too high and the added per-frame CPU work inflates
every measured frame time. The recorded value keeps the heaviest level clear of
the capacity ceiling and should be recalibrated against a real GPU session
before frame times are quoted anywhere.

## What the numbers mean

Counters from `renderer.info` are exact integers and repeat across machines.
Frame times are measurements and only compare against a run on the same
machine and rendering path. The two never mix in one pass/fail decision.

The optional overlay from `src/test-ui` stays off during a run so its DOM writes
do not enter the samples. The benchmark remains valid after that overlay is
removed; it owns its own sampling and report path.

Viewport size is part of the workload and must be pinned by the caller.
Frustum culling depends on the camera aspect ratio, so a different window
shape produces different draw counts.

## Next measurement profile

The existing route measures independent static levels after a warmup. It does
not measure the default show's first cue activations. The next extension is a
separate cold-transition profile that opens a fresh WebGL context and crosses
each authored cue once. Keep it separate from this route: it answers a
different question and must not turn the benchmark runtime into a generic
scenario framework.

Neither profile reproduces the installation transport. Final performance
acceptance runs on the Windows station and USB-C-connected PICO through
SteamVR, using the production clock and time-budgeted stream queue.
