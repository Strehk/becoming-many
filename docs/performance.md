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

## Flight Tutorial — 2026-09-08

The existing quick benchmark compared the old Start MVP against the particle
tutorial on Apple M2 Max, headed Chromium 151.0.7922.34 with Metal, 640 × 360,
240 warmup and 210 measured frames. Local result files are
`benchmark-results/tutorial-before/quick.json` and
`benchmark-results/tutorial-after/quick.json`; the baseline was clean checkpoint
`1adc872c6a706c6ef082dae80b482e75ea3d74a3`. The first measured candidate predates the
latest instruction-pacing/reset fixes and final goal spacing. The JS asset
manifest in `/tmp/tutorial-measured-build.sha256` has SHA-256
`39adf86b812ddf1301a2fa3cb06270015540e23c4a30ee46c4ad1dccd55ea60e`.

| Measurement | Before | Particle tutorial |
| --- | ---: | ---: |
| Draw calls | 2 | 2 |
| Triangles | 5 | 0 |
| Geometries / textures / programs | 2 / 0 / 2 | 2 / 0 / 2 |
| Maximum stream queue | 0 | 0 |
| Median / p95 / p99 frame interval | 0.1 / 0.2 / 0.5 ms | 0.1 / 0.3 / 0.4 ms |
| Maximum frame interval | 1.4 ms | 2.5 ms |

The final recipe keeps horizontal goals level and separates later goals by 60 m,
so the unchanged 5 m/s glide does not routinely overtake their 7.5 s visual
transition. The follow-up at `benchmark-results/tutorial-final/quick.json`
(source digest `09631279727bb6899d16c69643775a3f0116d769e4e5d082942c489ee3e4205d`)
retains all particle counters above and records 0.1 / 0.2 / 0.4 / 0.8 ms
median/p95/p99/maximum. The earlier p95/max increase did not persist; these
small samples establish no speedup or installation timing tolerance.

A separate build with only `sparkle` and `glow` set to zero records
0.1 / 0.3 / 0.4 / 0.7 ms and the same counters in
`benchmark-results/tutorial-highlights-disabled/quick.json` (source digest
`420145956e7f328bfd94d5c24022f359f33f32ca5c293bb93ba130f648c0b353`).
The final authored values were restored and rebuilt. Enabling these point-local
accents adds no resources; both variants retain the same spatial learning.
Zero values leave the shader calculations in place, so this is not an isolation
of marginal GPU cost. The quick timings are animation-loop timestamp intervals
with VSync disabled, not CPU/GPU durations. All 210 measured frames remain in
the first goal's flying phase; passage, wake, dissolution and handoff were absent. The benchmark replaces controls/time and contains no production
tutorial audio. Its exact numerical reference remains unchanged. The fixed
1,400-particle draw replaces the opaque guide while separate Air Particles uses
80 particles per chunk; neither particles nor the wake allocate frame buffers.

Final visual review found the level ring below the original narrow desktop
view. Start now authors an 80-degree vertical desktop field of view; Run restores
the main projection on handoff, and immersive XR retains its headset projection.
The final headed screenshot `benchmark-results/issue-50/start-readable-ring.png`
shows the complete ring and the near-field arrow at the unchanged assisted head
pitch, with no browser errors. The subsequent quick result at
`benchmark-results/tutorial-delivery/quick.json` (source digest
`d9ecc29e6617f8d39b80589cc83a50f701d18ff03742373d89cb072cc5638304`)
retains 2 draws / 0 triangles / 2 geometries / 0 textures / 2 programs, no queued
work, and 0.1 / 0.2 / 0.4 / 0.7 ms median/p95/p99/maximum. This changes only the
Start view and does not establish a headset frame-rate claim.

A separate headed Chromium audio-only probe used an empty 1280 × 720 DPR1 page
and a generated two-second sine sample, not production audio or a rendered world.
The initial 40 ms grain limit reached 15 scheduled/active sources and scheduling
tick costs of 1.5 ms mean / 3.6 ms maximum. Raising the minimum grain size to 80 ms
bounded the measured peak to 10 at maximum overlap/rate; tick cost was 0.943 ms
mean / 1.9 ms maximum. Frame-update JavaScript was 0.062 ms mean / 1.2 ms maximum.
Pause and unload left zero sources; late decode cancellation passed. The source
pool rejected a fifth spatial placement. Left/right HRTF RMS favored the expected
ear by about 1.56×, and yaw/roll listener placement passed. This verifies routing
and lifecycle, not perceived front/back localization or speech intelligibility.

The probe result `/tmp/becoming-many-audio-probe.json` records source digest
`a67f43eeb958e55a1847bea48cde055b8ee9811637a968b891927522cd4a0825`.
The final focused placement/replacement rerun
`/tmp/becoming-many-audio-placement-probe.json` passed at digest
`2dbda0b7e0e248e172cf296f785a682185a2fa98f5502c176e74085d9e9371b4`.
These are local temporary probe files; the relevant findings and identities are
retained here. JavaScript timing excludes audio-worklet CPU, a simultaneous
renderer and the headset. The current literal Start recipe omits audio pending
DE-use permission, EN fallback and sample selection. Windows-PCVR USB-C 90 Hz,
listening/comprehension and the existing #73/#75/#78/#79 findings remain open.

### Independent review and complete-course measurement

The [independent review and screenshots](evidence/issue-50/README.md) extend the
quick replay with sequential real M5-course interactions on frozen production
builds. Baseline is `1818a88`; the review candidate has source digest
`d914f01e6223e4263613d8c8f2e5893f2541f5e9f19ad99375942f647e38e80b`.
[Summary and raw-report hashes](evidence/issue-50/summary.json) retain exact served
asset digests. Subsequent source README edits change the source digest but not
those served assets. Both builds complete two full Conductor courses, handoffs
and Stop resets without errors. The candidate also completes the root course
at 1920 × 1080. Each course lasts approximately 51 seconds.

Headed Chromium 151.0.7922.34 uses Apple M2 Max / ANGLE Metal, DPR1 and normal
approximately 60 Hz VSync, without concurrent browser work, tracing or profiling.
The Conductor canvas is 934 × 525 within a 1920 × 1080 viewport. Reused temporary
RAF/WebGL instrumentation measures callback JavaScript and asynchronous GPU
queries separately; instrumentation affects absolute timing. No disjoint GPU
query was observed. Screenshot phases are excluded. Desktop background activity
is not fully controlled.

| Workload | Baseline | Review candidate |
| --- | --- | --- |
| First/repeated course JS p95 | 0.4 / 0.4 ms | 0.4 / 0.4 ms |
| First/repeated course GPU p95 | 0.289 / 0.309 ms | 0.244 / 0.256 ms |
| First/repeated course animation interval p95 | 17.1 / 17.1 ms | 17.7 / 17.7 ms |
| Reset buffer allocations / program creations inside visible callbacks, each reset | 6 / 1 | 0 / 0 |
| First/repeated reset callback JS maximum | 3.3 / 3.3 ms | 1.6 / 1.3 ms |
| First/repeated reset animation interval maximum | 17.6 / 17.3 ms | 33.7 / 34.3 ms |

The reviewed correction moves newly created training buffers/programs into
World's preparation, while transport and visible frames remain held. The longer
reset interval is deliberate: readiness follows preparation. The first visible
training callback still performs ordinary bounded Air streaming updates; this
is not a claim that every upload disappears. Reset GPU maxima are 1.313 / 2.537 ms
for the candidate, versus 0.944 / 0.785 ms before. These small diagnostic samples
show the relocation of first-use work, not an overall speedup or an accepted
installation timing budget. The course keeps two draws except its handoff frame;
the prepared main world then resumes its existing work.

At the full 1920 × 1080 root viewport, the candidate's complete course records
JS p95/p99/max 0.4 / 0.5 / 3.9 ms, GPU 0.292 / 0.444 / 0.817 ms and animation
interval 17.1 / 17.5 / 17.7 ms. The first main speech uses the pre-created English
prologue element; its first play call observes metadata readiness (state 1).
Early preload is retained, but complete media readiness and audible onset are
not established by this measurement. Production tutorial audio remains absent;
combined approved voice/sample/render cost and Windows-PCVR acceptance are open.

### World-anchored tutorial particles

The user clarified that particles must never follow player translation or rotation.
Start now uses one goal pose for its cloud, ring and arrow; the former per-frame
heading-guide calculation and second pose uniform are removed. Background Air
already uses stable world-keyed chunks. A browser probe observes the actual WebGL
uniform: the goal matrix remains unchanged through arrival, formation, forward
flight and turning, with no separate arrow pose. The focused 24-test set, build
and lint pass. The complete four-goal root course and handoff pass without errors.

The same full-viewport diagnostic used above records 3,047 course frames, JS
median/p95/p99/max 0.3/0.4/0.4/6.2 ms, GPU 0.190/0.249/0.319/1.340 ms and animation
interval 16.7/17.7/17.7/17.8 ms. Two draws remain until the main-world handoff.
The previous full-viewport sample remains the comparator: JS p95 0.4 ms and GPU
p95 0.292 ms, with different maxima. No general speedup or headset acceptance is
claimed. Served-asset digest:
`8ccece2f29f6a0a770c972e3aab157f995e6de1212db8f25a154defd0cee079e`.
Scratch report: `benchmark-results/issue-50/world-anchored-course/probe.json`,
SHA-256 `3e12223de3562f26083e50134425a0941d25675a332d53e4fb49bd8aa12f357c`.

## Dated Evidence

- The [2026-09-08 browser audit](performance-audit-2026-09-08.md) records a frozen
  production build, ordinary full-show/cue observations, ten-level movement
  diagnostics, GPU resolution scaling and source-attributed audio/streaming
  findings. It retains instrumentation, concurrent-work and lock-state limits;
  it does not update a reference or establish Windows-PCVR acceptance.

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
  The static Diagnostic level became ready in 0.43 seconds, and the built Station
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

The superseded Start MVP added one opaque arrow to the unchanged White World
air-particle recipe.
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
