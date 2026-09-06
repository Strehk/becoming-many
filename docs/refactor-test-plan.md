# Refactor Test Plan

Use the [workflow](refactor-workflow.md) for branch checks, issue scope, human
gates and evidence retention. Reuse Bun, Biome, Vite, Fallow, Playwright and the
existing benchmark. Tests are maintained tools, not a permanent archive of
implementation steps. Test counts and coverage percentages are not goals.

## Test retention and deletion

- Keep the smallest tests that protect current public behavior, ownership,
  failure recovery or a demonstrated regression still possible in the system.
- Delete tests, fixtures and configuration exclusively for a removed feature,
  contract, alternative implementation or temporary migration in that change.
- Remove duplicate assertions/scenarios when another retained test covers the
  same risk and boundary. Do not replace them with an elaborate test framework.
- A one-time diagnostic or hypothesis probe can be discarded once its finding
  is resolved and essential evidence is retained. Boundary-violation probes
  and temporary profiling instrumentation should not remain in production.
- A green test or closed issue alone does not make a regression test obsolete.
  Briefly name the retired purpose or retained replacement when deleting tests.
  Never delete a failing test merely to conceal an unresolved defect.
- Prefer meaningful behavior assertions to snapshots of private structure.
  Pure renames/argument removal do not require new tests that mirror the edit.

## Select checks by affected behavior

| Change | Verification |
| --- | --- |
| Documentation/evidence only | Lint, links, JSON validity and preservation of essential values/identities; no application build or browser replay without a behavior/configuration change |
| Application/runtime/configuration | Focused tests, repository gates, production browser smoke and affected interactions |
| Shared ownership/async work | Current consumers, invalid states, unload/restart, late results and failure/recovery |
| Browser/test tooling | Its affected scenarios and failure detection; preserve independent application evidence when its inputs are unchanged |
| Rendering, audio, streaming or scheduling behavior/cost | Relevant before/after counters, comparable headed timings and normal-show checks |
| Milestone | Integrated browser/counter checks, full EN/DE show, cumulative architecture review and human acceptance |
| Physical-device behavior | The named PICO/M5/Windows/venue matrix in the issue; desktop simulation is insufficient |

For application work, run repository gates after implementation/simplification,
not after every edit. Before an authorized checkpoint/commit, run the complete
set. Repeat only checks affected by later edits or an unresolved failure:

```sh
bun test
bun run check
bun run lint
bun run build
bunx fallow
git diff --check
```

Report actual exits and inherited findings. A mechanical refactor can reuse
existing performance/full-show evidence when it demonstrably preserves the
measured behavior; state why and distinguish old/new source identities. A
changed shader, schedule or streaming algorithm requires new relevant evidence.
Do not weaken a test or baseline after seeing a failure.

## Browser checks

Build the application and use the production Station or preview server at its
actual printed URL. Test development-only behavior separately with `bun run dev`.
Existing commands and supported scenarios live in
[Browser Checks](../tests/browser/README.md) and
[Benchmark](../tests/benchmark/README.md); do not create another harness.

- Smoke must exercise ready states, not only HTTP 200: `/`, `/test.html`,
  `/conductor.html`, `/flash.html` and the named level routes.
- Check real controls where affected: audio wake, play/hold/resume, cue seek,
  EN/DE, reset and second visitor. A reset retaining World is not Run disposal.
- Fail on unexpected exceptions, request/asset failures, shader/context loss.
  Negative scenarios assert their exact expected failure; no broad allowlist.
- Verify station `/config` and `/health` where relevant. Flash smoke does not
  flash firmware. Simulated M5 and a desktop XR button do not prove hardware.
- Use fresh contexts for startup and the same context for repeated sessions.
  For visual changes, inspect comparable poses/cues with working real controls;
  a screenshot after failed input is not proof of the intended view.
- Capture traces/screenshots in separate functional/diagnostic runs, not timing
  runs. Human review records visible and audible behavior on the exact candidate.

## Performance comparisons

[Performance](performance.md) owns targets and measured findings. Keep these
three forms of evidence distinct:

1. Deterministic replay: exact scene counters under the existing fixed route.
2. Headed full profile: relative local timing, with at least three comparable
   before and after runs when runtime cost changes.
3. Normal show: ordinary VSync, narration/organ and actual streaming deadlines;
   full EN/DE at milestones, affected transitions for a bounded change.

Replay excludes show audio and substitutes clock/streaming work. Its intervals
are not isolated GPU duration or normal-show performance. Never compare quick
and full timings as equivalent workloads.

Pin browser/version, actual GPU, viewport/scale, route/profile, warmup, power and
awake-display conditions. Run timing tests sequentially without competing
builds, browser scenes, screenshots or traces. Preserve each repeated result,
including failures and variability; explain counter changes even if they fall.
Use unique output directories. Do not check out another branch for a baseline.

Compare median/p95/p99/max intervals, counters and queue/drain facts. Report
frame-budget misses only against an appropriate stated measurement reference;
a 90-Hz comparison on a 60-Hz desktop is not headset missed-frame evidence.
Object counters are not byte-accurate GPU memory. Derive regression thresholds
from baseline variability before evaluating changes; do not invent a passing
tolerance afterward. Never run benchmark `--update` without explicit approval
of the exact reference change, including understood workload differences.

Cold-transition checks compare first and repeated activation in a fresh context;
profiling identifies linking/uploads separately. Long-session and disposal
claims require their relevant repeated/sustained cases. Target 90 Hz acceptance
requires a physical PICO and the actual host/compositor/transport setup. Desktop
results do not authorize a fallback quality or refresh-rate decision.

## Failure and retention

Preserve failed/incomplete attempts and distinguish cancellation from application
failure. Do not retry into an unexplained success. Keep source/diff identity,
conditions, decisive errors and individual comparison values durable, with raw
artifact paths/hashes where useful. Deduplicate repeated metadata and warning
text; do not put full frame arrays or debugger dumps into source control.
Human listening, hardware acceptance and automated results remain separate.

Existing CI does not establish these local gates. Any future issue-backed CI
must keep baselines/source read-only, retain essential evidence and avoid
turning software-rendered timing into a local-GPU or PICO claim.
