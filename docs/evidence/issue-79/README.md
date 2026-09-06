# Issue #79 — Audio scheduling correction and evidence

Dated evidence from 2026-09-05. The distinct suspended-Tone scheduling defect
was corrected; the original #75 strict-start cause remains unassigned. Current
readiness and human actions belong to the [roadmap](../../roadmap.md).

## Final ordinary full shows

[English summary](measurements.json) (`full-show-en-final-summary`),
[English environment](measurements.json) (`full-show-en-final-environment`),
[German summary](measurements.json) (`full-show-de-final-summary`),
[German environment](measurements.json) (`full-show-de-final-environment`).

| Observation | English | German |
| --- | --- | --- |
| Command result / unexpected errors | Exit 0, passed, none | Exit 0, passed, none |
| Show start → end, scale | 0.005333333333333329 → 521 s, 1 | 0 → 521 s, 1 |
| Observer elapsed | 522.0011000000238 s | 522.0015 s |
| External RAF intervals | 31,317 | 31,317 |
| Median / p95 / p99 / maximum, rounded ms | 16.7 / 17.6 / 18.5 / 18.8 | 16.7 / 17.6 / 18.5 / 18.8 |
| Hidden / capped | False / false | False / false |
| Audio responses / unique narration files | 15 / 8 | 15 / 8 |
| Retained construction warnings | 10 | 10 |

These are sequential headed production runs with genuine Hold/seek-zero/Play,
normal VSync, no CDP/trace/video or substituted timers. Apple M2 Max / ANGLE
Metal, software rendering false, Chromium 151.0.7922.34, 1,280 × 720, scale 1,
awake approximately 60 Hz desktop displays. The 90 Hz reference is 11.111 ms,
so all 31,317 intervals exceed it in each run. Those counts are **not missed
headset frames** and do not establish PICO 90 Hz. Clock progression and successful
responses do not prove audible narration or organ output. Tone construction
warnings remain separate from unexpected errors.

Both use runtime digest
`5308e3e7c9163a681b52617f2a12a0245a9399d4015e535284759a4a12ce8471`,
HEAD `9bfb84b5699a210e78ec81a295a2b028907af726` plus uncommitted changes.
Per-run diff identities differ with concurrent documentation and are retained
in the reports. Full frame arrays remain local under the recorded ignored raw
paths; summaries retain counts, exact statistics and raw SHA-256.

## Failure history and scope of the correction

| Historical observation | Retained evidence | Interpretation |
| --- | --- | --- |
| Original #75 English failure | [Original summary](../issue-75/measurements.json) (`full-show-en-1-summary`) | Strict-start assertion and subsequent browser closure before completion; 180 s host progress was not an exact cue/time. Original cause remains unresolved. |
| Instrumented natural English reached 521 s | [Natural summary](diagnostics.json) (`natural-production-start-summary`) | No errors; negative reproduction, not a fix by itself |
| Organ import delayed 3,500 ms, 45 s observation | [Delay summary](diagnostics.json) (`provoked-lazy-import-race-summary`) | Both realtime contexts ran, no errors |
| 24 real-frame seek cycles 0 ↔ 140, 45 s observation | [Seek summary](diagnostics.json) (`provoked-seek-lane-reactivation-summary`) | No errors |
| Selective suspension, 30 s | [First suspension summary](diagnostics.json) (`provoked-independent-organ-suspension-summary`) | Different real increasing-StateTimeline pageerror. Initial aggregate fields missed it; raw-event readback corrected that discrepancy. |
| Repeated suspension with all-exception scopes | [Exact scopes](diagnostics.json) (`provoked-suspension-exception-scopes-summary`) | Distinct Sonar scheduling defect proved; not original strict-start cause attribution |

The exact failing frame shows Sonar/MembraneSynth, Echo active, Show time
143.19466666666668 s, step 87 at 143.3325 s. Tone is suspended at current time
1.552 s (`now()` 1.6520000000000001, look-ahead 0.1). Requested start
1.7898333333333332 precedes existing start 1.7903333333333498 and stop
1.8613333333333497. JavaScript dispatch continued against frozen Tone time while
native Show advanced. The later debugger page observation 144.48 s is not the
failing frame time. Ten suspended-context construction warnings also occur in
successful runs and do not establish a cause by themselves.

Only existing `organ-runtime.ts`, `organ-timeline.ts` and timeline tests changed.
Unavailable Tone time dispatches no steps. Each track retains the last
**callback-dispatch timestamp** and skips new mapped times overlapping prior
dispatches across suspension, seeks and lane reactivation. A callback may be
silent; this is not measured Tone-start or audible-note history. Note times
are never shifted. The one-microsecond comparison matches Tone 14.8.49's exact
Source.start strict-greater rule; it is not invented scheduling padding.
No second clock, catch, retry or lifecycle framework. Full context/late-import
disposal remains #9/D6. Independent source review found no new blocker.

## Focused correction verification

Historical #79 code checkpoint: before focused tests 5 pass / 6 fail; after
12 timeline + 8 sequencer = 20 pass. Full suite then 477 pass, 64 files,
26,347 assertions; [gate commands/results](measurements.json) (`code-gates`) pass type/lint/build/
diff and real boundaries. Fallow 3.21/3.22 retain inherited 3 dead-code findings,
10 clone groups and 22 health findings. The integrated #82 state subsequently
passes 482 tests; [its evidence](../issue-82/README.md) owns that later gate.

| After-change browser case | Evidence and result |
| --- | --- |
| [Short suspend/resume](diagnostics.json) (`verify-short-organ-suspension-resume-summary`) | Tone frozen 1.6213333333333333, existing future oscillator start 1.8196666666666546; Show 141.584 → 141.616, resumed at 141.65866666666668 within the old 0.15 s window. No new observed starts while suspended; renewed starts after resume, zero errors through 5 s follow-up. |
| [Long suspend/resume](diagnostics.json) (`verify-long-organ-suspension-resume-summary`) | Tone frozen 1.552, Show 141.584 → 144.58666666666667; no new observed starts while suspended. Running after resume with starts 1.9999999999999831 / 3.650166666666662 / 5.292333333333334, zero errors through 5 s follow-up. |

These bounded native Oscillator.start observations are distinct from the
implementation's per-track callback timestamps. Raw errors, pageerror,
other-pause and console-error records all pass. These are instrumented functional
checks, not performance or audible-output acceptance. Source/diff identities
and raw hashes are retained in each summary.

## Rendering proxy before/after the audio correction

Three uninstrumented full-profile Echo runs before and after use identical
headset-independent desktop conditions: 1,280 × 720, actual M2 Max / ANGLE Metal,
awake displays, AC power, 1,260 deterministic frames. The benchmark has no show
audio; it does not measure the correction's audio CPU cost.

All six runs retain identical counters and streaming fields; median 0.3 ms and
p95 2.5 ms. Each individual p99/maximum remains in the linked records.

No browser failures or observed regression in this limited proxy; no speedup
claim. The large maxima are not physical PICO acceptance. Exact reports remain:

- Before: [run 1](measurements.json) (`before-render-run1`), [run 2](measurements.json) (`before-render-run2`),
  [run 3](measurements.json) (`before-render-run3`), [environment](measurements.json) (`before-render-environment`).
- After: [run 1](measurements.json) (`after-render-run1`), [run 2](measurements.json) (`after-render-run2`),
  [run 3](measurements.json) (`after-render-run3`), [environment](measurements.json) (`after-render-environment`).

After-#79 reports also contain Connections measured **before #82**; that issue
links these files rather than duplicating the dataset.
