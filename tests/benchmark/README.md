<!--
Purpose: Explain how the browser benchmark is run and what it produces.
Context: The measurement lives in src/benchmark; this folder harnesses it.
Responsibility: Document the command, its flags, and the accepted baseline.
Boundary: Route, sampling, and summarizing rules stay in src/benchmark.
-->

# Benchmark Runner

`run-benchmark.ts` builds nothing. It serves the existing production build,
replays the fixed route in Chromium, and writes one report artifact.

```sh
bun run build
bun run benchmark                                   # every level, full profile
bun run benchmark --profile quick --level magnetic  # one level, coarse replay
bun run benchmark --headed                          # measure on a real GPU
```

| Flag | Meaning |
| --- | --- |
| `--profile <full\|quick>` | Replay density. `full` is the 90 Hz replay; `quick` is coarser and faster. |
| `--level <name>` | Repeatable. Defaults to every level in the catalog. |
| `--headed` | Use this machine's GPU. Headless falls back to SwiftShader software rendering. |
| `--out <dir>` | Artifact directory. Defaults to `benchmark-results/`. |
| `--timeout <seconds>` | Per-level cap. Defaults to 600. |
| `--check` | Fail when counters differ from the accepted baseline. |
| `--update` | Accept the measured counters into `benchmark-baseline.ts`. |
| `--base-url <url>` | Use an already running server instead of starting `vite preview`. |

## While it runs

A full run takes minutes per level, so the command says what it is doing
rather than going silent:

```
Benchmarking 9 level(s) at profile "full", 1500 frames each.
Rendering: headless Chromium with SwiftShader software rendering.
Per-level timeout 10m 00s, so the run ends after at most 1h 30m.
[7/9] connections ...
  frame 306/1500 (20%) · 50s elapsed · ~3m 15s left
  1m 06s for this level · ~4m 30s left for 2 level(s)
```

The opening block bounds the run before it starts: frames per level, the
rendering path, and the worst case if every level hits `--timeout`. A progress
line follows every 10 seconds, estimating the rest of the level from the frame
rate of the last interval. Each finished level projects its wall-clock cost
onto the levels not started yet, which is a rough figure — levels differ widely
in density — but enough to decide whether to wait.

`benchmark-progress.ts` owns those lines and is covered by
`benchmark-progress.test.ts`.

## Artifacts

Each run writes `<profile>.md` — the readable report, with the run conditions
that make its numbers meaningful — and `<profile>.json` with every raw value.
Both are gitignored; commit a report into `docs/` only when it is evidence
worth keeping.

A level that exceeds `--timeout` is recorded and the remaining levels still
run. The artifact then opens with a `## Not Measured` table naming each level
and why, and the command exits non-zero, so a partial run can never be read as
a complete one.

## Software rendering has limits

Without a GPU, Chromium falls back to SwiftShader, which is fill-rate bound.
Dense geometry is survivable — the Connections level replays in about 100
seconds at the `quick` profile — but the grass-carrying `test` and
`design-test` presets exceed several minutes per run and time out. Measure
those with `--headed` on a machine with a GPU.

## Baseline

`benchmark-baseline.ts` records accepted counters per profile and level. Only
listed levels are checked, so a level becomes gated by adding it deliberately.
Counters are exact integers, so the comparison uses no tolerance: a difference
is a real change in what the scene draws, and is accepted with `--update`.

Frame times never enter the baseline. Headless numbers describe the software
rasterizer, and even on a GPU they are only comparable to another run on the
same machine.

`benchmark-route.test.ts` and `benchmark-report.test.ts` cover the pure route
and summary logic under `bun test` and need no browser.
