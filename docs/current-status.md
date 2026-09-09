# Current Development Status

As-built snapshot: 2026-09-09, required flight tutorial implementation on
`david_refactor`; local software verification is complete, with content and
physical acceptance still open. The earlier UI/Entry
and M5 consolidation passed its local checks and browser acceptance; see
[UI evidence](evidence/ui-consolidation/README.md). The previous
#36/#84/#11 and audio-wake results remain dated evidence for their tested code.
Start now generates its four-goal course from distance, displacement and radius
ranges instead of authored coordinates. Restart samples a fresh course. Missed or spatially abandoned sections fade and
recycle ahead of the current flight pose without increasing the success count.
Placed targets and sound anchors remain fixed during each attempt.
Dated measurement packets retain the earlier exact identities they tested;
the current checkout is the authority for runtime details.
The combined tutorial change passes `bun test` (572 tests), `bun run build` and
`bun run lint`. The final targeted lifetime/control/audio/geometry checks are
included in that suite. The production browser passes 7/7 combined scenarios
(Root, Conductor, Start and startup/mount failures) plus 4/4 shared-UI scenarios
(Echo and Flash, including their failures). Root and Conductor each traverse all
four rings through the real M5 adapter with simulated firmware responses, use the
explicit handoff and retain main playback/language/seek/scrubbing checks. Conductor
Stop recreates held orientation using the same renderer. Desktop and narrow
layouts, focus, scrolling and page-end behavior pass. These are functional checks,
not real hardware or fresh-visitor calibration evidence. Subsequent visual review
widened only Start's desktop vertical view to 80 degrees, keeping its level ring
inside the existing 30-degree assisted view. A headed standalone screenshot and
regression test verify the visible ring and restoration of the original main
projection; XR keeps the headset projection. The optional audio follower also
stops silent grains while a dissolved goal waits for speech.


The final review of forward recycling and installed German voice identified
#93's unchanged native narration writes. The existing player now performs zero
repeated time/rate writes in ten-second Hold checks and retains one pending or
rejected play attempt until new intent. Eleven focused tests, build, lint and a
complete narrated root course plus exact main scrub/language/resume checks pass.
Raw media-preload cancellations remain recorded, with no causal attribution or
claim of every native clip reaching `ended`. The
[final review evidence](evidence/issue-50/README.md#final-independent-review-and-narration-hold-correction--2026-09-09)
records the independent result and source identity; physical acceptance and EN
voice policy stay open.

The subsequent independent performance review found missing GPU preparation
when Stop recreated training. World/Run now await repeatable offscreen preparation,
including silent training and cancellation; main narration also preloads during
training and remains in the same media owner at handoff. The correction passes
10 focused tests, build, lint and a fresh 3/3 root browser smoke (course, main
transport/language and startup/mount failures). Fallow was rerun with the same
10 introduced complexity and four CSS findings, zero dead-code/boundary issues.
Two full Conductor courses with handoff/reset per build and one 1920 × 1080 root
course complete without browser errors. The [screenshot/review packet](evidence/issue-50/README.md)
and [performance measurements](performance.md#independent-review-and-complete-course-measurement)
retain exact build identities and the intentionally held reset interval.

The local reports are `benchmark-results/issue-50/combined-smoke-1/smoke.json`
(source digest `da9bc9f33504ece467cda64a1dfff96fa30a9778b2ae667be43a3d9463134fb6`)
and `benchmark-results/issue-50/shared-ui-smoke-1/smoke.json`
(source digest `be362fd71f5171ddcc648b92f5ce3b51b57a5eb0cc2c7939ceadf2848d2d2a83`).
The original M5 browser attempt omitted the glide already occurring during its
five-second wait; the corrected fixture estimates travel from Play. Separately,
Run no longer applies the prepared main terrain's invisible lower bound during
Start; the normal main-world ground rule resumes after handoff. Native automated
pointer lock still fails with `WrongDocumentError` under #83; M5 success does not
close that desktop gap. `observe:show` now waits for a manual tutorial/handoff
before measuring the main show; no new 521-second observation is claimed.

Fallow 3.23.0 audit reports zero dead-code and boundary violations, but its overall
verdict remains fail: 10 introduced complexity findings and four introduced CSS
selector warnings (including modified surrounding selectors). The explicit
lifecycle/phase branches and scoped existing styling are retained without
suppressions or baseline changes. This feature adds behavior and code; it is not a
code-reduction result. Local rendering/audio measurements and their limits are
recorded in [Performance](performance.md#flight-tutorial--2026-09-08).

The latest cloud presentation is implemented and locally tested. Its measured
GPU p95 increase from 0.251 to 0.308 ms was explicitly accepted by the user
on 2026-09-09 together with the higher particle density. Physical PCVR acceptance remains open.
The following correction implements forward recycling after misses, distinct
passage feedback and the five original German instructions. Forty-five focused
tests, build/typecheck and lint pass. Root and two Conductor courses complete with
voice/handoff; standalone DE query, pause, language repeat and reload are checked.
Media preload cancellations are retained in raw diagnostics rather than hidden;
see the [current evidence and limits](evidence/issue-50/README.md#forward-recycling-and-original-voice--2026-09-09).

## Product State

The core experience is largely implemented. The default browser page prepares
the required flight tutorial and waits for Play. After four spatial goals and
the operator handoff, the existing 8:41 show layers the seven narrative world states, plays synchronized
English or German narration, returns to White World, and closes on the end
credits. The project is now in
a stabilization and refinement phase rather than an MVP construction phase.

Current priorities are measured performance, stability, code cleanup, and
issue fixes. The approved target is Windows-PCVR over USB-C with stable 90 Hz
on the actual installation. Tutorial and credits are required; remaining content
and operation decisions are tracked in the roadmap. Complete visitor teardown
is implemented at existing owners; the concrete next-visitor restart remains open.
Explicit, self-contained literal levels are implemented. Conductor is UI-only;
Entry wires one Run, and UI/console use direct Show commands with its clock internal.
The current Run time/flight reset remains distinct from full visitor replacement.
All three HTML documents now live under `src/ui/` and link `app.css`; page/panel
TypeScript binds declared markup. Entry lives under `src/entry/`, frame metrics
under `src/diagnostics/`, and deployment/route contracts under `shared/`.
Conductor and Rehearsal share scrubbing and time formatting. World borrows the
page canvas/viewport and owns WebGL/resize cleanup. Timelines/M5 retain SVG
geometry and the closed technician drawer is inert. Updated import/type and
markup rules pass the combined verification. Native and organ audio can be woken again after
a later suspension; this does not explain the original #73 measurement.
The #80 animal-connection removal is implemented below. Small additions remain issue-backed.

## Runnable Surfaces

- `/` prepares tutorial and full show, initially held, and mounts the rehearsal
  transport. Main-show seeking becomes available after the tutorial handoff.
- `?language=de|en` selects narration for the full show and standalone Start.
  German Start voice is shipped; English tutorial voice remains a pending choice.
- `/?level=<name>` or `/<name>` opens one preset without the show.
  Known names are `start`, `white-world`, `scent`, `echo`, `motion`, `thermal`,
  `magnetic`, `connections`, `diagnostic`, and `visual-integration`.
- The Experience page's standalone mode accepts `?benchmark[=<profile>]`,
  `?m5=<host>`, and `?diagnostics=1` for deterministic replay and explicit
  development tools. Its one diagnostics overlay reads the existing renderer,
  retains the first fatal error, and releases its hooks on exit. All three
  application entries show startup failures.
- `/start` and `/?level=start` provide the same spatial flight tutorial with
  desktop or M5/XR locomotion and shared Play/Pause/language controls. Standalone
  practice has no main-show handoff or chapters. It does not implement fresh
  visitor calibration or replacement.
- `/conductor.html` is the station/operator page and hosts the show in-process.
- `/flash.html` installs the bundled M5 firmware and configures the controller
  through Web Serial. Entry owns connection lifetime; UI owns form/status.
  Only the device response confirms applied configuration; passwords are never
  persisted or included in the setup log.

## Implemented Runtime

- One WebGL2 renderer and one `renderer.setAnimationLoop()` serve desktop and
  immersive WebXR.
- A viewer rig owns locomotion while the camera retains desktop-look or headset
  pose. Flight is clamped against the shared world surface and authored height
  limits.
- Typed `LevelPreset` files contain their module settings as local literals,
  without imported parameter blocks or executable helpers. The Show constructs the Connections preset once; `ShowLevelState`
  retains live presentation. Layer spreads and the separate Show recipe are gone.
- `level.runtime.ts` owns startup, frame coordination, source assets and awaited
  termination; `level-composition.ts` loads assets and owns World Surface creation, concrete module
  construction, and cross-module wiring. `show.runtime.ts` owns show following,
  while Runtime selects desktop/M5 input directly in its local frame. World
  owns the stopped renderer, GPU preparation and subsequent loop start.
- Static presentation or the schedule's opening show state is applied before
  modules size their fixed spatial windows.
- Standalone-level and Conductor entries own their DOM-free metrics; the
  standalone-level entry owns the diagnostics overlay lifetime. The rehearsal
  show neither samples those metrics nor loads diagnostics UI or Zone Visualizer.
- Grass Clipmap is the sole Grass renderer, including Diagnostic and Visual Integration;
  legacy Grass and its diagnostic construction path have been removed (#13).
- The show clock is the authority for narration, world-state selection,
  transitions, sense intensity, and end-credit presence.
- The End Credits module fades one canvas-textured plane in at 8:36 and holds it
  while the clock is clamped, until staff restart the experience.
- Fixed chunk windows and the bounded `StreamQueue` recycle module-owned
  resources as the viewer moves.
- Run releases loaded GLTF sources after all borrowers end, including skeletons
  and ImageBitmaps. Modules release their own derivatives. Late loads, XR adoption
  and Tone imports are awaited on cancellation. Show closes its native timebase;
  Run ends all sound borrowers before closing the shared Tone-created context.
- Complete Run end is available to entries. Conductor Stop immediately resets
  time/position and pauses; a complete visitor-replacement sequence remains open.

## Implemented World and Senses

- White World: atmosphere through background, fog, and Air Particles.
- Start: four world-space ring goals (right, left, up, down), without a deadline.
  Consecutive shared world poses detect actual passage, including movement
  between frames. Missed goals remain active with directional guidance. One
  optional 32,000-point draw forms thick ring bodies, a filled 7.2 m arrow and
  three decorative curve guides. Fine points and bounded soft haze replace the
  former contours; the current ring has local silver, expansion and trajectory
  wake. Independent Air uses 48 points per 16 m cell with a fading 16 m near field;
  main-level defaults are preserved. Horizontal targets share the arrival height, later targets are 60 m
  apart. Following the user's world-space correction, cloud, ring and arrow
  share a fixed goal anchor. The arrow stays beside its ring; player translation
  and rotation never reposition or reorient these particles. Autonomous drift,
  formation and wake remain. The former heading-following guide is removed.
  The held-M5-gesture rules and opaque arrow are removed.
- Show owns training transport/current instruction and waits for every passage
  and the final configured recording before exposing operator handoff. Pause
  holds flight, seek/rate changes are blocked and language changes repeat the
  current instruction. Presentation waits for a playing instruction to finish
  before the next goal, preserving the introduction after an early crossing;
  learning progress still requires spatial passage. One existing clock supports the interactive phase and
  rebases to the main schedule; public main-show time stays zero during training.
  Run retires training resources and registrations without rebuilding the main
  world. Interim Stop restores orientation/time and hold; only retired training
  content is recreated, without claiming a fresh visitor lifetime. Playback stays
  held until any configured sample is ready; failure is visible and retryable.
- Scent: deterministic plant and animal scent sources plus one bounded points
  system. Reassigned plant slots stay hidden until bounded queued work completes;
  queue rejection no longer triggers a synchronous fill.
- Echolocation: terrain, vegetation, rocks, distance-based material effects,
  and the narrative grass clipmap.
- Motion: bounded fly and bird point actors with GPU-aged motion trails.
- Thermal: a viewer-centred false-colour material effect across terrain,
  vegetation, rocks, and animals. Actor surfaces skip incoming body-heat work
  because their existing response is zero.
- Magnetic: one opaque camera-following sky dome; it does not patch terrain or
  other module materials.
- Connections: a worker-generated, fixed-pool mycelium network connected to
  four fixed anchor classes: vegetation (including bushes), rocks, forest-clearing
  points and soil. The unauthored moving-animal link path is removed under #80;
  animal animation and Scent/Thermal body observations remain.
- Animal passages: three animals cross the show on routes carried over from the
  predecessor project — the bat, the mosquito swarm, and the bird — each
  entering six seconds before the cue that opens the sense it announces, and
  gone once that sense has faded in. Their pose is derived from show time, so a
  scrub lands them on their route. They are ungated and wear no sense effects,
  because a crossing happens between senses. The swarm has no body: what
  crosses is the trail it prints, through its own ring composed beside Motion
  Sense at full strength, since the sense it announces still stands at zero.
- The `diagnostic` and `visual-integration` presets remain integration/diagnostic surfaces;
  they are not narrative states.

## Controls, Audio, and Station

- Desktop pointer-lock flight and WebXR flight use the same viewer rig.
- M5 host lifetimes are isolated. Steering requires a configured matching ID,
  compatible firmware, calibration and fresh advancing samples. Rejection
  neutralizes input and names its reason; physical acceptance remains open.
- Narration uses typed schedules and one audio timebase. Browser audio suspension
  stops show time until a gesture wakes the context.
- The drone organ in `sound/drone-organ/` plays under the show: nine Tone.js
  voices brought in by the score in `dramaturgy/organ-score.ts`, which lists
  the voices each world state carries and fades each one on the sense ramp.
  The organ has no transport: its rhythmic voices step on grids of show
  seconds and every note is hashed from its step, so pause, seek, and
  rehearsal speed reach it. Two wing-beat voices are placed on the nearest
  bird flock and fly swarm through `Panner3D`, and two voices follow flight
  height and the compass. How the voices sound is `drone-organ-settings.ts`.
- Run owns the Tone-created `AudioContext` shared by organ and training audio;
  Show's native timebase stays separate. A single Three.js listener retains the
  existing three-frame update interval, skips unchanged poses and writes nine
  native pose parameters per changed update. Organ owns only its nodes. Tone
  loads dynamically; benchmarks and ordinary standalone levels build no audio
  graph. Standalone Start acquires Tone only when `startAudio` is configured;
  the current recipe enables three object-bound granular layers, a goal voice
  and one shared eight-second hall. Historical
  organ cost was measured on desktop Chromium only (about
  0.1 ms median per update with all layers open); the four `AudioWorklet`
  Freeverb rooms are unmeasured on the target Windows-PCVR installation.
- Live tutorial gain/filter and shared source/listener parameters retire past
  automation while holding their rendered value. This removes the measured
  growing-history cost in Tone 14's bundled wrappers: the full audio-enabled
  tutorial CPU p95 falls from 2.4 to 0.5 ms on the recorded Mac browser workload.
  See [the comparison and limits](performance.md#bounded-live-audioparam-histories).
- Five original DE tutorial recordings are now shipped unchanged with source
  hashes and authored durations in `startNarration.de`, following the user
  instruction to install the voice. The EN policy and physical listening remain
  open. Eleven user-supplied generated instrumentals are now preserved in
  `public/audio/granular/` with provenance and full-decode/level checks. The
  [granular atmosphere step](roadmap.md#granular-atmosphere--112) implements three
  spatial layers, a distinct goal cue and one shared hall, replacing the ordinary
  bed at the existing training owner. Three twelve-second mono excerpts load;
  original full tracks do not. Ring/arrow body anchors come from Start, and
  listener distance controls level, filtering and room balance. Pause silences
  the hall too, speech ducks the mix, and Run owns readiness/cleanup. Source
  selection and mix are initial technical choices without audition. These content decisions, human
  listening/comprehension and Windows-PCVR spatial-audio/90 Hz acceptance remain
  open; no successful local test substitutes for them.
- The conductor page provides Play/Pause, immediate Stop, language, an embedded
  preview and the timeline as its sole time display. Module status is always
  visible. Available XR starts on normal operator interaction; explicit XR and
  M5 controls remain in technician tools.
- The Bun station server serves `dist/`, `/config`, and `/health`; it carries no
  show state. Docker packaging and a Windows kiosk launcher are present.

## Refactor Changes in the Current Checkout

- `TerrainMaterialEffect` is shared by Terrain, Mycelium and Composition from
  the existing material-effect contract file; concrete sibling imports are gone.
- The organ dispatches no steps when Tone time is unavailable. Tracks retain
  callback-dispatch timestamps across suspension/seek to avoid scheduling into
  previously dispatched time ranges. A callback may be silent; this is not
  an audible-note history. Show and Tone retain their separate contexts.
- Mycelium keeps rejected gather jobs only until the existing queue admits them,
  bounded by its gather window. Reassignment clears stale GPU rows, and jobs/
  replies validate the owning stream as well as the slot revision.
- Browser smoke and ordinary-show observation reuse Bun/Playwright/Station;
  unexpected benchmark browser failures now fail the run. Shared frame-summary
  mechanics remain in the existing benchmark owner.

See [architecture](architecture.md) for ownership, [performance](performance.md)
for measurement interpretation and [issue evidence](evidence/README.md) for dated
verification. The [roadmap](roadmap.md) alone records current readiness, review
accounting, decisions and the next issue. README-only extension boundaries remain
reserved and do not claim implemented functionality.
