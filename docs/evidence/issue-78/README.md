# Issue #78 — Current quick reference proposal

Prepared on 2026-09-07 at clean `21d2646` after the UI/Engine architecture
migration. [Exact proposed diff](quick-reference-candidate.diff) is **unapproved**.
The real `tests/benchmark/benchmark-baseline.ts` remains unchanged, SHA256
`f427c1febdaec457311b6956418e2297b16bd44b20453ff8acbdef29e378a006`. `full: {}` stays unchanged.

## Current measured workload

Two sequential production Station runs used the existing quick profile on
Apple M2 Max / ANGLE Metal, software rendering false, Chromium
151.0.7922.34, 640 × 360 and device scale 1.
There was no competing task-owned GPU work. Power/background processes were
not independently controlled; these are counter comparisons, not installation
90 Hz or timing-improvement evidence.

The unchanged route has 240 warmup frames at its first pose, then 210 frames
at 1/15 s over 14 seconds. Counters are maxima over that route, not a single
pose. Run still applies its existing viewer rig, pitch assist and height limits.
Source digest: `e4f3a3b7ed01c37df46ebb93cca20d7889805a43596c155a0b26bc4246df0972`. Both identity records have
revision `21d2646afa5cbe9aaa4e57a9ea9c340053e80ef2`, empty working diff and no dirty files.

All nine reports completed with `failures: []`; all five counters and streaming
fields match exactly between the two runs. Both `--check` commands exit 1 for
seven old-reference mismatches. This expected reference failure is retained,
not reclassified as a passing gate.

| Level | Draw calls stored → proposed | Triangles stored → proposed | Geometries stored → proposed | Textures stored → proposed | Programs stored → proposed |
| --- | ---: | ---: | ---: | ---: | ---: |
| white-world | 1 → 1 | 0 → 0 | 1 → 1 | 0 → 0 | 1 → 1 |
| scent | 13 → 13 | 1,408 → 1,408 | 27 → 27 | 0 → 0 | 3 → 3 |
| echo | 60 → 58 | 3,810,268 → 3,947,244 | 68 → 66 | 1 → 1 | 8 → 8 |
| motion | 63 → 61 | 3,810,268 → 3,947,244 | 71 → 69 | 1 → 1 | 10 → 10 |
| thermal | 89 → 99 | 3,820,178 → 3,958,910 | 92 → 90 | 48 → 48 | 14 → 14 |
| magnetic | 90 → 100 | 3,821,138 → 3,959,870 | 93 → 91 | 48 → 48 | 15 → 15 |
| connections | 92 → 102 | 3,847,938 → 4,113,470 | 93 → 93 | 48 → 48 | 17 → 17 |
| test | 82 → 101 | 4,278,320 → 4,043,130 | 94 → 93 | 47 → 48 | 11 → 11 |
| design-test | 81 → 100 | 4,277,360 → 4,042,170 | 93 → 92 | 47 → 48 | 10 → 10 |

Current queue peaks are 0 (White World), 109 (Scent), 249
(Echo/Motion/Thermal/Magnetic) and 256 (Connections/Test/Design Test).
Drain markers remain -1 outside White World (0). Matching bounded queue and
fixed-capacity counters do not prove complete or visible worker topology.

## Why this proposal replaces the old candidate

The old after-#82 candidate predates the implemented animal-link retirement,
Grass-to-Clipmap migration, conservative Clipmap bounds, shared zone influences
and approved bank-clearance change (#80/#13/#72/#71/#81). These alter submitted
geometry, content selection and effective visibility. The route and stored
reference are unchanged; its historical numerical identity is no longer the
current scene. The detailed earlier attribution and its unresolved numerical
limits are retained below, rather than attributing every changed triangle to
one cause.

Current Connections/Test counters and streaming match the two retained #81
post-clearance reports exactly (`benchmark-results/issue-81/after-quick-20260907/quick.json`,
SHA256 `a3741695373a4385adaf3b9d3a3abee5867dd244e4c575d2581ce67881235b73`).
That packet contains only those two levels; it does not prove before/after
identity for all nine. No new counter/reference acceptance is implied.

## Reviewable views and remaining decision

The [current views](current-views/) show each level at the stopped endpoint of
the same existing route, captured separately after both measurement runs with
normal browser frame pacing. They illustrate visible content; they are neither
route maxima nor proof of all worker topology, perceptual quality or a complete
Show. The unchanged per-level presets remain the construction authority.

Visual inspection of all nine endpoint images found these concrete limits:

| Views | Visible facts and limits |
| --- | --- |
| [White World](current-views/white-world.png), [Scent](current-views/scent.png) | White space and dark particles; extra Scent trails are not reliably visible here. |
| [Echo](current-views/echo.png), [Motion](current-views/motion.png) | Dark nearby geometry fills most of the image; Motion traces cannot be distinguished reliably. |
| [Thermal](current-views/thermal.png), [Magnetic](current-views/magnetic.png), [Connections](current-views/connections.png) | Blue/turquoise near surfaces; magnetic pattern and complete root topology are not demonstrated. |
| [Test](current-views/test.png), [Design Test](current-views/design-test.png) | Tree crowns and distinct green/violet palettes; ground, river and complete plant anchoring remain hard to see. |

The near geometry and upward-looking view limit this endpoint as a content
review. This does not prove a missing effect or regression, but it also does not
satisfy comprehensive visual workload acceptance. A suitable ground/sense view
still needs review; no new control path or altered benchmark route was introduced
just to produce a reassuring image.

Before application, review the intended content and exact numerical diff.
No automatic `--update` was run. Explicit numerical approval, full milestone
and Windows-PCVR acceptance remain outstanding; this proposal prepares the
review and does not close #78.

| Local evidence | SHA256 |
| --- | --- |
| `benchmark-results/issue-78/current-quick-1/quick.json` | `4bf7f0ad248d038add74f7c098377e3697178bdfc56922e0322446d40fd4a8be` |
| `benchmark-results/issue-78/current-quick-2/quick.json` | `3e1065dc316f0fce317bf036f069ad77b9f90163e9f342f432594c6b36054fda` |
| `benchmark-results/issue-78/current-views/views.json` | `7fbf4df7dcfa79f2f5cf2c727d653ce5cb873aebc5ab664957b2db783f7f3d3e` |

# Historical reference attribution

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

[Historical after-#82 reference diff](https://github.com/Strehk/becoming-many/blob/21d2646afa5cbe9aaa4e57a9ea9c340053e80ef2/docs/evidence/issue-78/quick-reference-candidate.diff) contains only
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
