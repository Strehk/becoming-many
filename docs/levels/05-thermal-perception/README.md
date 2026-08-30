<!--
Purpose: Document the Thermal Perception level (05) as designed and as built.
Context: Thermal Perception is the fourth sense level, following Motion Perception.
Responsibility: Keep narrative intent, the exact preset, and open decisions in one place.
Boundary: The Level Guide owns the cross-level sequence; modules own their implementations.
-->

# 05 — Thermal Perception

## Narrative Intent and Experience Goal

Reveal the world through temperature differences ("Snake"). Some snakes
have pit organs whose heat signal merges with vision; here that merged view
becomes a false-color heat image, and living animals stand out like prey
because being alive means giving off heat, and heat cannot keep a secret
(see `script/en.md`, "Infrared"). Heat is a near sense: the false-color
view exists only inside a bounded radius around the traveler and feathers
back into the carried grayscale world beyond it.

## Entry, Exit, and Timeline Cues

- Enters from Motion Perception: the depth-ramped world and the printed
  motion trails stay exactly as they were; the heat view fades in around
  the traveler, and warm animal bodies join the world for the first time.
- Exits toward Magnetic Field Perception: thermal values later fade as
  large-scale directional magnetic patterns become visible.
- The timeline driver (audio clock / schedule) is unresolved — see
  `docs/direction/open-decisions.md` §2. Until then the sense intensity is
  authored statically in the preset and this level runs standalone from
  `src/main.ts`; no cross-level transition machinery exists yet.

## Visual and Audio Direction

Palette (see [moodboard](mood/moodboard.png)):
`#2E1386` `#0C47D1` `#2EB4E8` `#D5198A` `#FB5F16` `#FCCE43`

The ramp's anchors are that palette cold to hot, five of them verbatim. The
coldest is carried down its own hue to `#0E0628`; the decision below records
why. What the anchors are and how far up the warmth range each one is reached
are separate questions; the 2026-08-30 decision on the ramp thresholds below
records where the stops were placed.

Decided art direction (2026-08-28): the documented level-05 palette maps
cold to hot across a six-stop ramp. The temperature field is expressive
but physically motivated — water reads coldest and colder with depth, dry
ground warms with elevation, forest regions and steep faces hold extra
warmth — and it is fully static (no temporal variation or heat trails in
this step). The heat view reaches 30 metres and feathers over 10 metres
back into the carried echo grayscale, so distance keeps its established
meaning outside the thermal radius. Animals carry one constant near-hot
warmth (0.92) and read as magenta-to-yellow signatures; their base fur
colors come from the level-03 dark stops so they sit inside the echo
palette outside the radius. No audio counterpart exists yet.

## Exact Typed Preset and Active Modules

- Preset: `src/levels/thermal.level.ts` (`testUi: true`, 128-metre view
  distance, background `0xF1F1F1` equal to the carried ramp haze stop).
- Fields: `terrain`, `grass`, `vegetation`, `rocks`, `airParticles`,
  `scentParticles`, `echoDepth`, and `motion` copied unchanged from
  `motion.level.ts`, plus `animals` (echo-palette fur colors) and
  `thermal: ThermalPerceptionParameters` (intensity 1, 60-metre radius,
  20-metre edge feather, five documented palette stops over a darkened
  coldest one, vegetation warmth 0.32 ± 0.20, rock warmth 0.2 ± 0.18, actor
  warmth 0.96). These figures had drifted from the preset across several
  tuning sessions and were brought back to it on 2026-08-30.
- Active modules: everything the Motion level activates, plus Animals and
  Thermal Perception (`src/modules/thermal-perception/`): one shared
  material-effect family applied by the composition root to Terrain
  (per-vertex CPU-sampled warmth attribute), Vegetation and Rocks (stable
  hashed per-instance warmth), and Animals (constant actor warmth). The
  composition root orders thermal first in every effect list so it wins
  the final surface color over the carried echo ramp, and skips the module
  entirely at intensity zero. The sense never imports or recolors a
  sibling.
- Decided 2026-08-30: Grass takes the Vegetation heat variant — the same
  band, warmth, spread, texture, and contrast uniforms, shared through the
  same effect instance. It is the same living plant matter growing between
  the bushes that carry those values, and a meadow running cooler than the
  shrubs standing in it would read as a different substance. Grass has no
  `instanceMatrix`, so the variant's non-instanced branch measures its
  world position instead: every tuft holds the plant base warmth, and the
  shared world-space texture varies it across the meadow the way it varies
  the ground beneath. The blade-scale height gradient is deliberately not
  reproduced; over a 0.75-metre tuft the vegetation rate adds 0.017 warmth,
  far below the texture's own variation.
- Excluded by intent: nothing; every rendered surface now answers to the
  heat view.

## Asset and Shader Requirements

- No new external assets; the level reuses the existing animal, tree, and
  rock GLBs.
- Four module-owned GLSL ES 3.00 files: `thermal-perception.frag.glsl`
  (six-stop ramp plus the radius feather mask), and three vertex variants
  — `thermal-terrain.vert.glsl` (warmth attribute pass-through),
  `thermal-instanced.vert.glsl` (quantized instance-position hash),
  `thermal-actor.vert.glsl` (constant warmth). All patch consumers'
  existing materials through the shared `applyShaderPatch` helper; the
  radius needs no camera uniform because the camera-space view distance is
  already camera-relative.

## Performance Budget and Measured Evidence

- No additional thermal camera, render pass, geometry, texture, or draw
  call; the effect rides the existing opaque surface passes.
- Per-fragment cost inside the radius: five `mix`/`smoothstep` segments
  plus one feather smoothstep on top of the carried echo ramp.
- Terrain streaming samples one extra `zoneConditionsAt` per vertex during
  row-bounded chunk generation (the same order of work as the Terrain
  Colors presentation path) and uploads one extra float attribute
  (~4 KB per 33×33 chunk).
- Animals add their bounded population cost (at most four visible actors,
  unchanged from the Test Level budget).
- No hardware desktop measurement has been recorded for this level yet.
- The standalone PICO 4 / 90 FPS gate is not yet measured; no 72 Hz or
  90 Hz headset claim is approved.

## Decisions, Risks, and Open Questions

- Radius through view distance (decided 2026-08-28): "thermal only near
  the viewer" is implemented as the camera-space radial distance already
  used by Echo Depth, so the effect needs no per-frame uniform updates and
  no update hook on Vegetation or Rocks effects.
- Static field (decided 2026-08-28): no time uniform; temporal variation
  and heat trails remain open art decisions.
- The echo ramp is carried verbatim (senses layer, never swap) even though
  the thermal ramp covers it inside the radius; the composition-root
  ordering comment and a regression test lock the thermal-wins behavior.
- Terrain warmth samples zone conditions during streaming; if a future
  preset combines the Terrain Colors presentation with thermal, the same
  conditions are sampled twice per vertex (bounded by row streaming, noted
  in the module README).
- Cold end keeps the moodboard violet and blue (decided 2026-08-30): a
  neutral cold end was tried the same day and reverted. That experiment
  replaced `#2E1386` and `#0C47D1` with greys drawn from the carried echo
  ramp, so cold ground carried no hue of its own and the echo world's depth
  image showed through it — heat as a highlight rather than a coat of paint.
  It was rejected because it costs the level its identity: the moodboard
  reads cold to hot as violet through yellow, and a landscape of greys is the
  echolocation world with warm objects standing in it rather than a thermal
  image. The concern behind it is real and is answered by where the ramp
  thresholds sit instead (below) — the ground is held in violet, blue, and
  cyan because magenta begins above anything it can measure, not because its
  colors were taken away.
  - Known limit, unchanged by either choice: `carriedColorBlend` is one
    constant for every fragment, so the carried echo world is mixed into warm
    and cold surfaces alike and pulls distant pale surfaces down toward their
    own brightness. True transparency would fade the false color in with
    temperature and leave cold surfaces untouched; that means a
    warmth-dependent blend in the shader, which is a module change and is not
    taken here.
- Ramp thresholds (decided 2026-08-30): the stops at which each palette color
  is fully reached moved from `0.14 / 0.30 / 0.46 / 0.64` to
  `0.18 / 0.44 / 0.70 / 0.86`. The cold end now owns most of the warmth
  range, and magenta, orange, and yellow are pushed into its top third, where
  little but a living body reaches. The cyan stop is placed at the terrain
  band's ceiling: the ground spreads its whole range of readings across
  violet, blue, and cyan and arrives at saturated cyan exactly where its own
  substance runs out, so it never tips into magenta however its elevation,
  texture, and contrast add up. Holding the ground's hue with the ramp rather
  than by lowering its band is deliberate — the band had been widened in the
  same session to stop the ground's warmer readings being clipped onto one
  color, and narrowing it again would undo that gradation. Yellow becomes
  exclusive to living bodies and an exposed tree crown tops out between
  magenta and orange. `actorExtremityFalloff` (0.42 to 0.32) and the animals
  band floor (0.4 to 0.5) followed: with the warm stops higher, the old
  falloff would have carried limbs down into the cyan the ground occupies,
  handing the landscape's own color to the one thing that must read as hot.
  A regression test in `tests/levels/level-presets.test.ts` locks the ground
  and rock ceilings below the warm stop.
- Internal thermal structure of a tree (decided 2026-08-30): a crown was
  reading as one color, and the cause was not the plant's own values but the
  texture laid over them. The coarsest noise octave spanned six metres, wider
  than a crown, and carried close to half the field on its own, so the
  strongest scale in the image was tinting each tree as a unit; the per-plant
  hash spread (0.3) then moved whole plants far enough to hide what little
  internal variation survived. The module's texture was pulled to a 4.5-metre
  coarsest octave with its finer octaves weighted up (`gain` 0.62 to 0.78), so
  the largest patch is about half a crown, and the plant's spread narrowed to
  0.2. On top of that the plant's own shaping widened: base 0.34 to 0.32,
  height gradient 0.038 to 0.05 per metre, axis gradient 0.022 to 0.028 per
  metre, texture depth 0.46 to 0.58, contrast 0.72 to 0.76, band 0.08..0.78 to
  0.04..0.86, and the module's vegetation contrast pivot 0.5 to 0.56. One tree
  now runs from a violet stem base through blue and cyan into a magenta inner
  crown and orange exposed foliage, mottled throughout. The height gradient is
  deliberately held short of what would drive a crown top through the band
  ceiling: readings that pile into the knee all return the same orange, and a
  flat canopy top is the reading this change exists to break. Two costs were
  accepted: the finer texture reaches ground, rock, and animal coats as well,
  and exposed foliage now shares orange with animals, which keep yellow alone.
- Per-part plant warmth is not reachable from configuration (recorded
  2026-08-30, supersedes the open question): the instanced variant measures
  height above the instance base and distance from the instance's vertical
  axis, and one gradient pair covers the whole plant. A warm trunk core
  fading to cool edges cannot be authored at all, at any value — every point
  on a trunk's rendered surface sits at the same distance from that axis, so
  no radial term can vary across it. That look needs a normal- or view-facing
  term in the thermal shaders, which have no access to normals; it is a
  module change and is not taken here. Separating trunk from crown likewise
  needs either a second gradient pair or a per-part warmth input, because a
  coefficient steep enough to shade a 0.2-metre trunk drives a 3-metre crown
  through the band floor.
- Black floor at the cold end (decided 2026-08-30): the coldest stop moved
  from the moodboard's `#2E1386` to `#0E0628`, the same hue at roughly a
  third of its value. A thermal image has a black floor and this ramp had
  none — its coldest reading was a lit violet, so shadowed depths inside a
  crown, cold hollows in the ground, and deep water all bottomed out on a
  color bright enough to read as a surface rather than as absence. The
  vegetation band floor had been opened to 0.04 in the same session and had
  nowhere dark to land. The hue is kept, so the cold end still runs violet
  into blue and the level still reads cold to hot rather than dark to light;
  this is a change of value, not the drained cold end rejected above. It
  stops short of true black because `carriedColorBlend` keeps 0.42 of the
  echo world on every sensed surface, and a black stop under that share reads
  as a hole in the image instead of as cold. The moodboard table in
  `docs/levels/README.md` still records the image's own `#2E1386`.
- Open art decisions: physical versus expressive temperature mapping
  tuning against real headset contrast; radius and feather width against
  the dramaturgy; whether the shaders should gain a normal- or view-facing
  term so a trunk can read as a warm core against cool edges; temporal
  variation and heat trails.
