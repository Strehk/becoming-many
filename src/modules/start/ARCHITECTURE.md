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
| `flight-path/flight-course.ts` | Own the bounded course tail; every appended section connects to that tail. |
| `flight-path/flight-connection.ts` | Compute a position- and tangent-continuous successor pose. |
| `flight-path/flight-deviation.ts` | Observe sustained movement outside the route corridor. |
| `flight-path/flight-recovery.ts` | Compute a fresh approach from actual position and flight direction. |
| `flight-path/particle-generation.ts` | Own bounded incremental particle work and cancellation. |
| `flight-path/flight-progress.ts` | Observe ordered passage along the route using actual rig movement. |
| `flight-path/flight-path.ts` | Own the visible particle trail, anchoring, fade, and resource disposal. |
| `flight-path/path-particles.ts` | Generate particle attributes and material variation for a supplied route. |
| `flight-path/particle-contract.ts` | Public particle ranges, sampled route, and material contracts. |
| `particle-elements/ring-shape.ts` | Sample only the local ring shape, with an empty center. |
| `particle-elements/arrow-shape.ts` | Sample only a filled arrow silhouette, including shaft and head. |
| `particle-elements/element-placement.ts` | Derive ring centers and exterior arrow placements from the sampled route. |
| `particle-elements/particle-grain.frag.glsl` | Shade each small dust grain with a soft edge and restrained relief. |
| `particle-elements/particle-volume.ts` | Add spatial core/halo distribution and per-particle opacity to either shape. |
| `particle-elements/particle-animation.ts` | Shape-independent emergence and dissolution envelope. |
| `particle-elements/particle-simulation.ts` | Movement-only flight impulse and damped return to resting positions. |
| `particle-elements/particle-elements.ts` | Own combined particle buffers, rendering and display lifetime. |
| `particle-elements/particle-contract.ts` | Placement, animation, simulation and geometry-factory contracts. |
| `flight-guidance.ts` | Optional prediction of current flight; disabled through `START_SETTINGS.showFlightGuidance`. |
| `point-cloud/` | Own the ambient airborne particles. |

Only the center imports the concrete engine, route, progress, and presentation.
The engine never starts audio or creates geometry. Progress reports observations,
not lesson decisions. Route generation never creates particles. Presentation has
no instruction timer and cannot award success.

## Continuous sections

Continuity is a construction invariant. `flight-course.ts` owns the current
course tail. `begin` establishes its only root; `append` derives the next pose
from that tail through the injected connection function, then advances the tail.
No exercise supplies its own world placement. The returned section is shared by
path generation, ring placement and progression. Storage contains only the tail,
not an accumulating history. Clearing the course invalidates its old root.

Each route has a straight entry (`straightMeters`), a curved exercise, and a
straight tangent exit (`outroMeters`). The current default is a 12 m entry and
24 m exit. Ordered passage to `exerciseEndMeters` earns success; the player then
continues through the exit while the successor is prepared. The visible route
never moves after placement.

`flight-connection.ts` computes only the successor pose. Its first point and
heading match the previous last point and heading, including local entry offsets.
`particle-generation.ts` generates four meters per StreamQueue step using an
injected particle factory. The center enqueues work on the existing World queue,
retries queue admission if full, and invalidates obsolete jobs on reset/unload.
Finished successor lines appear during the exit area at full configured transparency; no new instruction pause or
placement in front of the player interrupts a regular connection.

Geometry follows one course; fixed rendering pools are only its presentation.
The center owns four path displays and four element displays.
A retained front ring cannot occupy a path slot. Completed paths remain visible
until their endpoint is at least 12 m behind actual flight direction, then fade.
Each display owns its geometry and material. Retired buffers are replaced on reuse
or released on unload. One unfinished generation may coexist with these displays;
there is no accumulating world history or independent render loop.

`flight-entry.ts` supplies a 20 m ring-free bootstrap approach. At activation it
starts at the player with 4 m of additional trail behind. Its initial tangent
follows travel pitch and gently levels before the first exercise. The first ring
is another 12 m into that exercise chunk. Progress starts immediately, independently
of streaming completion. The same approach sampler is reused for recovery.

Rings occupy only `[exerciseStartMeters, exerciseEndMeters]`. A chunk's 24 m exit
and its successor's 12 m entry therefore form a ring-free connection. Rendering
and progression sample the same fixed route; joining never depends on the
player's position at the moment of transition.

## Deviation and recovery

`flight-deviation.ts` observes distance to a sampled route corridor and distance
actually flown outside it. The defaults allow 12 m separation. Recovery requires another 8 m of sustained
outside travel, a heading difference of at least 0.87 radians from the forward
route target, and the exercise ring area outside the camera view. A conservative
6 m padding protects visible ring edges. Parallel offsets, returning toward the
route, gaze alone and reset displacements do not trigger a course replacement. The approach to a fresh entry is included in the corridor.
Looking away or standing still never triggers recovery. Ordered progression also
uses ordered forward checkpoint-plane crossings with lateral corridor tolerance.
The final plane must be crossed: wider tolerance cannot finish a chunk early.
A missed checkpoint never independently requests recovery.

`flight-recovery.ts` calculates only a new pose. At reveal time it captures the
latest rig position and actual travel direction to place an approach 6 m ahead.
The approach is fixed in world space; turning the head does not drag it along. Existing height constraints are applied
to the owned candidate position. It never changes the player position.

Recovery replaces the entire abandoned course: its line and rings fade out
together over 2.5 seconds, including rings ahead. This is the explicit exception to behind-only
retirement during normal flight. The new course begins with a particle-only
approach; new rings cannot coexist with an abandoned course's rings. An unearned
exercise repeats; a completed exercise remains earned when leaving its exit.

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

## Procedural rings and arrows

`particle-elements/` is independent of `flight-path/` implementations. Shape files
only sample local coordinates, with +X as their shared forward axis. The center
injects the existing particle geometry/material factories, preserving the same
size, color, scatter and ambient wind as the route's point-cloud style.

Each exercise's `elements` settings specify first distance, interval, ring radius,
arrow length, exterior offset and phase along the interval. Placement samples the generated route: rings
are centered on its visible line and their planes are perpendicular to travel.
Arrows appear between ring stations during the curved exercise, point along its tangent, and are offset
opposite the tangent change projected onto the travel-normal plane. No camera-facing rotation changes their meaning.
The current horizontal course is supported; generalized banked/vertical courses
would need an explicit frame/up-vector contract. Placement is deterministic for
the same route and parameters and capped at twelve ring/arrow pairs per section.

Rings and arrows use black particles. The arrow sampler fills its shaft and head
with interior rows. `particle-volume.ts` expands both shape samplers into real
three-dimensional resting positions: a dense core and a broader sparse halo.
The halo uses lower per-particle opacity while the pigment stays black. Shared
`elementVolume` settings control thickness and softness independently of animation
and physical displacement. Core particles are larger than halo dust and use a
subtle camera-space spherical shading cue; the base pigment remains black.
Each moving sample carries twelve independently positioned GPU grains, with stable
per-sample seeds, varied sizes and occasional larger accents. The renderer draws
twelve instanced layers of the same bounded sample buffers. Wind and emergence
update the sample centers once; all grains follow without per-grain CPU work.
This is a spatial point-sprite approximation, not scene lighting or geometric spheres.
Volume treatment adds no draw call or frame-time
particle allocations.

The shared `elementAnimation`, `elementSimulation`, and `elementParticles`
settings are in `start-exercises.ts`. Emergence gathers scattered particles into
their resting shape while increasing opacity. Dissolution reverses that effect.
The same envelope applies to both shapes. In this MVP, a section's elements
appear together and retire with that section or during route recovery.

The simulation borrows actual world-space flight positions, never gaze. A swept
segment applies a local impulse in travel direction; spring force and damping
return displaced particles to their resting shape. Standing still or teleporting
does not produce wind. Time steps and displacement are capped. Untouched particles skip spring updates;
damping is calculated once per frame for the entire cloud. Ambient drift
continues through the reused GPU material; the bounded flight response uses
reused CPU buffers and one dynamic center-position upload per visible section.

The center temporarily associates route displays with independently pooled element displays.
Compatible element geometries are merged into one cloud per section, capped at
20,000 moving samples (240,000 rendered grains at the current twelve-grain setting). Shape sampling occurs when the prepared section is shown;
there is no extra loop or unbounded history. Small temporary shape geometries
are disposed after merging, and all final buffers/materials are disposed on
unload. Elements add one draw call per visible section. Their small fixed pool
uses uncullable clouds so emergence and impulse offsets cannot clip at static
shape bounds. Individual ring feedback now follows actual forward passage. Audio timing remains
outside this MVP; the review observations below remain undecided.

Ring grains reuse the existing airborne wind shader with a stable phase per grain.
`START_SETTINGS.elementWind` controls their small horizontal and vertical drift
and slow speed. The phase does not change across frames; no random frame jitter,
extra CPU particle updates or additional render loop is introduced. Ambient air
and route particles retain their existing coherent wind.

### Directional light and passage feedback

- `ring-passage.ts` intersects real movement segments with world-space ring planes.
  Only forward crossings inside the clear opening emit an element index, once.
  Reverse movement, misses and position discontinuities do not produce success.
- `particle-light.ts` owns a bounded timeline per element: a repeating forward
  sweep, a stronger single success sweep. Passage never retires an individual ring. It knows
  neither ring geometry nor exercise completion.
- `particle-grain.vert.glsl` applies the same normalized local forward coordinate
  to all forms. Arrows illuminate from tail to tip; rings illuminate across their
  depth. All rings remain until the full section, including its exit, is completed.
  Normal retirement fades only while each complete ring bound is behind actual
  flight direction. Abandoned-course retirement fades every ring over the same
  duration as its path, regardless of direction.
- `element-retirement.ts` owns the per-element visibility envelope. It uses
  world-space bounds plus a motion clearance, independent of gaze. Turning back
  toward a fading ring pauses its fade; a front ring is never cleared to recycle
  a display slot during normal flight.
- `particle-grain.frag.glsl` adds warm luminous cores and highlights to a seeded
  subset of grains. This is a glass-like shading approximation without refraction,
  bloom, extra lights or another render pass.
- `particle-volume.ts` updates a fixed uniform array once per element. It borrows
  the injected timeline; particle buffers do not need per-frame light uploads.
- `start.module.ts` alone connects detector events to the timelines. It places the
  ring targets with the same pose and vertical offset as the displayed geometry,
  and clears observers during retirement, recovery and shutdown. Visual success
  does not decide whether an exercise is passed.

Settings live in `START_SETTINGS.elementLight` and `elementPassage`. The opening
radius is the configured ring radius minus the dense particle core radius. The
section-wide animation controls emergence; retirement never fabricates success.
`START_SETTINGS.elementRetirement` controls fade duration and clearance. The
independent pools reuse a slot only after its own display finishes. If all element
slots retain front rings, new rings wait while the new line can still appear.
Neither pool overwrites visible content or allocates additional slots. Resetting clears old light and retirement state.

## Open architecture observations

These observations are retained for later design decisions, not approved changes
or an implementation checklist. Reassess them as the implementation develops,
particularly when real audio timing and lesson progression are introduced.

### Success while narration is still running

In `start-game.runtime.ts`, passage success can be recorded while
`instructionEnded` is false. If deviation then occurs before narration ends,
the current recovery branch treats the exercise as unearned. This sequence was
reproduced independently; the current demo does not encounter it because the
center always supplies `instructionEnded: true`.

The audio integration needs an explicit decision about when success becomes
durable and how recovery interacts with unfinished narration. Preserving recorded
success during recovery is one possible solution; a different audio/phase model
may be more appropriate. No solution is selected yet.

### Ownership of successor selection

`start.module.ts` currently calculates the successor exercise index and attempt
for preparation, while `start-game.runtime.ts` calculates the same progression
when advancing. Both agree today. Changes to ordering, retries, or completion
could cause the prepared route to differ from the engine's selected exercise.

An explicit preparation selection supplied by the engine, or a shared engine
query, could remove that duplication. Revisit the contract when progression
requirements are clearer; no additional coordinator is proposed.

### Particle slice contract

The factory injected into `flight-path/particle-generation.ts` returns a general
`BufferGeometry`, but copying assumes `position`, `color`, `pathParticleSize`,
and `airParticleVisible` attributes with compatible counts and sufficient target
capacity. The existing producer satisfies these assumptions; an alternative
producer could satisfy the TypeScript signature and still fail during copying.

A more explicit slice contract in `flight-path/particle-contract.ts` could describe
these attributes, capacity, and disposal ownership, with checks at the boundary.
Choose the smallest useful contract when particle generation is extended.

### Existing point-cloud composition

The ambient `point-cloud/` implementation is an existing exception to the strict
file-level star described above: `point-cloud.module.ts` imports its geometry
implementation, and `point-cloud-geometry.ts` constructs the concrete material.
This is not a demonstrated runtime defect. At the next relevant change, decide
whether to document this as an intentional internal composition boundary or
inject material creation through the center. A restructuring solely for symmetry
is not currently justified.

Arrows are disabled in the current exercises through `elements.showArrows`;
only ring placements are generated.

The route trail uses `START_SETTINGS.pathOpacity` as its maximum opacity.
Reveal and retirement preserve this transparency.

## Quality and verification

Keep settings at the top, comments organized by responsibility, and functions
small and focused. Tests cover success, retries, cue gating, movement discontinuity,
route variation, particle ranges, and cleanup. Browser checks cover the real Start
route plus controlled successful and missed flights. Browser screenshots do not
constitute headset acceptance.
