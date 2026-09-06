# Issue #77 — Shared Material-Effect Contract

Historical local completion on `david_refactor`, HEAD `9bfb84b` plus recorded
uncommitted changes. [Verification](verification.json) retains the original
report keys; [shared metadata](../README.md) identifies each browser run.

The [recorded instruction](https://github.com/Strehk/becoming-many/issues/77#issuecomment-5554801541)
authorized moving the unchanged `TerrainMaterialEffect` into existing
`src/utils/asset-loader/material-effect.ts`, beside the distinct `UnlitMaterialEffect`.
Terrain/Mycelium/Composition/tests use it directly; old export and two sibling
imports are removed. No new file, shim, cast, duplicate or runtime behavior.
History `d3df960`, `2214cba`, `faa37e7` explains the cover/warmth consumers.
Independent review found no owner/caller issue.

| Record | Evidence |
| --- | --- |
| `gates` |27 focused tests/931 assertions before and after;470 full/64 files/26,331 assertions; type/lint/build/diff pass |
| `boundary-proof` | Fallow3.21/3.22 real graphs0; temporary reachable sibling import yields exactly1 violation/exit1, byte-exact restoration then pass |
| `manifest-comparison` | All106 production paths and SHA-256 bytes identical; complete manifest retained |
| `smoke` |14/14 production routes pass, no unexpected errors |
| `counter-comparison` | All nine counters/streaming fields equal both #75 quick runs; same seven #78 stored-reference failures, baseline unchanged |
| `views` | Test/Connections authored startup poses, no movement,5s settle, actualM2Max/ANGLEMetal, no errors |

The orchestrator inspected both startup views without an obvious startup fault.
They do not prove complete topology/dynamic soil opening; byte-identical output
is the behavior-preservation proof for the erased move. Full Fallow still had
inherited3 dead-code/10 clone/22 health findings and reserved empty-zone warnings.
Raw logs/PNGs remain under ignored `benchmark-results/issue-77/`. Current staged
#11 review and integration readiness live in the [roadmap](../../roadmap.md).
