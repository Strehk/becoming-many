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
| `flight-path/flight-connection.ts` | Compute a position- and tangent-continuous successor pose. |
| `flight-path/flight-deviation.ts` | Observe sustained movement outside the route corridor. |
| `flight-path/flight-recovery.ts` | Compute a fresh visible entry from current view and flight facts. |
| `flight-path/particle-generation.ts` | Own bounded incremental particle work and cancellation. |
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

## Continuous sections

Each route has a straight entry (`straightMeters`), a curved exercise, and a
straight tangent exit (`outroMeters`). The current default is a 10 m entry and
24 m exit. Ordered passage to `exerciseEndMeters` earns success; the player then
continues through the exit while the successor is prepared. The visible route
never moves after placement.

`flight-connection.ts` computes only the successor pose. Its first point and
heading match the previous last point and heading, including local entry offsets.
`particle-generation.ts` generates four meters per StreamQueue step using an
injected particle factory. The center enqueues work on the existing World queue,
retries queue admission if full, and invalidates obsolete jobs on reset/unload.
Finished successors fade in during the exit area; no new instruction pause or
placement in front of the player interrupts a regular connection.

The center owns three reusable displays: current, successor, and retiring tail.
Each display owns its geometry and material. Retired buffers are replaced on reuse
or released on unload. One unfinished generation may coexist with these displays;
there is no accumulating world history or independent render loop.

## Deviation and recovery

`flight-deviation.ts` observes distance to a sampled route corridor and distance
actually flown outside it. The defaults allow 5 m separation and 3 m sustained
outside travel. The approach to a fresh entry is included in the corridor.
Looking away or standing still never triggers recovery. Ordered progression also
rejects shortcuts and cannot credit a reset displacement.

`flight-recovery.ts` calculates only a new pose. At reveal time it captures the
latest rig position and gaze to put the new entry in view, currently 12 m ahead,
while retaining horizontal flight heading. Existing height constraints are applied
to the owned candidate position. It never changes the player position.

On recovery, the center fades existing displays, cancels pending generation, and
prepares a new attempt. An unearned exercise repeats. A completed exercise remains
earned even if the player leaves its exit; recovery then offers the next exercise.

## Engine and temporary audio adapter

The engine has instruction, flying, outro, and recovering phases. It returns show,
prepare-next, advance, or recover decisions. Its inputs include instruction release,
natural instruction end, geometry readiness, movement progress, and deviation.
The center alone executes these decisions and connects the independent leaves.

The current demo repeats the left/right sequence continuously. A two-second cue
adapter releases initial and recovery entries; regular connections have no pause.
There is no real audio playback or Show handoff yet. Final narration order and
verified audio markers belong in `start-exercises.ts`; `start-audio-cues.ts` retains
earlier research. Up/down exercises and application handoff remain separate work.

## Quality and verification

Keep settings at the top, comments organized by responsibility, and functions
small and focused. Tests cover success, retries, cue gating, movement discontinuity,
route variation, particle ranges, and cleanup. Browser checks cover the real Start
route plus controlled successful and missed flights. Browser screenshots do not
constitute headset acceptance.
