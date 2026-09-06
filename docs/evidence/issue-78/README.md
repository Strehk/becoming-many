# Issue #78 — Quick reference attribution candidate

Read-only attribution prepared on 2026-09-05 at `9bfb84b` plus the uncommitted
M0/#77 changes, on `david_refactor`. This is an **unapproved reference candidate**,
not a baseline update or completed acceptance. The final after-#82 comparison
is recorded below. No historical checkout or branch change.

## Exact stored/current comparison

Stored source: `tests/benchmark/benchmark-baseline.ts`, last changed by
`4807c0d` (2026-09-02). Current values: both retained
[#75 quick reports](../issue-75/README.md), independently unchanged by the
[#77 nine-level comparison](../issue-77/verification.json) (`counter-comparison`).

| Level | Draw calls stored → current | Triangles stored → current | Geometries stored → current | Textures, unchanged | Programs, unchanged |
| --- | ---: | ---: | ---: | ---: | ---: |
| White World | 1 → 1 | 0 → 0 | 1 → 1 | 0 | 1 |
| Scent | 13 → 13 | 1,408 → 1,408 | 27 → 27 | 0 | 3 |
| Echo | 60 → 57 | 3,810,268 → 3,595,282 | 68 → 66 | 1 | 8 |
| Motion | 63 → 60 | 3,810,268 → 3,595,282 | 71 → 69 | 1 | 10 |
| Thermal | 89 → 97 | 3,820,178 → 3,605,192 | 92 → 90 | 48 | 14 |
| Magnetic | 90 → 98 | 3,821,138 → 3,606,152 | 93 → 91 | 48 | 15 |
| Connections | 92 → 100 | 3,847,938 → 3,759,816 | 93 → 93 | 48 | 17 |
| Test | 82 → 94 | 4,278,320 → 4,253,300 | 94 → 91 | 47 | 11 |
| Design Test | 81 → 93 | 4,277,360 → 4,252,340 | 93 → 90 | 47 | 10 |

Both retained quick checks and the #77 check exit 1 for these seven changed
levels. Repeated equality is limited repeatability evidence; it does not accept
historical workload changes or establish general worker determinism.

## History attribution

Inspected with read-only `git log`, `git show` and `git diff` from `4807c0d` to
current HEAD. The benchmark route/settings and stored reference were not changed
in this interval; effective scene/view behavior did change.

| Observed change | Source/history evidence | Interpretation and remaining uncertainty |
| --- | --- | --- |
| Echo/Motion: −3 draws, −214,986 triangles, −2 geometries; same triangle reduction in Thermal/Magnetic | `e052ebe` changes benchmark placement from camera to ViewerRig; `4ffae55` adds 30° child pitch assist passed by `startLevel` for benchmark starts and upper-altitude clamp | Same route numbers no longer imply the same effective frustum. Culling/population changes are plausible; exact per-commit numerical attribution is not isolated. |
| Geometry reductions across populated levels | `bd8fcd3` changes pine-7 weight from 1 to 0.15 in the deterministic weighted population | Variant selection and mesh mix change; no per-variant proof attributes each geometry/triangle delta. |
| Thermal/Magnetic/Connections gain 8 draws while Echo/Motion lose 3; Test/Design Test gain 12 | `05853a5` separates selected-animal capacity from outgoing visibility: old actors continue drawing through a 0.8 s fade as new actors appear; materials remain transparent, speeds and turn/look-ahead also change | Visibility and actor submission change. Exact additional draws are not isolated; do not label an unexplained difference an improvement. |
| Connections: −88,122 triangles overall, versus −214,986 in Magnetic | `d3df960` replaces the previous topology-sized edge submission (25 segments) with 25 fixed build slots × 384 edge slots + 4 reserved animal links = 9,604 instances; 8 segments × 2 triangles = 153,664 submitted triangles | Current Connections minus Magnetic is exactly 153,664; stored difference is 26,800. Additional 126,864 combined with the common −214,986 yields −88,122. This identifies the changed submission mechanism; report maxima can come from different frames and do not prove complete old/new topology. |
| Test/Design Test: −25,020 triangles, −3 geometries despite +12 draws | Different diagnostic composition, changed view/population and Connections submission coexist | The mechanisms above are relevant, but the complete numerical decomposition is unresolved. A reduced triangle count alone is not correctness evidence. |

Current relevant owners are `src/modules/mycelium/network-web.ts` (fixed instance
count/full node draw range), `mycelium.ts` (non-frustum-culled edge/node meshes
and asynchronous worker publication), `src/levels/level-runtime.ts` (viewer
placement), authored vegetation configuration and animal actors. Empty or
out-of-reach Mycelium rows collapse in the shader without reducing fixed-capacity
renderer counters. **Fixed-capacity counters do not prove completed or visible
topology.**

## Queue and topology uncertainty

Current peak queue: White World 0; Scent 109; Echo/Motion/Thermal/Magnetic 249;
Connections/Test/Design Test 256 (capacity). The reports' drain marker is −1
except White World 0. Matching streaming fields do not prove there was no
rejected gather or that worker results were visible when counted.

The rejected-gather defect discovered during attribution was reproduced and
corrected separately in [#82](../issue-82/README.md). Its five regression cases
and before/after results are owned there, not repeated in this reference record.
Fixed-capacity counters remained identical after that correction, which confirms
that matching counts alone cannot prove completed topology.

This attribution did not change source, dependencies, benchmark settings or the
production baseline. Confirmed D5 Clipmap migration belongs to future #13 and
does not retrospectively explain these deltas. The [roadmap](../../roadmap.md)
owns the remaining visual/workload decision and explicit reference approval.

## Exact review-only candidate after #82

[Complete proposed reference diff](quick-reference-candidate.diff) contains only
the seven quick-level counter changes from the table, generated in memory from
[#82's final quick report](../issue-82/verification.json) (`quick`). The production baseline was
not edited. White World/Scent, textures/programs and the empty full-profile
baseline remain unchanged. This is a review artifact, not an apply instruction,
accepted reference, or numerical explanation of every historic delta.

#82's final regression/browser evidence now addresses the demonstrated rejected
gather recovery gap; all nine quick counters and queue fields still match #77.
That removes the specific reproduced technical defect but does not retroactively
prove all historical workload changes intended. The failed additional pointer-lock
view is tracked by [#83](https://github.com/Strehk/becoming-many/issues/83), so
human ground/topology view remains outstanding. Exact workload attribution,
visual validity, this diff and the due cumulative review require explicit
human consideration before any baseline update. Final ordinary EN/DE now pass under [#79](../issue-79/README.md#final-ordinary-full-shows);
human listening/visual/reference acceptance remain open.
