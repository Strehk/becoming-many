# Declarative UI consolidation — 2026-09-08

The final UI integration builds on checkpoint `0e2c676`, the shared intermediate
checkpoint `5b1302b`, M5 completion `62655f8`, and Start completion `a136bcc`.
The attached reports identify the exact tested working source with source/diff
hashes; they precede this documentation-only evidence capture and final commit.

## Results

- `bun run lint`: passes (310 files).
- `bun run build`: TypeScript and Vite pass; the existing large-chunk advisory remains.
- `bun test`: 556 tests pass, 28,616 assertions. After the final entry-path change,
  the 10 focused markup/capability/scrubbing tests also pass (73 assertions).
- [Production Station](production.json): 19/19 scenarios pass on port 4181.
- [Vite development](development.json): 19/19 scenarios pass on port 5178.
- `bunx fallow dead-code --format compact --no-cache`: no boundary violations,
  no unused UI/Entry files. Three unrelated findings remain: `BAT_PASSAGE`,
  `STEP_LOOKAHEAD_SECONDS`, and duplicate export `ReadSwarmCrossing`.
  The broader analysis also retains authored-recipe duplication/complexity
  findings; neither this evidence nor the UI completion claims a clean full audit.
- Residual source search finds no authored DOM constructors/parsing sinks in
  UI or Entry. The sole production `createElement` is the non-mounted credits
  texture canvas, intentionally retained with its rendering owner.

Both visible Chromium runs exercise the four surfaces, ten named levels and
query routes; desktop/narrow layout, transport/scrub/cancel, language, drawer
focus/inert, M5 sample versus effective neutral input, Flash storage and USB
lifetime/response handling, and the Start practice sequence. Three additional
scenarios deny WebGL and verify the original declared canvas and visible alert.
Physical headset/M5/Windows-PCVR 90 Hz and venue acceptance remain unverified.
Screenshots/traces are functional evidence, not comparable performance timing.

## Defects found and corrected

- Static Conductor controls were visible before binding: the root is now inert
  until the initial UI update completes. Startup errors use a declared alert.
- Native screenshot caret hiding left empty inline-style attributes on inputs:
  screenshots now retain the original caret, preserving the strict style check.
- Sibling Entry script paths built correctly but failed under the new Vite root:
  HTML uses `/entry/` and Vite resolves that source prefix to `src/entry` in both modes.
- Newly static rehearsal/metrics shells require display rules scoped to their
  non-hidden state; cleanup preserves and hides the declared shell.

The initial sandbox browser launch failed before application execution. The
first functional production run retained the two UI/tooling failures above;
the first development attempt was stopped after diagnosing its entry-path error.
The final reports contain no unexpected browser errors, failed requests or
context loss. Historical raw attempts remain in ignored `benchmark-results/`.

## Screenshots

| Surface | Retained capture |
| --- | --- |
| Conductor desktop | [1280 px](conductor-1280.png) |
| Conductor narrow | [390 px](conductor-390.png) |
| Technician drawer | [Actual narrow viewport](conductor-technician.png) |
| Rehearsal | [390 px](rehearsal-390.png) |
| Test metrics | [1280 px](test-1280.png) |
| Flash | [390 px](flash-390.png) |

All route, startup-failure and Start-step captures remain under
`benchmark-results/ui-consolidation/production-final/`; development captures
remain under `benchmark-results/ui-consolidation/development-2/`.

## Scope and size

UI controllers change from 2,438 to 1,913 TypeScript lines, while their HTML
changes from 62 to 521 lines and central CSS from 967 to 977. These surface-only
counts exclude Entry orchestration, shared contracts, tests/tooling and the
concurrently implemented Start/M5 work; they are not a repository-wide reduction
claim. Runtime markup construction and duplicate scrub mechanics are removed.
