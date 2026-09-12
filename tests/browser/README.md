<!--
Purpose: Explain local production browser acceptance and its evidence.
Context: Unit tests do not exercise built pages, real controls, or WebGL startup.
Responsibility: Describe explicit station startup, scenarios, commands, and limits.
Boundary: Performance acceptance follows docs/development.md and docs/performance.md; no physical-device acceptance is implied.
-->

# Production Browser Checks

Use the existing station process to serve a current production build. Verify
`git branch --show-current` is exactly `david_refactor` before building or
writing artifacts. In one terminal:

```sh
bun run build
PORT=4180 bun run station
```

In another terminal, run the browser smoke against that exact server:

```sh
bun run test:browser --base-url http://localhost:4180 --out benchmark-results/issue-75/smoke-1
```

Repeat `--route` to check only affected surfaces and their startup/mount-failure
scenarios. Routes must match the existing smoke catalog; omitting the option
keeps the complete run. For shared UI changes:

```sh
bun run test:browser --base-url http://localhost:4180 --route / --route '/?level=echo' --route /conductor.html --route /flash.html --out benchmark-results/browser/ui-smoke
```

The browser is visible by default; `--headless` is an explicit functional-only
alternative. Each route gets a fresh context at 1280 × 720 and device scale 1.
Choose a new output directory per run; the final report refuses to overwrite
existing evidence. The runner does not start or stop a server.

For independent Vite development, start only `bun run dev`, then use its printed
URL with `bun run test:browser --dev --base-url http://localhost:5173`.
The explicit `--dev` flag skips only the Station `/health` and `/config` checks;
all browser scenarios and error checks remain active. It also supports Vite
preview. The report records this mode; production Station checks stay the default.

The smoke checks `/health` and `/config`, all three HTML entries, all ten level
paths from the level-name catalog, and query-selected standalone levels on the
root Experience document. Readiness means finished startup and a usable canvas,
rather than HTTP success alone. Rehearsal
and Conductor checks cover audio wake, play, pause, language selection, cue seek,
reset, and a second play. Flash checks readiness, removes legacy stored passwords,
and submits synthetic credentials through an isolated in-memory serial port.
Only SSID/device ID survive reload; the password reaches the simulated port but
never storage or the page log. No physical serial port or device is accessed.
The three UI pages and the root page's standalone-level layout are also checked
at 1280 and 390 CSS pixels, including Flash scrolling, timeline
drag/release/cancel, inline-style absence, transport contrast/size, drawer
focus/inert state, simulated accepted M5 preview geometry and
final/persisted Conductor pagehide. The simulated M5 never contacts hardware.
The report records whether Conductor required a wake gesture; an already
running audio context legitimately skips its hidden wake overlay.

URLs and startup do not independently prove scene composition. Visual review
remains necessary for intended geometry and presentation.

`smoke.json` records source identity, browser version, routes, observed renderer,
and failures. Unexpected browser errors, failed requests and context loss fail
the run. Each failed functional route retains a screenshot and Playwright trace:

```sh
bunx playwright show-trace benchmark-results/issue-75/smoke-1/0-trace.zip
```

Successful routes retain screenshots of the three pages and standalone-level
layout at desktop and narrow widths. Screenshot capture uses the original caret so Playwright does not
leave empty inline-style attributes on authored inputs. Three denied-WebGL
scenarios verify declared startup alerts/canvas ownership. Flash additionally
checks safe device responses, duplicate/late port selection and complete close.
Successful traces are discarded. Retain essential results in the issue evidence;
scratch output stays in ignored `benchmark-results/`. Delete obsolete scratch
runs after the relevant evidence has been preserved. Traces are functional
diagnostics and must not be enabled during timing measurements.

This suite does not prove headset tracking, physical M5 operation, audio quality,
GPU memory disposal, full-show stability, or target-device performance. Select
evidence for the affected criterion under the
[development guide](../../docs/development.md); user browser review is
optional and unavailable physical acceptance remains open. This command catalog
does not require running every scenario after every issue.

## Real-Speed Show Observation

```sh
bun run observe:show --mode transitions --language en --base-url http://localhost:4180 --out benchmark-results/issue-75/transitions-1
bun run observe:show --mode full --language en --base-url http://localhost:4180 --out benchmark-results/issue-75/full-show-en-1
bun run observe:show --mode full --language de --base-url http://localhost:4180 --out benchmark-results/issue-75/full-show-de-1
```

The observer starts directly with the main Show schedule. Transition mode creates
a fresh Run for each cue. This procedure does not establish a new full-show result.

Transitions use a fresh context per scheduled cue and compare first/repeated
sought crossings (two seconds before, ten seconds of real playback). They do
not reproduce the entire natural workload leading into that cue. Full mode
plays the actual 521-second schedule without seeking after its initial reset.
These runs keep production streaming, the audio clock, and ordinary browser
VSync. They do not enable deterministic replay, tracing, video, or DevTools.

The JSON report preserves bounded raw intervals, their median, p95, p99 and
maximum, plus show-clock progress, language-specific
audio responses, readiness, actual renderer and source/diff identity. Any
background visibility, capped/empty sampling, stopped clock, or unexpected
browser failure invalidates a run. Audio responses and clock movement do not
prove audible narration/organ output; that remains a human check. Desktop
VSync intervals cannot demonstrate the actual Windows-PCVR USB-C 90 Hz target,
including transport and headset; the observer omits missed-frame counts against
that unrelated display budget.

Keep the measured page foreground and run sequentially without other browser
scenes, builds, tests, or GPU-heavy work. Record power/display conditions and
uncontrolled background activity with the accepted evidence. Do not infer an
improvement or timing tolerance from a single run.

The Start smoke check verifies particle visibility and reload lifetime only.
It does not establish flight-control correctness or comfortable motion.

## Live language regression

This focused harness requires Vite's development source endpoints, rather than
the built Station or preview server. Start it separately:

```sh
bun run dev --host 127.0.0.1 --port 4180
```

Run all cases, or pass a base URL, output directory and trailing case names:

```sh
bun run test:language
bun run test:language http://127.0.0.1:4180 /tmp/language-check conductor
bun run test:language http://127.0.0.1:4180 /tmp/language-check audience course
```

| Case | Coverage |
| --- | --- |
| `conductor` | Selection before Play; live/paused EN/DE and `L`; rapid, same-language and reversed choices; delayed/failed media; pause during loading; reveal continuity; skip; main Show audio and unchanged clock; Stop; unload during replacement |
| `audience` | The same live Run capability on `/`, retained owners and complete media cleanup |
| `course` | Rig movement along the real course earns all four lessons; switches during successor/closing speech preserve progress and fades; natural handoff retains language and releases tutorial media |

The browser is headless Chromium at 1280 × 800 with autoplay enabled. Shipped
recordings use real native media; intercepted requests deliberately delay or fail
replacement loading. Test-only access observes existing owners and drives the
course rig; production exposes no additional commands. The harness disables
Vite HMR so source edits cannot reload an observed session.

The default output is `/tmp/becoming-many-language-report`. Each successful
invocation writes `browser-results.json`, or `browser-results-<cases>.json` for a
targeted run, plus numbered PNG screenshots. Existing output files can be
overwritten; choose a new directory to retain separate evidence. The script does
not generate the task's narrative report or resource comparison. Keep concise
results in the owning issue, with the relevant revision and local artifacts.

Assertions observe media source, native time, readiness and playback state;
screenshots show UI and rendering, not audible quality. The autoplay-enabled run
does not exercise permission denial; deterministic Sound tests cover blocked play
promises and gesture retry. Slow native seeks are likewise unit-tested. These
checks do not establish acoustic intelligibility, physical headset behavior or
the Windows-PCVR 90-Hz target. The broader tutorial timeline suite separately
checks `/start`, restart failure/retry and cancellation.
