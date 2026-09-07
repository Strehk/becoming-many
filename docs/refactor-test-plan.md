# Refactor Test Plan

Finish one coherent issue or agreed implementation block before testing. Do not
run checks after each file edit, agent handoff or small refactor. An intermediate
check is justified only by a concrete failure or uncertainty blocking the next
implementation step. The [workflow](refactor-workflow.md) owns scope and commits.

## One targeted verification pass

Use existing repository commands and tools. Select checks for the combined diff,
not each intermediate edit. Lint once at the end of the block. For TypeScript
changes, run `bun run check` or `bun run build`; build already includes type
checking, so do not run both for the same candidate.

| Affected behavior | Smallest useful additional check |
| --- | --- |
| Documentation only | Review changed text and links; `git diff --check`; no application tests, build or browser replay |
| Logic or configuration | Existing focused Bun tests covering the changed behavior; compare effective values when migrating recipes |
| Browser UI or runtime | Exercise the affected real interaction in the browser, including its relevant start/frame/end path |
| Resource ownership or async lifetime | Check the changed lifetime and the concrete failure/restart case at risk; no default exhaustive cancellation matrix |
| Rendering, streaming, audio or scheduling cost | A comparable local before/after measurement of the affected workload and its visible behavior |
| Test tooling | Run its affected scenario and check that the relevant failure is detected |
| Physical-device acceptance | Actual required equipment; explicitly record anything unavailable |

Run broader tests, full shows or Fallow only when the combined change affects a
shared boundary broadly, a failure requires diagnosis, or a concrete acceptance
criterion needs them. No mandatory complete command set before every commit, no
fixed three-issue audit and no automatic milestone replay. Once relevant checks
pass, commit when authorized and continue. Later corrections rerun only checks
whose inputs changed or whose failures remain unresolved.

## Browser and performance

Reuse the existing Station/preview and tools described in
[Browser Checks](../tests/browser/README.md) and
[Benchmark](../tests/benchmark/README.md). Build once when needed for the final
browser candidate. Test affected routes and actual controls; HTTP 200 alone
proves little. Do not replay every surface, level or EN/DE show for a local edit.
Observe unexpected console, asset and shader errors and fix their causes.
Use fresh contexts for changed startup behavior and repeated sessions when the
changed lifetime requires them. Do not add a parallel harness.

Measure cost changes under comparable browser/GPU, route, viewport and warmup
conditions, without competing GPU work or diagnostic tracing. Repeat measurements
when noise or an ambiguous result prevents a conclusion, not to meet a fixed
run count. Keep deterministic counters, headed timing and normal-show behavior
distinct. Reuse prior evidence for unchanged behavior and identify its source.
Do not claim a performance improvement without relevant measurements.

[Performance](performance.md) owns the 90 Hz Windows-PCVR USB-C target. A 60 Hz
Mac browser, simulated M5 or visible XR button cannot prove physical acceptance.
Claims about sustained operation require a sustained observation. Unavailable
hardware/listening evidence stays open; it does not block independent software
work. Concrete visitor-restart choices remain decisions in the target architecture.
Never weaken assertions, suppress a finding or update a benchmark reference to
turn a failure green. Exact benchmark updates still need explicit approval.

## Keep only useful tests and evidence

Prefer existing behavior tests. Add a small regression test for a meaningful
current risk, not to mirror a rename, private implementation or temporary step.
Delete tests, fixtures and settings exclusive to removed code in the same block.
Delete duplicate tests and one-time probes once their purpose is retired and
essential findings retained. A passing test or closed issue alone does not make
a still-relevant regression test obsolete. Never delete tests to conceal defects.

Keep one concise result with source/diff identity, commands, outcomes and limits;
for comparisons retain relevant values and conditions. Preserve decisive failed
results and explain the repair; do not retry into unexplained success or commit
raw frame arrays, repeated dumps and intermediate reports. No new test framework,
coverage target or verification infrastructure without a concrete current need.
