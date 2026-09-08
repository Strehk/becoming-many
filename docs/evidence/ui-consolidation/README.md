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


## Completion review

This review starts at `7375ff4`. Corrections were preserved by the concurrent
checkpoint `67cfd64`; functional evidence was preserved in `b0e676d`. These
reports do not accept the subsequent Conductor redesign or standalone Entry
changes being implemented by separate tasks.

- Native Space activation now reaches focused buttons without triggering the
  global transport shortcut; already-handled keyboard events remain handled.
- Flash survives persisted pagehide and ends listeners/serial lifetime on final
  exit. Its released root is inert and cleanup failures remain visible in logs.
- Panels validate detached templates and required controls before binding or
  attaching them, preventing partially mounted controls after startup failure.
- Duplicate rendered-text state and readout forwarding wrappers are removed.
  Relative HTML Entry imports resolve in both Vite and Fallow. Stale paths in
  affected READMEs are corrected; the off-document credits canvas is retained.

Verification: lint (311 files), TypeScript/Vite build and 561 Bun tests pass
(29,025 assertions). The existing large-chunk advisory remains. The final added
mount scenarios also passed type checking. Browser results are
[19/19 Station scenarios](completion-production.json), supplemented by
[3/3 Station mount failures](completion-production-mount.json), and
[22/22 development scenarios](completion-development.json). Reports retain
source/diff identities. Tests cover native keyboard actions, scrub/cancel,
language, focus/inert/disabled states, M5 preview, Flash serial scenarios,
persisted/final pagehide, declared canvas lifetime and malformed UI startup.

All nine production surface/drawer captures were visually inspected, plus
selected development and malformed-template captures. Retained examples:
[Conductor desktop](completion-conductor-1280.png),
[Conductor narrow](completion-conductor-390.png),
[Rehearsal narrow](completion-rehearsal-390.png),
[Test desktop](completion-test-1280.png), [Flash narrow](completion-flash-390.png).

The first development attempt failed during concurrent Vite source reload and
dependency optimization. The new rapid language test also aborted its own audio
loads; it now awaits narration request completion before switching again.
The stable repeat passes without suppressing request failures.

[Fallow evidence](completion-fallow.json) records zero live boundary violations
and unresolved imports after fixing four HTML references. Three export findings
are matched to `0e2c676`, not merely called pre-existing: `BAT_PASSAGE`,
`STEP_LOOKAHEAD_SECONDS`, and `ReadSwarmCrossing`. Three deliberately forbidden
imports were rejected in a disposable source export. Fourteen clone groups and
36 health findings remain; authored recipe duplication is intentional, while
Flash/Start/M5 complexity is not all inherited. Native keyboard correctness adds
branches (Conductor cyclomatic 15 to 19); this is justified bug-fix growth.
The exported older snapshots establish matched findings, not complete audits.

### Whole production balance

[Physical line counts](completion-size.json) include Entry, shared contracts,
engine and Station, rather than counting moved UI files as deletion.

| Source | Production TS | HTML | CSS | Tests/tooling TS | Documentation |
| --- | ---: | ---: | ---: | ---: | ---: |
| `0e2c676` | 28,841 | 62 | 967 | 13,586 | 6,629 |
| `7375ff4` | 28,919 | 521 | 977 | 15,672 | 6,831 |
| `67cfd64` | 28,895 | 529 | 295 | 16,167 | 6,859 |

Counts include authored configuration/comments; simulator code is tooling in
both locations. The mixed history includes independent Start/M5/Control/CSS and
Lucide work. The original migration adds 547 production lines overall. The last
checkpoint is 151 lines below the original, driven by the separately authorized
CSS simplification; it is not an isolated UI TypeScript reduction. This review's
six production TypeScript files grow by 15 lines for concrete lifecycle/keyboard
fixes despite removing duplicate state and forwarding. A net TypeScript shrink
is therefore not claimed. Documentation counts precede this evidence appendix.

### Performance and remaining limits

[Comparable replay evidence](completion-performance.json) preserves actual build
identities separately from the runner checkout. Connections and Test retain all
renderer and streaming counters. Median/p95/p99 milliseconds change from
1.6/2.9/3.4 to 1.3/2.7/3.1 and 1.8/2.9/3.3 to 1.7/2.8/3.0 respectively.
Single sequential runs show no regression in these samples and prove no speedup.

The additional normal-show baseline attempt did not complete after more than
14 minutes and was terminated. Its report retains page/context errors at Echo,
Motion, Thermal and Return; the cause is unresolved. There is no valid paired
normal-show comparison. Windows-PCVR USB-C 90 Hz, headset, physical M5 and venue
acceptance remain open, as does the separately tracked #73 clock-progress issue.
