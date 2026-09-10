# Start exercise architecture

## Scope and decisions

All implementation stays inside `src/modules/start/`. The existing World loop,
flight control, renderer, and application lifetime remain external owners.
`start.module.ts` is the sole integration center. Concrete leaves never import
or call each other; type-only imports of shared contracts are permitted.

One exercise definition is configuration. One attempt is a generated, stationary
route for that definition. A separate chunk engine is unnecessary for the MVP.

## Ownership

| File | Responsibility |
| --- | --- |
| `start.module.ts` | Construct leaves, pass observations and decisions, own their lifecycle. |
| `start-contract.ts` | Exercise definitions, poses, progress, and engine contracts. |
| `start-exercises.ts` | One literal list of exercises and shared presentation settings. No functions. |
| `start-game.runtime.ts` | Current exercise, attempt identity, phase, retry, and completion decisions. |
| `flight-path/flight-route.ts` | Generate and sample a route from geometric parameters and a seed. |
| `flight-path/flight-progress.ts` | Observe ordered passage along the route using actual rig movement. |
| `flight-path/flight-path.ts` | Own the visible particle trail, anchoring, fade, and resource disposal. |
| `flight-path/path-particles.ts` | Generate particle attributes and material variation for a supplied route. |
| `flight-path/particle-contract.ts` | Public particle ranges, sampled route, and material contracts. |
| `flight-guidance.ts` | Display the independent prediction of current flight. |
| `point-cloud/` | Own the ambient airborne particles. |

Only the center imports the concrete engine, route, progress, and presentation.
The engine never starts audio or creates geometry. Progress reports observations,
not lesson decisions. Route generation never creates particles. Presentation has
no instruction timer and cannot award success.

## MVP behavior

The configured sequence is left, then right. This is a visual steering demo,
not the final narration order. Each attempt uses reproducible variation in curve
radius and turn angle. Its world pose is captured when the instruction is released.
Visible routes never follow the player or the gaze.

The phases are instruction, flying, retiring, and complete. Ordered swept passage
through checkpoints along the route measures progress with a configured tolerance.
A movement budget between checkpoints detects misses; waiting or looking away is
not failure. Discontinuous movement cannot award passage.

A passed attempt advances to the next definition. A missed attempt repeats the
same definition with a new seed and a fresh reachable anchor. The old trail fades
before replacement. The MVP holds one trail, with bounded route and particle data;
there is no growing history or per-frame geometry regeneration.

For now a two-second demonstration cue stands in for narration. The engine accepts
instruction-release and instruction-end observations, so native audio observations
can replace that adapter later. A successful attempt cannot advance before the
instruction ends. No audio playback, Show handoff, altitude-policy change, or
new external integration is implemented here.

## Planned extensions

- Author the final exercise order, up/down routes, and verified audio markers in
  the same settings file. `start-audio-cues.ts` retains earlier narration research.
- Introduce real playback observations through the center; no independent audio
  timers inside route generation or presentation.
- Prepare an unseen successor and align its entry to the previous exit when a
  continuous course is needed. This is not required for the one-attempt MVP.
- Add a second retiring display slot only if continuous presentation needs it.

## Quality and verification

Keep settings at the top, comments organized by responsibility, and functions
small and focused. Tests cover success, retries, cue gating, movement discontinuity,
route variation, particle ranges, and cleanup. Browser checks cover the real Start
route plus controlled successful and missed flights. Browser screenshots do not
constitute headset acceptance.
