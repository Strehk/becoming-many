# Performance

Performance is the primary product requirement. Stable physical-headset output
is the authority; desktop and deterministic runs are regression instruments.

## Targets

- Primary: stable 90 Hz, an 11.11 ms frame interval, on PICO 4.
- Candidate fallback: stable 72 Hz, a 13.89 ms frame interval, only when
  explicitly accepted from physical measurements.
- The application must leave time for the browser or XR host, compositor,
  audio, streaming, and—on PCVR—encode, transport, and decode.

No current physical PICO 4 acceptance is recorded for the complete show or the
narrative Grass Clipmap. Wired Windows/SteamVR/PICO startup is also unresolved.

## Current Structure

The runtime uses one renderer and render loop, fixed spatial windows, pooled or
instanced content, partial buffer updates, cooperative stream jobs, and module
owned disposal. The narrative Grass Clipmap uses a shared instance buffer and a
camera-following height texture; Connections uses fixed render pools and moves
topology generation off the frame path.

Before the show becomes ready, its renderer compiles the composed material
variants and renders the current camera view once into a disposable 1 × 1
target. This moves real first-use buffer and texture setup out of visible cue
frames without keeping inactive modules rendering. The target is restored and
disposed before show time, controls, simulation, or narration can advance.

The schedule's opening show state is applied before module construction and
loading. Fixed Terrain and Air Particle windows therefore use the authored
opening view distance instead of Three.js's default camera far plane.

This bounded structure prevents unbounded growth but does not prove the frame
budget. Thermal fragment work, physical first-use validation, Grass ownership,
redundant diagnostics, and complete-show transitions remain active performance
concerns.

## Deterministic Benchmark

`bun run benchmark` replays an authored route after `bun run build`. It replaces
wall time, interactive controls, duration, and the production stream deadline
with deterministic equivalents. Consequently:

- `renderer.info` counters are exact regression facts;
- frame-time measurements are comparable only on the same machine and path;
- virtual streaming behavior does not represent production timing;
- headless SwiftShader results do not represent a GPU or headset.

The accepted quick-profile counters in
`tests/benchmark/benchmark-baseline.ts` are:

| Level | Draw calls | Triangles |
| --- | ---: | ---: |
| White World | 1 | 0 |
| Scent | 13 | 1,408 |
| Echolocation | 60 | 3,810,268 |
| Motion | 63 | 3,810,268 |
| Thermal | 89 | 3,820,178 |
| Magnetic | 90 | 3,821,138 |
| Connections | 92 | 3,847,938 |
| Test | 82 | 4,278,320 |
| Design Test | 81 | 4,277,360 |

These counters include degenerate triangles emitted by shader-culling paths and
therefore overstate visible grass geometry. The full-profile baseline has not
yet been accepted.

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

## Open Measurement Work

The benchmark already reports frame-time percentiles, missed-frame runs,
renderer counters, queue depth, and streaming drain. Still needed are:

- module update, stream work, and GPU upload time;
- physical first-use transition and shader-compilation cost;
- stale job and long-flight memory behavior;
- module load, activation, deactivation, and unload cost;
- physical PICO frame timing for the complete show;
- PCVR render, encode, USB transport, decode, and end-to-end latency.

The relevant issues are grouped under Performance in
[roadmap.md](roadmap.md).

## Development Loop

```text
small change → static gates → deterministic comparison
→ normal browser profile → physical target profile → record evidence
```

Do not claim a performance improvement without a comparable measurement. Do
not claim installation acceptance from desktop evidence.
