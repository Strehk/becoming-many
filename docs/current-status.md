# Current Development Status

Snapshot: 2026-09-03. The current checkout is the authority for all runtime
details.

## Product State

The core experience is largely implemented. The default browser page starts the
complete 8:41 show, layers the seven narrative world states, plays synchronized
English or German narration, returns to White World, and closes on the end
credits. The project is now in
a stabilization and refinement phase rather than an MVP construction phase.

Current priorities are measured performance, stability, code cleanup, and
issue fixes. Small product additions remain possible when they have a concrete
issue and a bounded implementation.

## Runnable Surfaces

- `/` starts the full show on load and mounts the rehearsal transport.
- `?language=de|en` selects narration for the full show.
- `/test.html?level=<name>` or `/<name>` opens one preset without the show.
  Known names are `white-world`, `scent`, `echo`, `motion`, `thermal`,
  `magnetic`, `connections`, `test`, and `design-test`.
- The Test page accepts `?benchmark[=<profile>]`, `?m5=<host>`, and
  `?diagnostics=1` for deterministic replay and explicit development tools.
- `/conductor.html` is the station/operator page and hosts the show in-process.
- `/flash.html` installs the bundled M5 firmware through Web Serial.

## Implemented Runtime

- One WebGL2 renderer and one `renderer.setAnimationLoop()` serve desktop and
  immersive WebXR.
- A viewer rig owns locomotion while the camera retains desktop-look or headset
  pose. Flight is clamped against the shared world surface and authored height
  limits.
- Typed `LevelPreset` files own their presentation and spread the sense layers
  of `sense-layers.ts`, which are built from the single-copy authored blocks in
  `src/levels/authored/`. The separate `ShowComposition` spreads every layer to
  preload the show world once, while `ShowLevelState` contains only live
  presentation changes.
- `level-runtime.ts` owns startup and frame coordination;
  `level-composition.ts` owns assets, World Surface creation, concrete module
  construction, and cross-module wiring. `show-runtime.ts` owns show following,
  and `flight-control-source.ts` owns desktop/M5 arbitration.
- Static presentation or the schedule's opening show state is applied before
  modules size their fixed spatial windows.
- Test UI metrics are supplied only by the Test and Conductor entries. The
  rehearsal show neither samples them nor loads Test UI, legacy Grass, or Zone
  Visualizer code.
- The show clock is the authority for narration, world-state selection,
  transitions, sense intensity, and end-credit presence.
- The End Credits module fades one canvas-textured plane in at 8:36 and holds it
  while the clock is clamped, until staff restart the experience.
- Fixed chunk windows and the bounded `StreamQueue` recycle module-owned
  resources as the viewer moves.
- GLTF assets are loaded once before the world starts; concrete modules retain
  ownership of their Three.js and GPU resources.

## Implemented World and Senses

- White World: atmosphere through background, fog, and Air Particles.
- Scent: deterministic plant and animal scent sources plus one bounded points
  system.
- Echolocation: terrain, vegetation, rocks, distance-based material effects,
  and the narrative grass clipmap.
- Motion: bounded fly and bird point actors with GPU-aged motion trails.
- Thermal: a viewer-centred false-colour material effect across terrain,
  vegetation, rocks, and animals, and one raptor soaring on a wide ring.
- Magnetic: one opaque camera-following sky dome; it does not patch terrain or
  other module materials.
- Connections: a worker-generated, fixed-pool mycelium network connected to
  deterministic and live world anchors.
- The `test` and `design-test` presets remain integration/diagnostic surfaces;
  they are not narrative states.

## Controls, Audio, and Station

- Desktop pointer-lock flight and WebXR flight use the same viewer rig.
- M5 state polling, smoothing, safety checks, auto-neutralization, and flight
  mapping are implemented. Host reset isolation and stricter device/liveness
  handling remain open issues.
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
  Freeverb rooms are unmeasured on the PICO.
- The conductor page provides transport, timeline, language, session reset,
  WebXR entry, M5 controls, status, and technician-only details.
- The Bun station server serves `dist/`, `/config`, and `/health`; it carries no
  show state. Docker packaging and a Windows kiosk launcher are present.

## Verification Snapshot

Verified on 2026-09-03 after the drone organ was moved onto the show clock:

- `bun test`: 447 passed, 0 failed across 62 files.
- `bun run check`: passed.
- `bun run lint`: passed.
- `bun run build`: passed with existing Vite warnings about one extensionless
  config import and a large output chunk.
- `bunx fallow`: found no dead files or exports. The remaining unused dependency
  override, duplication, complexity, and hotspot findings are tracked as
  cleanup issues; Fallow is not currently clean.

The deterministic benchmark has accepted renderer-counter baselines, but its
frame times are machine-specific. The grass clipmap and the complete current
show have not been accepted on a physical PICO 4. Wired Windows/SteamVR/PICO
startup also remains unverified.

## Remaining Work

The authoritative work list is the repository's open GitHub issues, summarized
in [roadmap.md](roadmap.md). The largest risks are:

- physical PICO performance and transition spikes, including the drone
  organ's unmeasured audio cost;
- PCVR startup and delivery-platform validation;
- diagnostics, lifecycle, M5, and shader-patch robustness;
- remaining module-ownership cleanup;
- measured removal or consolidation of redundant runtime paths.

After this entry-point change, the next dependency-aware engineering sequence
is #16, #35, then #11. The reasons and completion boundaries are recorded in
[roadmap.md](roadmap.md); detailed acceptance criteria remain in the issues.

README-only folders under `src/modules` and `src/utils` are reserved extension
boundaries. They are intentionally retained and do not claim an implementation.
