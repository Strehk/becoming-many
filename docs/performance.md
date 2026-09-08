# Performance

Performance is the primary product requirement. Stable output on the actual
Windows-PCVR installation is the authority; Mac browser and deterministic runs
are development/regression instruments.

## Targets

- Stable 90 Hz, an 11.11 ms frame interval, on Windows-PCVR over USB-C,
  including the actual headset, host/compositor, encode, transfer and decode.
- The application must leave time for browser/XR host, compositor, audio and
  bounded streaming. A different refresh target needs a new explicit decision.
- Standalone PICO belongs to a separate project after this PC installation;
  do not add speculative standalone paths here.

The complete show and narrative Grass Clipmap have no current installation
acceptance. Basic Windows-PCVR startup and the fresh-visitor operating flow need
early physical validation, including any proposed page reload and XR re-entry.

## Current Structure

The runtime uses one renderer and render loop, fixed spatial windows, pooled or
instanced content, partial buffer updates, cooperative stream jobs, and module
owned disposal. The narrative Grass Clipmap uses a shared instance buffer and a
camera-following height texture; Connections uses fixed render pools and moves
topology generation off the frame path.

Before the Show or standalone Start becomes ready, its renderer compiles the composed material
variants and renders all resident content once into a disposable 1 × 1 target,
including initially hidden or off-frustum objects. Original visibility/culling
flags and the render target are restored before show time, controls, simulation
or narration advance; inactive content does not keep rendering.

On 2026-09-07, #16 traced 14 remaining first-Echo uploads (119,796 bytes) to the
Bat passage and two existing Terrain slots. Including them in the same preparation
pass removed those uploads and two texture initializations. All eight cues,
first and repeated entry, then recorded zero new buffers, programs or texture
initializations (16 observations). This is instrumented local initialization
evidence, not frame-time or Windows-PCVR acceptance. Raw identities and before/after
results are retained in [#16](https://github.com/Strehk/becoming-many/issues/16).

The schedule's opening show state is applied before module construction and
loading. Fixed Terrain and Air Particle windows therefore use the authored
opening view distance instead of Three.js's default camera far plane.

This bounded structure prevents unbounded growth but does not prove the frame
budget. Thermal fragment work, physical first-use validation, Grass ownership,
redundant diagnostics, and complete-show transitions remain active performance
concerns.

The confirmed target keeps the prepared world throughout a visit, with one
preparation/resource/background-work strategy for quiet transitions. Between
visitors the old run ends fully and a fresh one starts. Failed starts and late
asynchronous work follow the same resource ownership; sustained visitor cycles
must prove stability. Normal operation adds no diagnostic GPU probes/renderers.

## Deterministic Benchmark

`bun run benchmark` replays an authored route after `bun run build`. It replaces
wall time, interactive controls, duration, and the production stream deadline
with deterministic equivalents. Consequently:

- `renderer.info` counters are exact regression facts;
- frame-time measurements are comparable only on the same machine and path;
- virtual streaming behavior does not represent production timing;
- headless SwiftShader results do not represent a GPU or headset.

The [exact stored/current counter comparison](evidence/issue-78/README.md)
records all nine levels and the seven failing references. Repeated headed runs
agree, including the after-#82 run; the production baseline remains unchanged.

#78 now uses a bounded comparison of a defined pose, intended scene, available
content and repeatable counters. Explain relevant differences, then propose the
concretely verified scene as the new reference; exhaustive reconstruction of
historical triangles is unnecessary. The existing numerical candidate is not
approved. Preserve the previous failures/comparisons before any explicit update.

#80 retires four unauthored animal-edge rows: Connections quick triangles change
from 3,759,816 to 3,759,752, and full triangles from 4,042,554 to 4,042,490.
Other counters and streaming records are unchanged; three comparable headed
before/after runs show no repeatable percentile slowdown. This is a capacity
removal, not a measured speedup or Windows-PCVR acceptance. Exact runs and the
static-buffer equivalence proof live in [#80](https://github.com/Strehk/becoming-many/issues/80).
The old #78 candidate remains historical, unapplied and unapproved; future
reference review must include this separately explained change.

These counters include degenerate triangles emitted by shader-culling paths and
therefore overstate visible grass geometry. The full-profile baseline has not
yet been accepted.

#26 removes synchronous Scent fills after queue rejection and stores binary
visibility in one byte rather than four (75% less for this attribute only).
Three headed full-profile runs before/final on Chromium 151, Metal M2 Max,
1280 × 720, AC power and awake display retain identical counters and queue
records. Median/p95 remain 0.1/2.4 ms; p99 is 2.6/2.5/2.5 before and 2.5 in
all final runs. Maximum intervals remain 848.7/953.2/928.8 ms before versus
839.8/855.1/840.2 ms final. A diagnostic places one long gap outside captured
World JavaScript callbacks; its native/browser cause remains unknown. Initial
queue-only percentile increases and the subsequent interleaved comparisons
are retained in [#26](https://github.com/Strehk/becoming-many/issues/26).
This fixes queue behavior without demonstrating stable installation 90 Hz.
Density and occluder tuning remain open; plant capacity is derived from the
shared placement grid, so reducing it independently would discard valid plants.

#32 skips the existing body-heat loop for actor surfaces with zero response.
No shader variant, palette or octave setting changes. Three initial and three
interleaved headed full-profile pairs retain all counters (102 draws, 3,887,930
triangles, 14 programs) and queue records. Interleaved p95 is 2.8/2.7/2.7 ms
before and 2.8/2.8/2.7 ms after; p99 is 3.3/3.1/3.1 versus 3.2/3.1/3.0 ms.
Timing distributions overlap; no stable speedup is established. Initial and
interleaved variability, source identities and open tuning/device criteria are
retained in [#32](https://github.com/Strehk/becoming-many/issues/32).

## Dated Evidence

- The [2026-08-24 browser audit](performance-audit-2026-08-24.md) measured an
  earlier landscape composition. It remains useful evidence for the fixed-pool
  and streaming changes it tested, but its totals are not current-show totals.
- The [2026-09-02 Grass Clipmap review](performance-review-grass-clipmap-2026-09-02.md)
  records static findings against its named revision. Current code and issues
  determine which findings still apply.
- Desktop Grass Clipmap comparisons showed that near-field density and blade
  segments dominated its cost more than far fade distance. Those results guide
  tuning but do not establish PICO acceptance.
- A 2026-09-03 fresh-context Chromium run compared `compileAsync()` alone with
  `compileAsync()` plus the bounded offscreen render. No cue linked a new
  program in either run. First-activation `bufferData` calls changed as follows:

  | Cue | Compile only | With offscreen render |
  | --- | ---: | ---: |
  | Scent | 10 | 0 |
  | Echolocation | 268 | 16 |
  | Motion | 9 | 0 |
  | Thermal | 70 | 0 |
  | Magnetic | 29 | 0 |
  | Connections | 21 | 0 |

  The remaining Echolocation allocation totaled about 136 KB and did not recur
  on its second activation. These are desktop causal measurements, not accepted
  frame times or physical PICO evidence.
- A separate 2026-09-03 Chromium startup check reduced default-show readiness
  from about 22.1 seconds before the opening-state fix to 1.31 seconds for the
  first browser launch and 0.53/0.54 seconds in two subsequent fresh contexts.
  The static Test level became ready in 0.43 seconds, and the built Station
  route in 0.46 seconds. All routes returned HTTP 200 with one canvas and no
  console errors or warnings. These desktop times establish the startup-order
  cause; they do not establish physical PICO acceptance.

## Final Local Refactor Measurements — 2026-09-05 UTC

At runtime digest `5308e3e7c9163a681b52617f2a12a0245a9399d4015e535284759a4a12ce8471`
(HEAD `9bfb84b` plus uncommitted #77/#79/#82 changes), ordinary English and German
production runs each complete 521 s without unexpected errors. Both use normal
VSync, no CDP/trace/video or timer replacement, actual M2 Max / ANGLE Metal,
software rendering false, Chromium 151.0.7922.34 and awake approximately60 Hz
desktop displays. [Full reports and limits](evidence/issue-79/README.md#final-ordinary-full-shows)
retain source/diff/environment identity and raw-report hashes.

| Language | Observer duration | RAF median / p95 / p99 / max, rounded ms | Intervals |
| --- | --- | --- | --- |
| English | 522.0011 s | 16.7 / 17.6 / 18.5 / 18.8 | 31,317 |
| German | 522.0015 s | 16.7 / 17.6 / 18.5 / 18.8 | 31,317 |

Each report counts every interval above its90 Hz/11.111 ms reference. On this
60 Hz desktop those are not missed headset frames. External RAF intervals are
not GPU duration or physical PICO acceptance. Fifteen responses/eight narration
files and ten construction warnings per language do not prove audible output;
human listening was subsequently accepted on 2026-09-06 (see the roadmap).

The [#79 Echo proxy](evidence/issue-79/README.md#rendering-proxy-beforeafter-the-audio-correction)
and [#82 Connections comparison](evidence/issue-82/README.md#production-browser-and-rendering-comparison)
show unchanged counters/queues and no observed regression in three before/after
desktop repetitions. These deterministic runs contain no show audio, so they
prove no audio-CPU improvement. No speedup or new timing threshold is claimed.
Seven quick references remain failing and unchanged pending explicit #78 review.

The original #75 strict-start exception remains unassigned despite the separately
proved/corrected suspended-Tone defect and passing final shows. The additional
automated pointer-lock ground-view attempt failed separately under #83. The later
human Chrome look/relock and Connections view passed; the automated rejection
remains unexplained, without a proven rendering defect or timing regression.
The user accepted the presented human visual/audio checks on 2026-09-06.
Physical PICO, exact #78 reference and complete M0 acceptance remain open.

## Open Measurement Work

The benchmark already reports frame-time percentiles, missed-frame runs,
renderer counters, queue depth, and streaming drain. Still needed are:

- module update, stream work, and GPU upload time;
- physical first-use transition and shader-compilation cost;
- stale job and long-flight memory behavior;
- module load, activation, deactivation, and unload cost;
- actual Windows-PCVR/headset frame timing for the complete show;
- PCVR render, encode, USB transport, decode, and end-to-end latency.

The relevant issues are grouped under Performance in
[roadmap.md](roadmap.md).

## Evidence Gate (#21)

The [workflow](refactor-workflow.md), [test plan](refactor-test-plan.md) and
[pull-request checklist](../.github/pull_request_template.md) own procedure,
measurement conditions and acceptance. Comparable measurements are required
for improvement claims; desktop evidence does not establish installation or
headset acceptance. Missing physical measurements remain pending.

## Standalone Start MVP — 2026-09-08

Start adds one opaque arrow to the unchanged White World air-particle recipe.
The existing headed quick replay on Apple M2 Max (Chromium 151, 640 × 360,
240 warmup frames) records 2 draw calls, 5 triangles, 2 geometries, 0 textures
and 2 programs; White World records 1, 0, 1, 0 and 1 respectively.
Source identity: `a136bcc` implements the Start block; the first comparison
ran on its unchanged source before commit (source SHA-256
`99a41fcf82941c222489e3db3210bc7385025b4494c15bfedcdcd8fcd8fb9b92`).
Scratch evidence is `benchmark-results/start-mvp/compare-1/quick.json`.
Only deterministic counters are retained as evidence: concurrent UI acceptance
could affect timing. A second timing attempt was interrupted during a concurrent
production rebuild and is not evidence. Neither run changes a benchmark reference
or establishes Windows-PCVR performance.

Both standalone URLs completed the real M5 polling path with simulated firmware
responses in headed Chromium, including invalid input, wrong direction, neutral
gating, held diagonals and reload. Unit checks cover hidden/inactive updates and
resource disposal. Completion remains visible, costing placement and one guide
draw per frame; deactivation hides it and stops its updates.


## UI completion review — 2026-09-08

The [completion evidence](evidence/ui-consolidation/README.md#performance-and-remaining-limits)
compares unchanged `0e2c676` with the recorded corrected UI build in sequential
headed Chromium full replays on Apple M2 Max, 1280 × 720. Connections and Test
retain all renderer/streaming counters; median/p95/p99 show no regression in
these individual samples. No speedup or installation acceptance is claimed.
Actual served build hashes are preserved separately from the harness checkout.
The supplementary normal-show baseline did not complete and was terminated;
its page/context failures remain unresolved. No paired normal-show result exists.
Subsequent Conductor/Entry changes require their own relevant verification.
