<!--
Purpose: Document the Motion Perception level (04) as designed and as built.
Context: Motion Perception is the third sense level, following Echolocation.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 04 — Motion Perception

## Narrative Intent and Experience Goal

Make movement the primary way the world becomes visible ("Frog and insects").
For many animals, what holds still is nearly invisible; what twitches is
everything. The level expresses this through moving actors: persistent fly
swarms buzz in ground-near clouds, invisible bird flocks circle the
traveler on air rings, and every moving point prints a fading motion trail
— movement literally leaves a visible trace. This is a port of the proven
bm-base motion layer (fly swarms plus the motion-trail ring buffer), not a
material effect that dims static geometry.

## Entry, Exit, and Timeline Cues

- Enters from Echolocation: the depth-ramped world stays exactly as it was;
  the fly swarms and their trails fade in on top of it.
- Exits toward Thermal Perception: thermal values can appear first on moving
  actors before spreading to terrain and vegetation.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#212133` `#312758` `#45577A` `#10BEDB` `#E3DFDD` `#F3952D`

Decided art direction (2026-08-27): world motion alone controls visibility —
the sense is carried by moving actors, not by dimming static modules or
reacting to user movement. The world carries the Echolocation grayscale
ramp and pale haze unchanged (senses layer, never swap), and the motion
language prints against it in the ink-dark bm-base contrast style: flies as
near-black specks (`#212133`), trails as dark indigo (`#312758`).

Decided 2026-08-28: bird flocks are implemented as **procedural point
birds** — invisible perception-only actors of three points each (body plus
two flapping wingtips) circling the traveler, whose traces print in the
cyan accent `#10BEDB` that the palette reserved for them. The orange
`#F3952D` stays reserved (exit cues). No audio counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/motion.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF7F7F7` equal to the carried ramp haze stop).
- Fields: `terrain`, `grass`, `vegetation`, `rocks`, `airParticles`,
  `scentParticles`, and `echoDepth` copied unchanged from `echo.level.ts`,
  plus `motion: MotionSenseParameters` (intensity 1, twelve swarms of sixty
  flies, ink-dark appearance, fourteen-frame trails with motion gain 26,
  and three bird flocks of twelve birds on 30–90-metre air rings printing
  cyan traces).
- Active modules: everything the Echo level activates, plus Motion Sense
  (`src/modules/motion-sense/`): one fly-swarm boid simulation rendered as
  one opaque Points draw, and one motion-trail ring per actor class (fly
  trails and bird trails) rendered as one transparent Points draw each.
  Bird bodies render nothing — they are perception-only actors whose
  position stream feeds a trail ring through the `MotionPointSource` seam.
  The composition root skips the module entirely at intensity zero, and
  the sense never imports or recolors a sibling.
- Excluded by intent: Animals (unchanged from Echo). Grass carries over from
  Echo with its depth ramp, like every other surface.

## Asset and Shader Requirements

- No external assets; flies and trails are procedural points.
- Three module-owned GLSL ES 3.00 files: `motion-trail.vert.glsl` (GPU age,
  fade, outward drift, and collapse from one frame uniform),
  `motion-trail.frag.glsl` (circle discard and age-faded alpha), and
  `fly-swarm-circle.frag.glsl` (round speck discard). Both materials patch
  `PointsMaterial` through `onBeforeCompile`, the established scent idiom.

## Performance Budget and Measured Evidence

- CPU per frame: 720 fly boids with stepped hash noise and eight strided
  flockmate samples each (never the full pairing), 36 birds composing 108
  orbit-and-flap points, plus 828 trail-distance computations — well under
  0.25 ms of the 11.1 ms 90 FPS frame.
- Uploads per frame are bounded and contiguous: one printed ring slot per
  trail (720 and 108 points × 8 floats ≈ 26 KB) plus the live fly positions
  (≈ 8.6 KB), each as one `addUpdateRange`. All other trail animation
  derives GPU-only from one frame uniform — the port deliberately moved
  bm-base's full-ring CPU rewrite onto the GPU to honour "CPU sets up, GPU
  animates".
- Draw calls: the Echo baseline plus exactly three (opaque flies,
  transparent fly trails, transparent bird trails; bird bodies render
  nothing). Trail overdraw is negligible: 11,592 ring points of a few
  pixels each with a one-discard, one-pow fragment.
- Memory: trail rings ≈ 371 KB of attributes, fly and bird buffers ≈ 30 KB.
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or 90 Hz
  headset claim is approved.

## Decisions, Risks, and Open Questions

- World motion only (decided 2026-08-27): user movement does not reveal the
  world, and no receding material effect dims static modules in this step;
  whether static elements should recede beyond the carried depth ramp is an
  open art decision.
- Procedural point birds (decided 2026-08-28): each bird is three points
  with a deterministic wing-flap oscillation on a circling flock orbit, so
  traces read as flowing swarm streaks. Upgrading to bm-base's rigged
  `bird_erasmus.glb` with animated wing-vertex sampling (true
  wing-silhouette traces, and root-space sampling so only the flap — not
  world flight — prints) remains open behind the same `MotionPointSource`
  seam.
- The bm-base path-flyby swarm event is a follow-up blocked on the runtime
  coordination decision (open-decisions §2); the current swarms are
  persistent and statically authored.
- Trail length is authored in rendered frames (fourteen ≈ 155 ms at 90 FPS
  but 233 ms at 60 FPS). Frame-based ring math is kept for bm-base parity; a
  fixed-cadence spawn accumulator is the known fix if the frame-rate
  dependence ever shows.
- Trail expansion directions point away from the global fly centroid (bm-base
  parity), which for multiple swarms reads as a subtle sideways drift; a
  per-swarm centroid is the known refinement if it bothers.
- Open art decisions: cyan `#10BEDB` trails instead of ink-dark indigo;
  re-authoring the carried depth ramp in the level-04 palette tones; fly and
  trail size, gain, and density tuning against real headset contrast.
