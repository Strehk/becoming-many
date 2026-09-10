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

The 2026-09-10 Start responsibility refactor was compared against a separate
build archived from `506b0e1` (unchanged public assets). The candidate source digest
was `8ee511df83d546b25ccf7157654129a5880455be4f0a4da6bc50230d5e513888`. Two sequential before/after pairs used
Chromium 151.0.7922.34, Apple M2 Max/ANGLE Metal, 640 × 360 and the quick Start
replay (210 measured frames). All four runs retained 2 draws, 2 geometries,
2 programs, no triangles/textures and zero missed frames. Median was 0.1 ms and
p99 0.5 ms throughout; p95 was 0.3/0.4 ms before and 0.4/0.4 ms after.
The first candidate maximum was 2.1 ms; the other three maxima were 0.8 ms.
No repeatable slowdown was observed in this short deterministic workload; this
is not normal-show or PCVR acceptance. Scratch reports are under
`benchmark-results/start-responsibilities-{before,after}{,-repeat}/`.
The baseline reports' identity describes the calling harness working tree;
the separately served baseline source is the archived commit specified above.

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


### Object-bound granular audio

The #112 instrumental extension replaces the ordinary bed with three object
layers, one goal voice and one shared eight-second Tone.Reverb. The production
recipe schedules 12.375 grains/s; three twelve-second mono buffers occupy
6.59 MiB at 48 kHz. Validation allows at most four voices, three bounded buffers
and 40 starts/s. Decoding may resample to a device rate up to 96 kHz; this does
not change the fixed sample-duration capacity.

Comparable normal-VSync headed Chromium 151.0.7922.34 on Apple M2 Max/Metal,
root route, 1920×1080 DPR1, simulated real M5 input and complete four-goal course:

| Training candidate | Frames | CPU median / p95 / p99 / max (ms) | GPU median / p95 / p99 / max (ms) | RAF p95 / max (ms) |
| --- | ---: | --- | --- | --- |
| Prior silent training, world-anchored particles | 3047 | 0.3 / 0.4 / 0.4 / 6.2 | 0.190 / 0.249 / 0.319 / 1.340 | 17.7 / 17.8 |
| All instrumental layers and shared hall | 3048 | 0.8 / 2.4 / 2.7 / 5.2 | 0.157 / 0.355 / 0.528 / 0.855 | 17.2 / 17.7 |

The source baseline is `42c06c9` with the #112 working diff. Served-assets SHA-256
is `5a3d7b19bdadb8f540e095899effafbe25e5341c0e985deda114136aa121771d`;
the prior silent build is `8ccece2f29f6a0a770c972e3aab157f995e6de1212db8f25a154defd0cee079e`.
The later wet-distance correction beyond maximum distance does not affect this
course's near-goal comparison and is separately regression/signal tested.
Both retain two tutorial draws, with the main handoff sampled separately. In the
following 392 main frames CPU p95 is 2.4 ms before versus 2.1 ms after. The audio-enabled candidate shows higher measured tutorial CPU/GPU cost;
no improvement or isolated causal attribution of GPU cost is claimed. Desktop cadence
shows no dropped-frame regression in this observation, but the actual Windows
PCVR 90 Hz installation remains unmeasured and required.

An audio-only signal probe uses the same owners and native HRTF listener, with
actual derivatives and synthetic worst-case grains in separate phases. Source
coordinates remain unchanged during head rotation; channel dominance reverses.
For a 440 Hz point source, retreat from 5 to 35 m reduces RMS from 0.03052 to
0.00551; return restores 0.03039. With all production layers/hall enabled, the
selected direct source's near/far RMS is 0.01116/0.000188 and the diffuse room
0.01557/0.000429 (5/165 m, separate sampled windows). Speech reduces these to
0.00292/0.00345 near; pause/unload measure zero. Changing source material and
hall memory mean these are functional measurements, not a calibrated acoustic
transfer function or perceptual listening acceptance.

At the validated 40-starts/s ceiling, the two diagnostic observations peak at
20 and 19 scheduled/active native sources, including lookahead/tails. The later
probe measures Tone tick mean/max 0.791/2.5 ms and frame-follow mean/max
0.034/0.4 ms in an empty audio document; these do not substitute for combined
rendering measurements. Pause/unload stop scheduling, late decode cancellation
passes, and the shared context closes/replaces successfully. One context-owned
Tone source persists until context close; no claim of immediate zero native
nodes at voice disposal is made. Raw local diagnostics remain under
`benchmark-results/issue-50/granular-course/` and `/tmp/becoming-many-granular-probe.json`;
retain the compact evidence in the tutorial report rather than raw frame arrays.


The corrected final build `c3f581b21fcff17337c19dfc332ed02f35c060c78672eb9ca282c38ba7b56905`
also passes two complete Conductor courses (3051/3045 training frames), two
handoffs and held Stop/restarts, plus standalone `/start` startup, formation and
real-input flight checks. No browser errors or warnings occur. The Conductor
canvas is 934×525 in a 1920×1080 viewport, so these are lifecycle checks, not the
full-viewport comparison above. The standalone capture uses 1280×720 DPR1.


### Bounded live AudioParam histories

A focused CPU profile of `473a725` explains the granular candidate's increase.
The bundled standardized-audio-context AudioParam wrappers and automation-events
lists retain histories containing only past events: `flush(currentTime)` finds
no future event and therefore removes nothing. Three's immediate source ramps
and training's immediate target changes repeatedly scan these growing lists.
The profile samples 382.55 ms in source `linearRampToValueAtTime`, 373.84 ms in
training `setTargetAtTime`, and 292.36 ms in training `cancelScheduledValues`,
plus their automation-list descendants. These are diagnostic sample totals,
not uninstrumented frame timings. The local profile is
`benchmark-results/issue-50/granular-cpu-profile/cpu-profile.json`.

The existing owners now read each exclusive live parameter's rendered value,
cancel its history from zero, and hold that value at the current instant before
applying the existing target/ramp. Each training parameter retains at most two
events after its update; a 3600-frame regression exercises continuous movement.
Spatial parameters similarly retain a hold point and Three/listener ramp. The
small shared operation never touches scheduled/modulated music controls, changes
no context ownership and adds no timers or frame allocations. Public AudioParam
[value](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/value) and
[cancellation](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelScheduledValues)
operations are used without private native-context access. Render-quantum value
sampling means sample-identical output is not claimed.

The same unprofiled, full-root course on headed Chromium 151/M2 Max/Metal,
1920×1080 DPR1 and normal VSync now measures:

| Candidate | Frames | CPU median / p95 / p99 / max (ms) | GPU median / p95 / p99 / max (ms) | RAF p95 / max (ms) |
| --- | ---: | --- | --- | --- |
| Object-bound audio before bounded histories | 3048 | 0.8 / 2.4 / 2.7 / 5.2 | 0.157 / 0.355 / 0.528 / 0.855 | 17.2 / 17.7 |
| Same audio with bounded histories | 3049 | 0.4 / 0.5 / 0.6 / 4.6 | 0.108 / 0.292 / 0.410 / 1.147 | 17.2 / 17.7 |

The correction reduces measured tutorial CPU p95 by about 79%; it preserves all
four sources and the eight-second hall. No isolated GPU improvement is claimed.
The main segment's CPU p95 remains similar (2.1 versus 2.2 ms). Full flight and
operator handoff complete without errors or warnings. Source base is `473a725`,
served-assets SHA-256 `921d0887e8569c1b567005df5695b64feb47c3928f2ed5f5787177ebd832eda8`;
raw local comparison is `benchmark-results/issue-50/granular-bounded-automation/`.
The previous silent-training p95 of 0.4 ms is a different workload. This result
addresses growing scheduling overhead, not physical Windows-PCVR 90 Hz acceptance.


Post-correction signal assertions retain actual instrumental HRTF/near-far,
speech ducking and zero paused/unloaded output. A separate connected-signal
parameter probe brackets each of 80 before/hold/after observations with audio
and wall time. All deviations stay below natural exponential progress over the
measured interval plus one 128-sample render quantum; the largest normalized
bound usage is 0.3723. Gain/cutoff converge to 0.25012/1401.47 after the return
target of 0.25/1400. Shared context close/replacement and aborted startup pass.
This rules out an additional getter-visible jump at that resolution; it does not
prove sample-identical output or perceptual clicklessness.

Retained diagnostic corrections: unconnected test nodes initially stayed at their
initial values because they were not rendered. After connecting a quiet signal,
an untimed 250 Hz cutoff threshold failed at 269.2 Hz (corresponding gain delta
0.017711). Independent review found that a single quantum already permits about
249 Hz of progress across this authored range, leaving no allowance for elapsed
observation time. The final time-bracketed criterion derives its bound from the
actual interval instead of raising an arbitrary threshold. These were diagnostic
limitations, not passing evidence that was discarded. Compact results are in the
[tutorial summary](evidence/issue-50/summary.json); direct listening stays open.


## Procedural tutorial placement

The follow-up to `4bacaec` replaces authored ring coordinates with bounded goal
sampling. Start samples only on first placement and goal advancement; reset
starts a fresh course. Ordinary frames reuse the same vectors, particle buffer,
audio sources and renderer. No new frame job or resource owner is introduced.

The production root course passes all four actual M5-driven passages and operator
handoff on the same headed Chromium 151 / M2 Max / Metal, 1920×1080 DPR1 setup.
Across 3041 tutorial frames, CPU median/p95/p99/max is 0.3/0.4/0.5/4.3 ms and GPU
is 0.088/0.247/0.298/1.152 ms. The preceding bounded-audio course measured CPU
p95 0.5 ms and GPU p95 0.292 ms. Geometry and flight paths now vary, so these
observations show no additional rendering/CPU cost rather than an optimization.
RAF median remains 16.7 ms; p95/max is 18.2/18.8 ms versus 17.2/17.7 ms before.
The following main segment has CPU/GPU p95 2.4/1.150 ms and RAF max 18.7 ms.
Desktop scheduling variation and these short runs do not establish installation
90 Hz or sustained frame pacing.

Served-assets SHA-256:
`fb038c05dda0b6bef7517953c5a019a2a9670a75e79f85b72c6767bf5e5cb3ab`.
Local evidence: `benchmark-results/issue-50/procedural-visible-course/probe.json`.
No browser errors or warnings occurred. Hardware, listening and narration
acceptance remain open.


## Cloud tutorial revision — 2026-09-09

The requested visual revision increases local particle density and replaces thin
contours with filled bodies and three curved guide cross-sections. The final
recipe keeps 32,000 Start points and 6,000 Air points in two desktop draws. Air
uses 16 m cells, 48 points/cell and a 16 m field with 12–16 m outer fading; its
local density is unchanged from the 32 m field trial. Main recipes retain their
original settings. No renderer, postprocessing, texture, light or clock was added.

The same headed Chromium 151 / Apple M2 Max / Metal, 1920×1080 DPR1, normal-VSync
root route was measured sequentially without competing browser rendering. A fresh
`d061829` source archive from `david_refactor` reproduced the original served-assets
digest; the working repository was never checked out or reverted. All runs below
traverse the generated four-goal course and use the existing operator handoff.

| Candidate | Tutorial frames | CPU median / p95 / p99 / max ms | GPU median / p95 / p99 / max ms | RAF p95 / max ms |
| --- | ---: | --- | --- | --- |
| Refreshed original 1,400 Start / 27,440 Air | 3037 | 0.3 / 0.4 / 0.5 / 4.2 | 0.087 / 0.251 / 0.289 / 1.058 | 18.2 / 18.8 |
| Cloud trial: 32,000 Start / 16,464 Air, 24 px cap | 3062 | 0.3 / 0.4 / 0.5 / 6.3 | 0.132 / 0.299 / 0.346 / 0.806 | 18.1 / 18.7 |
| Density trial: 24,000 Start / 6,000 Air, 16 px cap | 3042 | 0.3 / 0.4 / 0.5 / 4.9 | 0.244 / 0.293 / 0.362 / 0.869 | 18.2 / 18.7 |
| Final: 32,000 Start / 6,000 Air, 16 px cap | 3192 | 0.3 / 0.4 / 0.5 / 5.2 | 0.205 / 0.308 / 0.394 / 0.884 | 18.2 / 18.7 |

32,000 retains the denser visual body; reducing to 24,000 did not establish a
useful GPU improvement. Narrowing the ambient field and capping point size bound
resources/coverage; they are not claimed as measured GPU speedups. The final
shader evaluates per-particle sparkle in the vertex stage and only evaluates the
haze profile for haze fragments. The first target is now 60–64 m away so its
thicker body fits during formation with the existing assisted desktop view.
The final course therefore lasts longer than the old course. Random target
positions and GPU timing variation prevent an isolated shader-cost claim.

CPU p95 and desktop cadence remain unchanged. GPU p95 is **0.058 ms higher
(about 23%)** than the refreshed baseline, despite a lower observed maximum.
The user explicitly accepted this measured increase and the higher particle
density on 2026-09-09. This acceptance does not establish physical PCVR performance.
The following main segment has CPU/GPU p95 2.3/1.157 ms versus baseline
2.2/1.154 ms; no main-show optimization or regression is inferred from that short
segment. All four passages and handoffs complete without browser errors. These
60 Hz desktop observations do not establish Windows-PCVR USB-C 90 Hz acceptance.

Final served-assets SHA-256:
`fca5507de4268d2d5853b297dc02347fbe04c3b1be9b586d93ba6e5a39278277`.
Baseline SHA-256:
`fb038c05dda0b6bef7517953c5a019a2a9670a75e79f85b72c6767bf5e5cb3ab`.
Local reports: `benchmark-results/issue-50/cloud-bounded-final/probe.json` and
`cloud-baseline-refresh/probe.json`; density trials retain their separate identities.
No numerical benchmark reference was changed.

Start owns seven static attributes: 44 bytes/point, **1,408,000 bytes per CPU/GPU
copy**. Air owns 96,000 attribute bytes per copy, for 1,504,000 combined bytes
per copy, excluding driver overhead, JS metadata and unchanged audio/main-world
resources. The former combined attributes were 483,840 bytes per copy. This is
explicit bounded feature growth, not a memory-reduction claim. Start never
uploads particle attributes during ordinary frames; Air only uploads recycled
slot ranges through the shared queue. Final whole-course upload p99 is zero and
maximum is 34,560 bytes/frame (baseline 116,480). Uniform updates are separate.
The [coverage/screenshot evidence](evidence/issue-50/README.md#cloud-revision--2026-09-09)
distinguishes projected point squares from actual GPU fragment executions and
checks disposal at handoff.


## Forward recycling and spoken tutorial — 2026-09-09

The follow-up retains 32,000 Start and 6,000 Air points, their point-size caps,
seven immutable Start attributes and existing draw path. Recycling uses the same
four goal slots and three decorative curve slots; 100 misses in the focused test
retain those slots and create no new particle owner. No buffers/programs are
created during either final Conductor course, including their intentional misses.
Each held Stop/recreation prepares nine attribute buffers and four program
variants off the normal course; the next course creates none. Main resources
remain retained. Attribute storage is unchanged at 1,504,000 bytes per CPU/GPU
copy. Miss retirement adds one section-presence uniform and no additional draw
or texture; point-square coverage bounds are those of the preceding cloud
revision. This is not a new exhaustive GPU fragment-count measurement.

Five original stereo WAVs add 17,024,558 encoded bytes and five tutorial media
elements at the existing narration owner. They do not enter Tone's granular
sample decoding or add spatial voices/reverbs. Browser decoder/driver memory is
not included in the attribute byte count; no device-specific peak decoder-memory
claim is made. The original three mono grain samples and four spatial voices are
unchanged. Narration cleanup and retention across handoff remain covered at their
existing owner.

The final Conductor workload (Chromium 151, M2 Max/Metal, 934×525 canvas in a
1920×1080 viewport) completes two narrated courses with one deliberate miss each.
CPU p95 is 0.5/0.4 ms versus the preceding cloud run's 0.4/0.4; GPU p95 is
0.356/0.330 ms versus 0.338/0.338. These longer workloads include orientation,
spoken completion and recycling. Their diagnostic captures include screenshots;
one external RAF interval reaches 53.8 ms while the associated application
callback/GPU take 0.2/0.215 ms. No cause or sustained application regression is
inferred from that isolated scheduling interval. A separate final root timing run
without in-course screenshots is recorded below to avoid conflating capture cost
with ordinary frame work. Neither desktop run establishes installation 90 Hz.

The separate final root run uses the same Chromium/GPU and 1920×1080 DPR1 as the
preceding root cloud measurement, with no in-course screenshots or competing
browser render. Across 6,348 tutorial frames, CPU median/p95/p99/max is
0.3/0.5/0.6/4.3 ms; GPU is 0.220/0.290/0.351/1.387 ms; external RAF p95/max is
17.5/17.8 ms. The preceding cloud run recorded CPU 0.3/0.4/0.5/5.2 ms and GPU
0.205/0.308/0.394/0.884 ms across 3,192 frames. The CPU p95 difference is one
0.1 ms timer step; the narrated/missed-course workload is roughly twice as long.
This is not an isolated optimization/regression estimate. Median CPU and ordinary
desktop cadence remain stable; the isolated 53.8 ms Conductor interval did not
recur. Attribute upload p99 is zero and max 41,600 bytes, with no course-time
buffer/program creation. Grain counts and point capacities are unchanged.

Final served-assets SHA-256:
`c8c4a8609d7912aeffc24b616154078516a6eef8caac582668993e0389f52e15`.
Root report: `benchmark-results/issue-50/recycling-final-root-timing/probe.json`.
Conductor report: `benchmark-results/issue-50/recycling-final-conductor/probe.json`.
Raw diagnostics retain media preload cancellations; the [functional evidence](evidence/issue-50/README.md#forward-recycling-and-original-voice--2026-09-09)
separates those from successful real media playback. No benchmark reference changed.


## Narration Hold and independent review — 2026-09-09

The final independent tutorial review confirmed the bounded rendering/audio pools
above and found #93's unchanged native narration work directly affects the newly
spoken tutorial. The correction stays at the media owner: changed rate and exact
held seek only, one pending/rejected play attempt, no second clock or scheduler.
The unused forwarding matcher/type and seek/drift helper paths are removed. A
focused review of the final diff found no additional regression.

Matched headed Chromium 151 / M2 Max / 1280×720 DPR1 runs serve both production
builds through Vite preview, with identical native-operation and RAF instrumentation.
Each phase has 600 distinct RAF timestamps over ten seconds. Two application
callbacks share each timestamp; CPU below is their summed duration, not GPU time.

| Hold phase | Time writes, before → after | Rate writes, before → after | CPU median/p95/p99/max, before → after (ms) |
| --- | --- | --- | --- |
| Before first Play | 600 → 0 | 600 → 0 | 0.3/0.5/0.6/0.8 → 0.3/0.5/0.7/1.0 |
| Settled Pause | 600 → 0 | 600 → 0 | 0.2/0.4/0.5/0.7 → 0.2/0.4/0.4/0.6 |

Settled Pause also removes 600 native `seeking` and 600 `seeked` events. Distinct
RAF median remains 16.7 ms and maxima are 18.6–18.7 ms. CPU p95 is unchanged;
there is no measured FPS improvement or new PCVR claim. Source is `4480d55`
versus its narration-player-only correction. Served asset digests are
`c8c4a8609d7912aeffc24b616154078516a6eef8caac582668993e0389f52e15`
and `e4d58d7020ddc2b9124797f9591c6777fde9fcc8baceab03fc69a50e4852d9d3`.
Local reports: `benchmark-results/issue-50/narration-hold-comparable-before/probe.json`
and `narration-hold-comparable-after/probe.json`. Earlier operation-only probes
support the same counts but are not the source of this callback comparison.

A first rejected `play()` was explicitly injected at the browser media boundary:
one attempt over two seconds, then actual Pause/Play controls successfully start
the native recording. The first browser-policy fixture unexpectedly permitted
playback; it is not evidence of rejection. Pending/rejected attempts, delayed
metadata and stale unload/pause cancellation are also covered by a focused unit
test. MDN documents the [asynchronous play result](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)
and [rounded currentTime getters](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/currentTime)
that motivate this limited operation state.

Media preload `ERR_ABORTED` requests persist with zero unchanged Hold writes.
Station answers a tested byte Range with 206 and the correct 64-byte interval;
no missing-asset or server Range defect was found. The precise cancellation cause
remains unresolved. The raw request errors are retained, not globally filtered.
The review distinguishes observed `playing` and near-authored-duration progress
from native `ended` proof. Attribute capacity is still 1,504,000 bytes per CPU/GPU
copy; that excludes JS, decoder and driver memory. No total-memory plateau or
physical speech/installation acceptance is claimed.


The final 1920×1080 root integration run completes a miss/recycle, four actual
passages, speech and handoff, followed by precise held scrub/cue/EN-DE/resume
checks through public Show controls. Over 6,407 course frames, CPU median/p95/p99/max
is 0.3/0.4/0.5/4.9 ms and GPU is 0.116/0.278/0.320/0.783 ms; RAF median/p95/max
is 16.7/18.2/18.7 ms. No course-time buffers/programs are created; attribute upload
p99 is zero and max 37,280 bytes. Route, viewport and instrumentation match the
preceding root course, but random geometry/timing still preclude an isolated GPU
optimization claim. The matched Hold comparison above measures the actual changed
native workload. Final report:
`benchmark-results/issue-50/narration-final-integration/probe.json`.
Its three raw media cancellation errors remain visible; functional assertions,
console, HTTP and shader checks have no failure.


## Repeated forward recycling memory — 2026-09-09

Source `295604f`, served-assets digest
`e4d58d7020ddc2b9124797f9591c6777fde9fcc8baceab03fc69a50e4852d9d3`;
headed Chromium 151.0.7922.34 / M2 Max / Metal, root DE route, 1280×720 DPR1.
The existing M5 fixture drives neutral forward flight through twelve consecutive
misses and automatic replacements, without changing private progress or poses.
Every sampled phase reports zero successful passages, and the tab stays visible.
After the last replacement the actual Pause control holds the world for ten seconds.

Samples use [CDP Runtime.getHeapUsage](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-getHeapUsage)
after explicit garbage collection and a 150 ms event-settling interval. This is
isolate-level diagnostic memory, not total process/decoder/GPU memory. Forced GC
and WebAudio inspection perturb execution, so this run supplies no frame-time
comparison; the ordinary timing runs above remain authoritative for that claim.

| Sample | Elapsed (s) | Retained JS (MiB) | Embedder heap (MiB) | Backing storage (bytes) |
| --- | ---: | ---: | ---: | ---: |
| Ready | 1.3 | 17.287 | 1.810 | 77,970,430 |
| First section | 25.1 | 16.764 | 1.972 | 77,968,713 |
| 3 misses | 76.4 | 17.111 | 2.168 | 77,968,713 |
| 6 misses | 125.7 | 17.463 | 2.153 | 77,968,714 |
| 9 misses | 174.0 | 17.449 | 2.501 | 77,968,715 |
| 12 misses | 221.4 | 17.369 | 2.573 | 77,968,940 |
| Paused, tails settled | 231.6 | 16.941 | 2.367 | 77,968,715 |

WebGL create/delete counters stay constant at 508 buffers, 46 programs,
58 textures, 3 framebuffers and 108 vertex arrays for the entire prepared root
world. No new object of these kinds is created during twelve replacements.
These counts include retained main resources, not just Start's two draws.
DOM counters remain two documents and 193 nodes after first playback.

WebAudio creation/destruction notifications observe 37–39 AudioBufferSource nodes
and 1,049–1,053 Gains at the flying checkpoints; after Pause they return to the
initial 28/1,032. This diagnostic inventory includes main/offline-context nodes
and may retain notifications until browser destruction; it is not an audible
voice count or proof of immediate native release. The authored four voices and
three shared samples are unchanged. No continuing JS growth appears between
misses 6/9/12; embedder memory varies and is 0.557 MiB above initial Ready after
Pause. Do not infer a full native-memory plateau, indefinite endurance or PCVR
acceptance from this 232-second observation.

Local report: `benchmark-results/issue-50/recycling-memory-295604f/probe.json`.
Functional assertions pass, with no console, HTTP or shader failures and no
warnings. The strict probe still exits nonzero for two recorded media preload
`ERR_ABORTED` requests. The [actual final screenshot](evidence/issue-50/recycling-endurance.png)
is taken after Pause and is excluded from memory samples. Runtime remains
unchanged; this adds evidence only, without a benchmark-reference update.

## Timed tutorial and timeline — 2026-09-09

The latest user-approved change limits practice to 60 playing seconds while
preserving a fully earned closing voice (up to about 74 seconds). The final
literal pacing uses 30–34 m later spacing and 1.5 s dissolution, unchanged shared
flight and 38,000 combined points. UI layout updates only when the observed
main-start prefix changes; there is no new clock, timer or renderer.

Measurement: headed Chromium 151, Apple M2 Max Metal, 1920 × 1080, DPR 1,
production root, real shared M5 steering, no competing browser workload or
in-course screenshots. Candidate checkpoint `4b6d0ae` with the timed revision;
served-assets SHA-256
`ca71c86529d03f5ff0350ed648965ced246ffc87b676f5c40a3d2e791c5a8fa3`.
The successful course contains 4,177 frames and all five original DE voice starts.
Four goals complete at approximately 55.14 s; main handoff follows at about 69 s.

| Metric | Median | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| CPU frame work (ms) | 0.3 | 0.4 | 0.5 | 7.6 |
| GPU frame work (ms) | 0.2134 | 0.2794 | 0.3212 | 0.9657 |
| RAF interval (ms) | 16.7 | 17.3 | 17.6 | 17.7 |

Upload p99 is zero; maximum is 34,560 bytes. No course-time `bufferData` or
`createProgram` calls occur. The preceding forward-recycling course recorded
CPU/GPU p95 0.4/0.2784 ms under the same desktop conditions. Its longer course
included an intentional miss, so this is a bounded-cost regression comparison,
not an isolated performance improvement claim. Particle/overdraw capacities and
resource ownership are unchanged; the earlier repeated-recycling memory evidence
still applies to those unchanged pools.

The first pacing candidate reached only three goals before the correctly firing
timeout; final spacing/dissolution correct that failure. Root functional checks
pass, including full closing playback and a separate skip/timeout UI run. Raw
reports retain introductory/closing media `ERR_ABORTED` request errors and are
not clean all-error passes. No other console errors or warnings were observed.
See the [tutorial evidence](evidence/issue-50/README.md) for screenshots and scope.
Desktop timing does not establish headset comfort, physical listening or 90 Hz
Windows-PCVR USB-C acceptance; EN voice policy remains unresolved.

## Gaze-coupled tutorial — 2026-09-09

The user-requested 2 m/s tutorial now creates nearby gaze-aligned sections at
spoken instruction onsets. The first depth is 16–18 m; subsequent sections use
12–14 m, expanded when the projection requires it. This is a changed visible
workload, not a like-for-like replay of the previous distant 5 m/s route.
The fixed 32,000 training points plus 6,000 Air capacity remain unchanged.

Headed Chromium 151, M2 Max Metal, root, 1920 × 1080, DPR 1, ordinary shared M5
input and no competing browser measurement. The first near-field candidate
(`6ce372b7…`, 16 px point cap) recorded GPU median/p95 0.2300/0.3551 ms.
Bounding sprite size to 8 px reduced those values to 0.1070/0.2955 ms; the final
6 px bound measured 0.1043/0.2961 ms. The 8→6 change does not improve p95 and is
not claimed as a further frame-rate gain; it tightens the worst-case per-sprite
fragment area. The previous distant course had GPU median/p95 0.2134/0.2794 ms.
Thus the new median is lower and p95 is 0.0167 ms higher on this different route;
no isolated renderer speedup or identical-workload regression claim follows.
No numerical benchmark references were changed.

Final served-assets SHA-256:
`d44cfee276ec3b26ef0d93cc75efa6385a7d0648e302ea78566034944271126d`.
Checkpoint `86e9671` plus this gaze/voice revision. Across 3,953 course frames:

| Metric | Median | p95 | p99 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| CPU frame work (ms) | 0.3 | 0.4 | 0.5 | 8.8 |
| GPU frame work (ms) | 0.1043 | 0.2961 | 0.3734 | 1.0923 |
| RAF interval (ms) | 16.7 | 18.2 | 18.6 | 18.7 |

Upload p99 is zero, maximum 34,560 bytes. No course-time buffer allocation or
program creation occurs. All four passages complete in about 51.4 seconds, and
the full closing finishes before automatic main handoff at about 65.3 seconds.
Functional assertions pass; two media-range `ERR_ABORTED` requests remain in
the strict raw report. No console/shader warnings or other functional failures.
The standalone GPU-matrix/native-audio observation also verifies centered arrow,
complete ring framing, world-fixed poses after a turn and a spoken retry.

The existing fixed pools and resource lifecycle are preserved; earlier memory
observations remain evidence for those unchanged owners, not a new whole-process
memory measurement. Physical Windows-PCVR, first-visitor comfort and spatial
listening remain open. [Screenshots and review](evidence/issue-50/README.md#gaze-coupled-instruction-and-slower-flight--2026-09-09).


## Arrow-first tutorial — 2026-09-09

The turn-triggered revision retains 32k training/6k Air capacities, one training
Points draw, immutable 1,408,000-byte training attributes and six-pixel sprite cap.
Spring/drag physics is evaluated analytically in the existing shader; three
preview ages and two release-origin vec2 uniforms add 28 fixed bytes, without
compute targets or per-frame particle uploads. A headed 1920×1080 DPR1 Chromium
course measured CPU median/p95 0.3/0.4 ms, GPU 0.103375/0.307708 ms and RAF
16.7/18.1 ms. Prior gaze revision GPU was 0.104333/0.296125 ms. These nearby
measurements show no demonstrated material change; neither an improvement nor
Windows-PCVR 90 Hz acceptance follows. Zero course-time GPU resource creation;
upload p99 zero, peak 34,560 bytes for Air streaming. See
[conditions, overdraw proxy and limits](evidence/issue-50/README.md#arrow-first-turn-triggered-tunnel--2026-09-09).


## Spoken tutorial staging — 2026-09-09

`4bb726a` hides the opening Air field until its spoken mention and requires a
formed arrow before the helping rings. Shorter ring sections keep the complete
learning route within one minute. Their initial near-field overdraw increase
was removed with a four-pixel training point cap (same 32k/6k capacities and
1,408,000 training attribute bytes; maximum sprite-square proxy 512,000 pixels).
Headed 1920×1080 DPR1 final GPU median/p95 is 0.099500/0.286291 ms against preceding
0.103375/0.307708 ms; CPU remains 0.3/0.4 ms. No course-time GPU resource creation.
The draw-only probe's empty-opening gap must not be interpreted as a render-loop
stall. [Full comparison, failure/correction and timing evidence](evidence/issue-50/README.md#spoken-line-staging--2026-09-09).
Physical Windows-PCVR remains unverified.


### Reachable guidance and persistent arrows — 2026-09-09

The subsequent user-requested density/lifetime revision uses 40k form particles
and 48k Air particles in the existing two draws. Fixed attribute storage is
2,528,000 bytes per CPU/GPU copy; Air face-upload peak is 153,600 bytes, upload
p99 zero, with no course-time GPU resource creation. Comparable headed-browser
CPU median/p95 remains 0.3/0.5 ms; GPU median/p95 is 0.120583/0.306875 ms versus
0.113875/0.309583 ms before. The separate screenshot run and its higher median
are retained in the [full evidence](evidence/issue-50/README.md#reachable-guidance-and-independent-particle-lifetimes--2026-09-09).
The 33-point guidance table runs only while planning an unshown section; fixed
slots and analytical shader motion retain bounded frame work. Physical PCVR,
comfort and listening acceptance remain open.


### Spatial scene and sample effects — 2026-09-09

The richer haze subset retains 40k form/48k Air capacities and fixed attribute
storage. Its conservative sprite-square bound is 873,520 samples/eye/draw; two
optional mono sound buffers add 2,352,400 decoded bytes at 48 kHz. Current-condition
headed-browser control/new GPU p95 is 0.340791/0.345625 ms, CPU p95 0.5/0.5 ms.
No course-time GPU resource creation occurred. Median variability and the earlier
control are retained in the [full comparison](evidence/issue-50/README.md#spatial-scene-composition-and-sampled-effects--2026-09-09).
This local result does not establish physical Windows-PCVR 90 Hz or listening acceptance.

### Aligned approach and bounded audio drain — 2026-09-09

The corrected shared arrow/ring entry retains the 33-sample planning budget and
existing particle capacities. Comparable headed-browser CPU p95 is 0.5/0.4 ms,
GPU p95 0.320124/0.314874 ms (previous/current), with no course-time GPU resource
creation. Four seconds of retiring tutorial audio reuse its existing owner;
restart waits rather than allocating a second pool. See the
[measurements and limits](evidence/issue-50/README.md#aligned-approach-and-gentle-audio-release--2026-09-09).
Physical Windows-PCVR 90 Hz and headset listening remain open.


### Desktop XR mirror — 2026-09-09

World copies the already rendered left eye inside the active XR callback. The
existing canvas is capped at 1280 × 720 (921,600 pixels, approximately 3.52 MiB
RGBA color storage). There is one clear and one color blit per XR frame, no
second scene render, additional texture, framebuffer or animation loop. A real
headed WebGL2 probe passed 120 copies with correct pixels and restored bindings,
zero GL errors and no added scene draw calls. This bounds copy work but does not
measure native XR transport cost. Windows-PCVR 90 Hz and the opaque headset
framebuffer path require the physical installation.
