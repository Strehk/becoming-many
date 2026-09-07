# Current Development Status

As-built snapshot: 2026-09-07, the #36 Entry/UI/Engine separation after checkpoint `281e7df` on `david_refactor`.
Dated measurement packets retain the earlier exact identities they tested;
the current checkout is the authority for runtime details.

## Product State

The core experience is largely implemented. The default browser page starts the
complete 8:41 show, layers the seven narrative world states, plays synchronized
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
The #80 animal-connection removal is implemented below. Small additions remain issue-backed.

## Runnable Surfaces

- `/` starts the full show on load and mounts the rehearsal transport.
- `?language=de|en` selects narration for the full show.
- `/test.html?level=<name>` or `/<name>` opens one preset without the show.
  Known names are `white-world`, `scent`, `echo`, `motion`, `thermal`,
  `magnetic`, `connections`, `test`, and `design-test`.
- The Test page accepts `?benchmark[=<profile>]`, `?m5=<host>`, and
  `?diagnostics=1` for deterministic replay and explicit development tools.
  Diagnostics reads the existing renderer, retains the first fatal error, and
  releases its hooks on exit. All three application entries show startup failures.
- `/conductor.html` is the station/operator page and hosts the show in-process.
- `/flash.html` installs the bundled M5 firmware through Web Serial.

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
- Test and Conductor own their metrics; Test owns its overlay lifetime. The
  rehearsal show neither samples those metrics nor loads Test UI or Zone Visualizer.
- Grass Clipmap is the sole Grass renderer, including Test and Design Test;
  legacy Grass and its diagnostic construction path have been removed (#13).
- The show clock is the authority for narration, world-state selection,
  transitions, sense intensity, and end-credit presence.
- The End Credits module fades one canvas-textured plane in at 8:36 and holds it
  while the clock is clamped, until staff restart the experience.
- Fixed chunk windows and the bounded `StreamQueue` recycle module-owned
  resources as the viewer moves.
- Run releases loaded GLTF sources after all borrowers end, including skeletons
  and ImageBitmaps. Modules release their own derivatives. Late loads, XR adoption
  and Tone imports are awaited on cancellation; both audio owners close separately.
- Complete Run end is available to entries. The existing New visitor command
  still resets time/position; its replacement operating sequence remains open.

## Implemented World and Senses

- White World: atmosphere through background, fog, and Air Particles.
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
- The `test` and `design-test` presets remain integration/diagnostic surfaces;
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
- The organ plays on Tone's own `AudioContext`, not the show timebase's, and
  Tone.js loads through a dynamic import so benchmarks and bare level pages
  build no audio graph. Its cost is measured on desktop Chromium only (about
  0.1 ms median per update with all layers open); the four `AudioWorklet`
  Freeverb rooms are unmeasured on the target Windows-PCVR installation.
- The conductor page provides transport, timeline, language, session reset,
  WebXR entry, M5 controls, status, and technician-only details.
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
