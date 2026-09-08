# Level Guide

Narrative levels are continuous world states inside one running composition,
not separately loaded scenes. The typed presets in `src/levels` are the source
of truth; this guide records intent and current behavior without duplicating
their tunable values.

## Narrative Sequence

| Level | Cue start | Adds |
| --- | ---: | --- |
| White World | 0:05 | prologue over background, fog, and Air Particles |
| Scent | 1:22 | plant/animal scent signatures and particles |
| Echolocation | 2:14 | terrain, vegetation, rocks, depth effect, Grass Clipmap |
| Motion | 2:47 | moving point actors and trails |
| Thermal | 3:50 | animals and local false-colour heat view |
| Magnetic | 4:39 | directional magnetic sky dome |
| Connections | 5:35 | pulsing mycelium network and underground reveal |
| White World return | 7:26 | removal of accumulated layers |

`PIECE_SCHEDULE` owns exact timing. The final show duration is 8:41.

## Layering Rule

The current presets spread shared sense layers; the show prepares their union
once and gates intensities, background and solid-world fade using the show clock.
Flight position remains continuous.

D3 replaces layer spreads and hidden override order with explicit independent
TypeScript levels, following `diagnostic.level.ts`. Missing module means absent; missing
optional setting uses its documented module default; invalid or missing required
settings fail during preparation. A reviewed direct construction plan must preserve
one prepared world per visit, compare effective settings and avoid a second show
configuration. Senses still accumulate; resources do not rebuild at every cue.

## Current Presets

- `white-world.level.ts` is sparse: white background, shared air, and no
  rendered surface.
- `scent.level.ts` keeps ground and vegetation as invisible source facts while
  rendering scent and air particles.
- `echo.level.ts` reveals solid landscape and introduces narrative clipmap
  grass.
- `motion.level.ts`, `thermal.level.ts`, `magnetic.level.ts`, and
  `connections.level.ts` layer their named perceptions in order.
- `diagnostic.level.ts` is the diagnostic landscape with Zone Visualizer, Grass
  Clipmap, magnetic sky, and diagnostics UI.
- `visual-integration.level.ts` is the visual integration preset without Zone
  Visualizer.

The full catalog and URL names are in `src/levels/level-catalog.ts`.

## Detailed Narrative Notes

- [02 — Scent World](02-scent-world/README.md)
- [03 — Echolocation](03-echolocation/README.md)
- [04 — Motion Perception](04-motion-perception/README.md)
- [05 — Thermal Perception](05-thermal-perception/README.md)
- [06 — Magnetic Field Perception](06-magnetic-field-perception/README.md)
- [07 — Connections](07-connections/README.md)

White World and diagnostic presets are sufficiently described here and in
their source files.

## Performance and Art Direction

All levels share the project performance gate in
[performance.md](../performance.md). Benchmark counters describe what is drawn;
actual Windows-PCVR USB-C measurements decide 90-Hz acceptance. Visual references under
`docs/moodboards` remain direction, while colors and tunables actually used by
the application live in typed level and module settings.
