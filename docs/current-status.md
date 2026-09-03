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
- `?level=<name>` or `/<name>` opens one preset without the show. Known names
  are `white-world`, `scent`, `echo`, `motion`, `thermal`, `magnetic`,
  `connections`, `test`, and `design-test`.
- `?benchmark[=<profile>]` runs the authored deterministic camera route.
- `?language=de|en` selects narration for the full show.
- `?m5=<host>` connects an M5 controller directly for development.
- `?diagnostics=1` exposes browser and shader failures on the page.
- `/conductor.html` is the station/operator page and hosts the show in-process.
- `/flash.html` installs the bundled M5 firmware through Web Serial.

## Implemented Runtime

- One WebGL2 renderer and one `renderer.setAnimationLoop()` serve desktop and
  immersive WebXR.
- A viewer rig owns locomotion while the camera retains desktop-look or headset
  pose. Flight is clamped against the shared world surface and authored height
  limits.
- `level-runtime.ts` composes sparse typed presets, shared resources, controls,
  narration, and enabled modules.
- The show clock is the authority for narration, world-state selection,
  transitions, sense intensity, and end-credit presence.
- The End Credits module fades one canvas-textured plane in at 8:36 and holds it
  while the clock is clamped, until staff restart the experience.
- Fixed chunk windows and the bounded `StreamQueue` recycle module-owned
  resources as the viewer moves.
- A module a sense reveals is warmed 20 seconds before its cue: it runs,
  streams, and follows the viewer while nothing of it is drawn, so a world
  state fades in already built instead of assembling itself under the fade.
  Verified on desktop Chromium only.
- The two opaque point layers — scent particles and fly swarms — spread the
  sense fade across their own particles, so a field arrives speck by speck
  rather than crossing the one-pixel rasterization threshold together.
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
  vegetation, rocks, and animals.
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
- The conductor page provides transport, timeline, language, session reset,
  WebXR entry, M5 controls, status, and technician-only details.
- The Bun station server serves `dist/`, `/config`, and `/health`; it carries no
  show state. Docker packaging and a Windows kiosk launcher are present.

## Verification Snapshot

Verified on 2026-09-03 for this documentation branch:

- `bun test`: 371 passed, 0 failed across 50 files.
- `bun run check`: passed.
- `bun run lint`: passed.
- `bun run build`: passed with existing Vite warnings about one extensionless
  config import and a large output chunk.
- `bunx fallow`: completed with known findings: one unused export, one unused
  dependency override, nine clone groups, seventeen complexity findings, and
  two hotspots. These findings are tracked as cleanup issues; Fallow is not
  currently clean.

The deterministic benchmark has accepted renderer-counter baselines, but its
frame times are machine-specific. The grass clipmap and the complete current
show have not been accepted on a physical PICO 4. Wired Windows/SteamVR/PICO
startup also remains unverified.

## Remaining Work

The authoritative work list is the repository's open GitHub issues, summarized
in [roadmap.md](roadmap.md). The largest risks are:

- physical PICO performance and transition spikes;
- PCVR startup and delivery-platform validation;
- diagnostics, lifecycle, M5, and shader-patch robustness;
- composition-root and entry-point cleanup;
- measured removal or consolidation of redundant runtime paths.

README-only folders under `src/modules` and `src/utils` are reserved extension
boundaries. They are intentionally retained and do not claim an implementation.
