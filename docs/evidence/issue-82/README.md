# Issue #82 — Rejected Mycelium gather recovery

Dated implementation and verification evidence from 2026-09-05. Current readiness
and human actions belong to the [roadmap](../../roadmap.md).

## Owning change and removal

Only existing `src/modules/mycelium/mycelium.ts` and its existing test file change.
The WebStream retains only jobs not yet admitted to StreamQueue, in an array
sized from its existing gather window (49 slots with current settings). Accepted
jobs immediately leave those references. Stationary updates retry retained jobs
and stop at the first capacity rejection. Repeated attempts reuse the same job;
no new queue, synchronous fallback, coordinator, public contract or file.

Reassignment replaces the retained job. Validity checks combine assignment
revision with exact stream identity; replies from a prior unloaded stream
cannot match a newly loaded stream merely because revision numbers repeat.
Recycled node/edge ranges are immediately cleared using existing count-zero GPU
writers. Resident ranges, topology mathematics, worker protocol and optional
moving-animal architecture remain unchanged. The ignored enqueue result and
permanent loss of rejected work are removed together.

Work stays bounded: one reference array per existing window, four shared empty
topology arrays, job allocation on assignment as before, no new retry closures.
Empty edge descriptors and GPU writes occur on build-slot reassignment.
No D4/#80 capability-retirement decision is implemented here.

## Regression and repository gates

Before change: 16 existing tests pass and all five added regressions fail.
The initial rejected-admission case filled the queue with 64 current foreign
jobs, crossed a 16 m boundary (viewer x=17), and recorded seven rejections.
After draining and 53 stationary frames it produced zero of five expected
requests. The first isolated reproduction's test was temporarily restored to
keep #79 gates separate; it is now included in #82's passing regression set.

| Demonstrated case | Corrected result |
| --- | --- |
| Full queue → boundary → drained queue → stationary updates | 5/5 current build requests, exact own anchor and eight halo anchors |
| Repeated movement while full, then only three free queue positions | All 25 current chunks recover with exact neighbor offsets while 61 foreign jobs remain; no old chunk published |
| Recycled GPU ranges before replacement gather | Empty immediately; old revision reply cannot repopulate them |
| Queued work after unload | Disposed node buffers remain unchanged; before change their attribute version advanced 49 → 56 |
| Old worker reply after reload with matching slot/revision numbers | Rejected by stream identity; the new worker's valid reply still publishes |

After: 21 focused tests pass. Final full suite: **482 pass**, 64 files, 26,639
assertions. Typecheck, lint, production build, actual boundaries and diff check
exit 0. Fallow 3.21.0 and 3.22.0 retain inherited 3 dead-code findings, 10 clone
groups and 22 health findings (full scan exit 1). Build preceded a test-only
readability simplification; application source stayed unchanged afterwards and
unit/type/lint/Fallow/diff checks were repeated. These checks do not establish
complete application disposal or human/device acceptance.

[Exact gate commands/results](verification.json) (`code-gates`) are retained. Raw logs and the
original failing patch remain under ignored `benchmark-results/issue-82/`;
`implementation-summary.md` maps responsibility and regression details.

## Production browser and rendering comparison

Before-change data is stored once under #79:
[run 1](../issue-79/measurements.json) (`after-render-run1`),
[run 2](../issue-79/measurements.json) (`after-render-run2`),
[run 3](../issue-79/measurements.json) (`after-render-run3`),
[environment](../issue-79/measurements.json) (`after-render-environment`).
Those Connections entries were captured before #82 changed Mycelium.
After: [run 1](verification.json) (`connections-after-run1`),
[run 2](verification.json) (`connections-after-run2`), [run 3](verification.json) (`connections-after-run3`),
[environment](verification.json) (`environment`).

All six 1,260-frame runs retain identical counters and queue fields. Median
was 1.3/1.4/1.3 ms before and 1.3/1.3/1.3 ms after; p95 was 2.7 ms throughout.
Each individual percentile and maximum remains in its record.

No browser failures. No regression is observed in this limited desktop sample;
no speedup or PICO acceptance is claimed. Equal fixed-capacity counters do not
prove completed visible topology; the corrected admission/validity cases are
proved separately by the focused regressions.

[Production smoke](verification.json) (`smoke`): 14/14 pass with no unexpected errors.
[Quick report](verification.json) (`quick`): all nine levels complete without browser errors;
every counter and queue field exactly matches #77's retained quick run (and
therefore its matching #75 runs). Stored `--check` still fails the same seven
#78 references. Baseline remains unchanged and unapproved.

Headed Chromium 151.0.7922.34, actual Apple M2 Max / ANGLE Metal, software
rendering false, awake displays and AC power. Final browser source digest:
`5308e3e7c9163a681b52617f2a12a0245a9399d4015e535284759a4a12ce8471`;
diff digest `c888ff3d6d10d37d3870992fa4dac1e2a8d99e261aa65af6045b815548d0f713`.
Reports retain exact identities and environment. The separate ground-view attempt failed under #83. Ordinary final EN/DE
[show observations](../issue-79/README.md#final-ordinary-full-shows) both pass;
no listening result is invented.

## Failed separate ground-view attempt

[Initial unsuccessful report](verification.json) (`failed-views-initial`) retains an empty result
set after the first attempt timed out. The [input-diagnosis report](verification.json) (`failed-pointer-lock-views`)
records real PointerLockControls console/page errors: the root document was not
valid for pointer lock. The ordinary canvas click was attempted with document
focus, followed by 300 pixels of downward input, but the ground look was
ineffective. **The raw pose field describes an attempt only; pointer lock was
rejected.** Raw values remain unchanged rather than rewritten as success.

The orchestrator inspected `test-before-input.png`: the running Test scene
shows vegetation, slope, diagnostic colors and sky. This does not establish
complete Connections topology or ground opening. The attempted-look image still
shows the startup view. These failed visual checks are separate from passing
smoke/benchmark runs and prove no rendering defect or measured regression.

After searching existing issues, [#83](https://github.com/Strehk/becoming-many/issues/83)
records the unresolved browser/document-versus-controls diagnosis, without a
new implementation slot. Human ground-view acceptance remains outstanding;
ordinary full-show results are retained under #79.
