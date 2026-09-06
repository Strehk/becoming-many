# Issue #75 — Initial Browser and Performance Evidence

Historical tooling checkpoint, 2026-09-05 UTC. [Measurements](measurements.json)
contains records named after the original reports; [shared metadata](../README.md)
resolves their exact source/diff/host/GPU identities. Later application corrections
belong to [#77](../issue-77/README.md), [#79](../issue-79/README.md) and
[#82](../issue-82/README.md). Current review/readiness: [roadmap](../../roadmap.md).

## Implemented tooling and checks

Existing Bun, Playwright, Station and benchmark ownership were reused. Production
smoke covers four entries, nine named routes and initial controls. Normal-show
observation uses genuine audio gestures and production scheduling; deterministic
replay remains separate. The existing frame-statistics owner is reused. No new
dependency, production test API, renderer or permanent telemetry.

At this checkpoint: 470 tests, type/lint/build/diff pass. Fallow reports inherited
2 unused exports, 1 duplicate pair, 10 clone groups/208 lines and 22 health
findings; early rules expose the two Mycelium imports later removed by #77.
Temporary boundary probes were removed. An otherwise-ready benchmark
with an intentional page exception was rejected; no failing fixture remained.
Smoke passes 14/14, including station contracts, audio wake, pause/play, language,
seek/reset and second playback. That retains one world, not full dispose/start.

Review corrected bounded-wait, teardown-error, launch-failure and hidden-tab
handling. A combined two-browser negative probe stalled and was terminated;
a separate process proved rejection. Smoke attempt 1 wrongly assumed an audio
wake overlay; the already-running context was valid and the scenario was fixed.
Those failed attempts remain recorded, not application failures silently ignored.
History: `d991d0c` benchmark, `e071a45` entries, `9abde94` composition contracts.

## Recorded runs and interpretation

| Records in measurements.json | Result |
| --- | --- |
| `gates-final-results`, `smoke-final-smoke` | Gate exits and 14 individual route results |
| `quick-1-quick`, `quick-2-quick` | All nine counter sets agree; stored gate fails seven #78 references |
| `full-1-full`, `full-2-full`, `full-3-full` | Every per-level timing/counter/streaming value retained; zero browser errors |
| `transitions-1-summary` | Eight sought cues, first and repeated crossings; every individual interval summary retained |
| `full-show-en-1-summary` | Original incomplete English attempt and its recorded failure |

Actual M2 Max / ANGLE Metal, software rendering false, Darwin25.6.0, Bun1.3.14,
Chromium151.0.7922.34, Station4180, scale1; quick640×360, full1280×720. Full
replay discards240 warmup frames and samples1260 with deterministic streaming.
Runs were sequential, without trace/video/DevTools; unrelated OS activity was
not fully controlled. No physical-headset or thermal-steady-state claim.

All three full runs agree on counters. Important retained spikes include
Scent856.4–894.8ms and Echo256.8–277.3ms maxima. Sought Echo first crossing has
132.4ms maximum versus17.7ms repeated, with16.7ms medians; #16 owns follow-up.
These data do not approve a timing threshold, full baseline or PICO90Hz.

The original English attempt reports a strict-start assertion followed by
browser closure.180s host progress is not its exact failure time/voice/cue.
No German run followed that attempt. [#79](../issue-79/README.md) preserves the
unassigned original cause separately from its proved correction and later full
EN/DE passes. Network/clock observations never establish audible output.
