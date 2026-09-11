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
| `start-timing.ts` | Narration-started deadline and admission of complete recordings. |
| `start-game.runtime.ts` | Current exercise, attempt identity, phase, retry, and completion decisions. |
| `flight-path/flight-route.ts` | Generate and sample a route from geometric parameters and a seed. |
| `flight-path/flight-course.ts` | Own the bounded course tail; every appended section connects to that tail. |
| `flight-path/flight-connection.ts` | Compute a position- and tangent-continuous successor pose. |
| `flight-path/flight-deviation.ts` | Observe sustained movement outside the route corridor. |
| `flight-path/flight-recovery.ts` | Compute a fresh approach from actual position and flight direction. |
| `flight-path/particle-generation.ts` | Own bounded incremental particle work and cancellation. |
| `particle-elements/ring-passage.ts` | Share generous ring-crossing observations between feedback and lesson progress. |
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
straight tangent exit (`outroMeters`). Authored entries span 3–9 m and exits 3–6 m. The first two ring crossings earn success and immediately start the successor
recording and preparation. Activation waits only for prepared visuals and the
spoken cue, not the old section exit. The visible route
never moves after placement.

`flight-connection.ts` computes only the successor pose. Its first point and
heading match the previous last point and heading, including local entry offsets.
`particle-generation.ts` generates four meters per StreamQueue step using an
injected particle factory. The center enqueues work on the existing World queue,
retries queue admission if full, and invalidates obsolete jobs on reset/unload.
Run can hold Start through `setPaused`: native speech retains its offset,
lesson/visual updates stop and atmosphere sources become silent. `readPlayback`
reports held, buffering, blocked and failed speech to Run. Pause never deactivates
or resets the lesson; Stop prepares a fresh paused tutorial through Run.

Prepared successor lines grow forward after the previous reveal front reaches the seam.
Generation stays independent of presentation; regular connections preserve position and tangent.

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

Rings occupy only `[exerciseStartMeters, exerciseEndMeters]`. A chunk's exit
and its successor's entry therefore form a ring-free connection. Rendering
and progression sample the same fixed route; joining never depends on the
player's position at the moment of transition.

## Deviation and recovery

`flight-deviation.ts` observes distance to a sampled route corridor and distance
actually flown outside it. The defaults allow 12 m separation. Recovery requires another 8 m of sustained
outside travel, a heading difference of at least 0.87 radians from the forward
route target, and the exercise ring area outside the camera view. A conservative
6 m padding protects visible ring edges. Parallel offsets, returning toward the
route, gaze alone and reset displacements do not trigger a course replacement. The approach to a fresh entry is included in the corridor.
Looking away or standing still never triggers recovery. Ring feedback and lesson success share one forward plane-crossing observer.
Both of the first two rings must be crossed; the third ring is optional. The
opening radius plus 2.95 m padding gives a 6 m acceptance radius, centered on
the visible ring, including its 0.5 m downward presentation offset. Hidden
route checkpoints no longer gate lesson success or the next section.

`flight-recovery.ts` calculates only a new pose. At reveal time it captures the
latest rig position and actual travel direction to place an approach 6 m ahead.
The approach is fixed in world space; turning the head does not drag it along. Existing height constraints are applied
to the owned candidate position. It never changes the player position.

Recovery replaces the entire abandoned course: its line and rings fade out
together over 2.5 seconds, including rings ahead. This is the explicit exception to behind-only
retirement during normal flight. The new course begins with a particle-only
approach; new rings cannot coexist with an abandoned course's rings. An unearned
exercise repeats; a completed exercise remains earned when leaving its exit.

## Narration and lesson sequence

The authored order is right, left, climb, descent. Each exercise owns its recording
URL, measured duration and approximate word-aligned instruction offset. Current
German WAVs match the transcript hashes; English WAVs contain the delivered English
recordings. `start-audio-cues.ts` owns English voice cues and opening staging;
`start-exercises.ts` retains German defaults and shared course settings. Start
selects its exercise data once at construction from Composition's session language.
Run supplies Show's current language (including tutorial restarts) or the standalone
request language. Browser entries default to English; `?language=de` selects German.

`StartVoice` is an injected playback capability. Start selects the lesson; a Sound
owner must supply native offset, natural end and failure separately. The engine
never starts media or creates geometry. No audio element or second clock lives in
Start. Without this capability, the standalone visual demo still uses its explicit
two-second fallback and loops. Level Composition supplies `sound/voice-player.ts` for standalone Start. Run
owns its cleanup, including partial startup; the Start module only stops its
borrowed player when deactivated. The player owns one native audio element and
retries autoplay denial on pointer/key gestures. Its native offset is hidden
until playback starts, preventing a requested retry seek from releasing a cue
while audio is blocked. The main Show keeps its existing narration player.

Each exercise has a typed `sequence` contract: `approachMeters`, optional
`pathAtSeconds` / `pathFadeSeconds`, and `worldReveal`. Both visual envelopes
use recording-local seconds. Start retains their presence across later recordings;
renderers receive only opacity observations.

In German, the opening stays white until the end of "Anfang" at 6.38 s. The blue approach
then fades in over 3.2 s, anchored to the actual player. Its 26 m ring-free
approach preserves the turn distance at the later spoken instruction. Black room particles
begin their separate 3.2 s fade at "Raum", 13.36 s. These markers come from the
existing word alignment and remain adjustable. In English the path begins at
8.00 s, the room at 12.94 s, and the right instruction at 17.16 s. The English
approach is 18.48 m to preserve the remaining turn distance at that earlier cue;
fade durations and subsequent route geometry are shared. The continuous right curve is
prepared with the approach; rings and the entry signpost wait until 19.30 s.
Rings emerge progressively over 2 s each. The first gate is 13 m into the chunk;
three gates at 4.2 m intervals mark the bend. The open-stroke signpost stands
at route meter 10, 5 m left of the route and 1.8 m above it, pointing at that gate.
Its particle core is compact with no diffuse halo; ring appearance is unchanged. Initial placement therefore does not depend on loading or autoplay
wait duration. The transition into the left lesson uses a 3 m exit and a 9 m entry;
later lessons use 8 m entries. The actual media
cue releases the prepared path and rings. The second required ring starts
the next recording immediately, even if the previous spoken tail is unfinished. Success remains earned if the player
deviates while the spoken tail finishes. A successor cannot activate before its
cue. Retry playback begins at the instruction marker, without preceding praise;
an unfinished introduction remains intact during early recovery. Four successes
play the closing recording once. Final rings retain behind-only retirement.
`StartExperience.readComplete()` requires the final ring goal (or the exercise
deadline) and the closing recording's natural end; playback failure never completes Start. Run
owns the transition and supplies `setPresence()` for a shared room, path, ring
and atmosphere fade. This multiplier is separate from spoken visual cues and
per-ring reveal/retirement. Start does not import Show or move the player.

Horizontal routes turn 110 degrees right and left. Vertical routes use two opposite circular arcs
with a maximum 24-degree pitch and level entry/exit tangents. This preserves the
existing yaw-only chunk placement contract while changing altitude. Rings sample
the same position and tangent in either plane. The route does not move the player
or bypass the level's height limits.

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
Horizontal turns and vertical bends with level chunk seams are supported;
arbitrary banked or pitched seams would require an explicit frame contract. Placement is deterministic for
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
appear progressively along route distance after the speech cue and retire with that section or during route recovery.

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
shape bounds. Individual ring feedback now follows actual forward passage. Native audio observations are injected through the Start voice contract.

Ring grains use `particle-wind.vert.glsl`: a smooth spatial random field with
shared motion for neighboring grains and a small seeded individual component.
Displacement is bounded around resting positions, so the ring cannot drift apart.
`START_SETTINGS.elementWind` controls amplitude, individual variation, spatial
coherence and change duration. Quintic interpolation and a wrapped noise lattice
keep velocity continuous, including clock wrap. The material owns the wind clock;
there are no CPU particle uploads or additional loops. The old per-grain sinusoidal
phase override is removed; ambient air and route wind keep their original behavior.

### Directional light and passage feedback

- `ring-passage.ts` intersects real movement segments with world-space ring planes.
  Only forward crossings within the opening plus configured padding emit an element index, once.
  Reverse movement, misses and position discontinuities do not produce success.
- `particle-light.ts` owns a bounded timeline per element: a repeating forward
  sweep, a stronger single success sweep. Passage never retires an individual ring. It knows
  neither ring geometry nor exercise completion.
- `particle-grain.vert.glsl` applies the same normalized local forward coordinate
  to all forms. Arrows illuminate from tail to tip; rings illuminate across their
  depth. Section retirement begins when the successor activates.
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


## Exercise authoring contract

All exercise tuning lives in `START_EXERCISES` in `start-exercises.ts` and is
checked by `ExerciseDefinition`. Distances are world meters. Equal range endpoints
disable variation; a fixed seed reproduces varied routes.

| Parameter | Meaning | Current value |
| --- | --- | --- |
| `route.turnDegrees` | Horizontal heading change or vertical peak pitch, in degrees | 110 horizontal / 24 vertical |
| `route.turnSign` | Left/down (-1), right/up (+1) | Per lesson |
| `route.turnRadiusMeters` | Curve radius; smaller is tighter | 10–10.5 m horizontal / 12–12.5 m vertical |
| `route.straightMeters` / `outroMeters` | Ring-free entry and exit | 3–9 / 3–6 m |
| `elements.ringCount` | Exact authored ring count, 0–12 | 3 per exercise |
| `elements.spacingMeters` | Distance along the route between rings | 4.2 m |
| `elements.firstMeters` | First ring route distance, clamped to exercise start | 13 m right, 10 m left, 9 m vertical |
| `elements.ringRadiusMeters` | Ring opening geometry radius | 3.6 m |
| `particles` | Density, color, size and scatter ranges | Existing particle palette |
| `deviation` / `progress` | Recovery corridor and forward-passage tolerance | 12 m corridor |

Ring count, spacing and route dimensions must agree. The last ring must fit
inside the curved exercise: radius × angle in radians for horizontal turns,
twice that length for the two-arc vertical profile. Invalid
combinations fail before rendering instead of silently truncating the ring count.
Three-ring sections span 8.4 m. The complete direct route targets approximately
60 seconds as a guideline at the unchanged 2 m/s speed. Extra breathing space
is authored as six additional meters of approach in each successor, not a delay
before preparing it. Success immediately starts the next narration; the next
rings grow at its cue while the player is still approaching from a distance.
Native spoken-word markers and soft reveal envelopes remain intact. The left
section reserves a 6 m exit for the longer climb instruction; every connector
must provide at least the next spoken cue in travel time.

### Timing and automatic completion

`START_TIMING` at the top of `start-exercises.ts` owns the adjustable deadline
(`maximumExerciseSeconds: 90`), recording admission margin (`voiceSafetySeconds:
0.75`), and closing atmosphere fade (`closingAtmosphereFadeSeconds: 6`). The
60-second flight duration is a design guideline controlled by route lengths and
ring placements below, not a second timer or an automatic speed adjustment.

The clock begins when the first recording advances, excludes loading, and never
resets on recovery. At the deadline, Start ends the exercise requirement and
plays the unchanged closing recording once, even if no route was completed.
New lesson recordings must fit before the deadline. If delayed media has not
naturally ended, its tail takes priority over cutting speech off. No new course
is generated during closing, and no teleport is required to earn completion.
Existing geometry stays visible until Run's normal fade. Atmosphere fades over
six seconds during the closing voice, allowing its reverb to decay before Run
releases sources. At normal speed the timeout path therefore reaches Show after
roughly 106 seconds: 90 seconds of tutorial, 13.86 seconds of closing speech,
and 2.5 seconds of handoff.

Connected path displays inherit the predecessor's revealed feather at their
shared endpoint. Only the rendered front receives this offset; ring growth keeps
its original authored clock. New course entries reset the inherited offset.
Path wind is sampled in world space and converted back through each path's yaw,
so adjoining sections share both position and drift at their seam. Route lengths,
flight speed, native cues and ring timing remain independent of this rendering.

`START_SETTINGS.pathGrowth` controls the forward reveal speed (12 m/s) and soft
leading edge (3 m). A route-distance shader reveals prepared geometry without
allocating particles per frame. `elementReveal` controls ring growth speed and a
2 s fade per element. Rings wait for both the cue and the fully revealed path at
their station, then emerge in distance order. Retirement cancels pending reveals;
reusing a display clears their state. The center connects these independent owners.
Flight speed currently comes from `src/levels/start.level.ts` through the existing
Level Runtime (`flightSpeedMetersPerSecond: 2`); it is not a particle parameter.

The entry signpost is separate from repeated exterior arrows. `entry-arrow.ts`
consumes route samples and ring placements and returns only a placement. The
center selects the open stroke shape and arrow volume parameters. Its geometry
factory receives the element kind, keeping appearance choices out of placement.
`START_SETTINGS.arrowVolume` controls compactness; ring volume remains shared.

### Quiet spatial atmosphere

`audio/audio-contract.ts` describes section placements, visibility and pulse
observations; `audio/audio-settings.ts` owns all gains, distances, grain sizes,
head counts and hall parameters. `audio/start-audio.ts` owns decoded buffers,
Tone players and Three positional sources. Start supplies world-space ring
centers, orientations and the same reveal/retirement presence as the graphics.
The light timeline exposes pulse counters, so sound never runs a duplicate
visual clock. Arrows have no sound sources.

Each ring has a central pulse and three granular click sources on its rim,
randomly detuned from zero to two octaves down. Each section has three unpitched,
offset granular heads at its midpoint. The looping pad drops from approximately
-32.42 dB to -44.42 dB during speech. Positional attenuation feeds one shared hall and limiter;
no dry path bypasses distance attenuation. Sources stop and dispose with their
section. Four section slots bound their lifetime.

Composition borrows the existing Sound context/listener for Start.
Run remains the sole listener-pose writer and closes the shared context only
after Start releases its sources. Start never creates a listener or context.
The atmosphere applies handoff presence once to every source gain, including
the background pad. Native voice remains the foreground source. Browser verification checks source
placement, negative detuning, audible stereo output, ducking and final disposal:
`node tests/browser/start-atmosphere.mjs` with the development server on port 4180.

Atmosphere levels in `audio/audio-settings.ts` include a 20% amplitude increase
(+1.583625 dB) across pulse, clicking, base and both pad levels. Speech ducking
remains 12 dB and all fade durations remain unchanged.

### White-room closing sequence

`start-closing.ts` samples sequential smooth fades from closing narration time.
`START_TIMING` centrally configures the course fade (3 seconds), the following
room-particle fade (3 seconds), and a minimum white hold (2 seconds). The course
includes the blue path and remaining ring/arrow particles. Flight and particle
animation continue throughout these fades. Completion requires the white hold
and natural voice completion; Run therefore stops flight and changes the scene
only after all tutorial visuals are invisible. Its existing 2.5-second transition
adds a quiet white interval before Show. Atmosphere keeps its independent fade
and reverb decay during the closing voice.
