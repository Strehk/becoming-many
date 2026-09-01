<!--
Purpose: Record the verified implementation state of Becoming Many.
Context: The project has moved from initial planning into a working landscape test MVP.
Responsibility: Summarize what exists, what is verified, and what should happen next.
Boundary: Product vision and long-term design remain in the specialized documents.
-->

# Current Development Status

Snapshot: 2026-09-01

The current `src/` and `public/` trees are the source of truth. This page is
the concise entry point for the current implementation.

## Runnable Result

`bun run dev` starts a Vite application that plays the piece — the full show
world composed from the sense ladder, following the narration timeline:

- the complete Magnetic Field Perception world carried over unchanged: the
  warm off-white haze background, the grayscale Echo Depth ramp on Terrain,
  Vegetation, and Rocks, the earlier air and scent layers, the fly swarms,
  bird flocks, and printed motion trails, the 30-metre false-color heat
  view with the warm animal population, and the deep-blue ground field
  lines with the northern sky glow, because senses layer instead of
  swapping
- the mycelium web alpha-blended over the unchanged carried world inside
  an 88-metre viewer radius: fine strand bundles and node glows
  connecting the deterministic positions of trees, bushes, forest clearings,
  rocks, and the visible animals, colored per source class, with cream
  light pulses traveling the cords and bounded animal links following the
  living actors
- the diagnostic test overlay
- pointer-lock mouse look
- WASD and arrow-key flight along the mouse look direction
- a user-triggered Three.js `immersive-vr` button

The application opens the piece by default. It has one Level Runtime
composition root and one render loop. Every preset from `white-world`
through `connections` to the `test` and `design-test` diagnostics is named
in `levels/level-catalog.ts` and opens as a showless development run with
`?level=<name>`.

`?benchmark[=<profile>]` replaces live controls with a replayed route and
a fixed timestep, and `bun run benchmark` drives that mode in Chromium and
writes a report artifact. Its `renderer.info` counters repeat exactly; its
frame times are machine-local measurements.

The default page plays the piece: the schedule is the world authority,
standing the composed show world in each cue's level — senses, structure,
and background all fade across cue boundaries, nothing cuts — the clock is
exposed as `window.showClock`, and `?language=<de|en>` arms the narration
language. The station link connects by itself and fails soft; a corner
widget shows the socket state and links to the conductor. With a localhost
broker started with `bun run station` (`?station=<ws url>` points somewhere
else), the conductor page at
`/conductor.html` can drive the show from a second window: one scrubbable timeline of
the schedule, play and hold, time scale, jump to any cue, a next-cue countdown,
a DE/EN re-arm, and resets for the show clock, the flight, and the show window
itself. The broker relays only; with none running the show plays unchanged.

## Implemented System

### Runtime

- `src/main.ts` only selects the active level, calls `startLevel()`, and hands
  the returned `RunningLevel` to the station link when `?station` is present.
- `level-runtime.ts` preloads fixed assets for enabled modules, applies the sparse preset,
  creates only enabled modules, and connects desktop controls.
- `world-runtime.ts` owns the Three.js scene, perspective camera, WebGL
  renderer, timer, resize handling, module runtime, stream queue, and one
  `renderer.setAnimationLoop()`. It does not import level or concrete module
  code.
- `webxr-entry.ts` enables WebXR and adds Three.js `VRButton` for
  `immersive-vr` sessions.
- `src/station` owns the wire between the show window and the conductor page;
  the Bun broker at `station/station-server.ts` relays between them and holds no
  show state. `src/conductor` owns the operator page and reads schedule data
  without authoring it.
- Every frame updates desktop movement, active modules, bounded stream work,
  and then renders once.

### Levels and Modules

- `LevelPreset` is sparse: a level defines only the values and optional module
  parameters it needs.
- `white-world.level.ts` defines a white background, a 128-metre view distance,
  and Air Particles parameters without Terrain.
- `scent.level.ts` is the Scent World base experiment: a pale warm background,
  a 128-metre view distance, the test overlay, Scent Particles, the unchanged
  White World Air Particles layer, the invisible ground flag, and the
  invisible vegetation that grows the plants the scent radiates from.
- `echo.level.ts` is the Echolocation level: a 128-metre view distance, the
  test overlay, Terrain with its plain material, dark-palette Vegetation and
  Rocks, the unchanged White World air layer and Scent World layer carried
  over as accumulated senses, and the `echoDepth` field that decorates the
  three surface modules' materials with one shared distance ramp.
- `motion.level.ts` is the Motion Perception level: every Echolocation value
  carried over unchanged plus the `motion` field that activates the Motion
  Sense fly swarms, the invisible bird flocks, and their printed motion
  trails.
- `thermal.level.ts` is the Thermal Perception level: every Motion
  Perception value carried over unchanged plus the `animals` field (fur
  colors from the echo dark stops) and the `thermal` field that decorates
  Terrain, Vegetation, Rocks, and Animals with the radius-bounded
  false-color heat view.
- `magnetic.level.ts` is the Magnetic Field Perception level: every Thermal
  Perception value carried over unchanged plus the top-level `magnetic`
  field that activates the terrain field lines and the northern sky glow
  with the level-06 moodboard blues.
- `connections.level.ts` is the Connections level and the current default:
  every Magnetic Field Perception value carried over unchanged plus the
  top-level `connections` field that activates the streamed mycelium web
  with its per-source node records and palette.
- The sparse `invisibleGround: true` flag clamps flight above the shared
  deterministic world surface without creating the Terrain module or any
  rendered geometry.
- `test.level.ts` uses a 180-metre view distance, activates
  Terrain, Grass, Vegetation, Rocks, and Animals, selects Zone Visualizer as
  the Terrain presentation, and authors its own diagnostic magnetic block
  (warm orange colors) under the shared top-level `magnetic` field.
- Grass, Vegetation, and Rocks expose only level-relevant zone density and
  appearance values. Their seeds, candidate grids, assets, and variants remain
  in module-owned definitions.
- `ModuleRuntime` implements `load`, `activate`, `update`, `deactivate`, and
  `unload`.
- Air Particles, Scent Particles, Grass, Terrain, Vegetation, Rocks,
  Animals, and Motion Sense are implemented content modules. Zone Visualizer
  is the active test-only Terrain presentation; Magnetic Sense, Echo Depth,
  and Thermal Perception are composable material effects patching through
  the shared `material-shader-patch.ts` helper. Echo Depth was the first
  multi-consumer effect (Terrain, Vegetation, and Rocks through the shared
  `UnlitMaterialEffect` contract); Thermal Perception extends the pattern
  to Animals and to per-consumer warmth sources. Both can reach Grass as
  well — a module's own `ShaderMaterial` is a patch target like any built-in
  pass as long as its GLSL carries the chunk anchors — but no level pairs
  them with grass at present, so that path is covered by tests only.

### World Surface

- `WorldSurfaceSettings` keeps physical height and river values independently
  from narrative levels and visual modules. `ZoneSettings` separately owns
  zone identities and thresholds.
- `WorldSurface` exposes `groundYAt()`, `surfaceYAt()`,
  `zoneConditionsAt()`, and `zoneAt()` at absolute coordinates.
- `zoneAt()` derives its hard identity from the same continuous river, water,
  slope, and forest-region conditions used by diagnostic rendering.
- Terrain always samples `groundYAt()`. Grass samples `groundYAt()` and
  `zoneAt()` when a slot changes. Terrain samples continuous conditions only
  when the level selects Zone Visualizer.

### Chunk Streaming

- `ChunkWindow` and `VolumeChunkWindow` use one aligned grid with a 16-metre
  base size. Larger chunk levels are 32, 64, and 128 metres.
- Surface windows keep fixed X/Z squares; volumetric windows keep fixed X/Y/Z
  cubes. Crossing a boundary reassigns only the incoming edge or square face.
- Assignment revisions prevent delayed work from writing into a slot that has
  already moved elsewhere.
- `StreamQueue` has a fixed capacity of 256 jobs and a provisional 0.5 ms
  per-frame budget. Stable keys replace older pending work for the same slot.
- Terrain rows use one foundational priority. Ordinary content jobs wait until
  the supporting incoming ground edge is complete.

### Air Particles

- Every 64-metre volume deterministically generates 80 different particle
  positions from its absolute X/Y/Z coordinates.
- The Test Level's 180-metre camera range plus one preload ring produces a
  9 x 9 x 9 resident window with 729 reusable slots and 58,320 buffered points.
- All slots share one `THREE.Points` object, geometry, material, and fixed
  position and visibility buffers.
- Test Level candidates below `surfaceYAt(x, z)` plus 0.5 metres are clipped
  before rasterization. White World remains an unrestricted volume.
- Initial positions are written before the first render. Later recycling marks
  only the changed buffer ranges for upload.
- One vertex-shader time uniform gives every particle a subtle independent
  drift without per-frame position-buffer uploads.
- Module unload removes the object and disposes geometry and material.

### Scent Particles

- Scent has no positions of its own. Every resident 64-metre chunk replays the
  deterministic Vegetation placement for its area through the shared
  `PlantScentSource` contract, so every particle belongs to a plant that
  really stands there — the same plant the Connections web links.
- Six plant families carry one signature each (conifer, deciduous, birch,
  bush, flowering bush, dead wood). The family sets the color, the particle
  count, the emission volume in fractions of the plant's own height, and how
  far its scent lifts, so one signature fits a knee-high bush and a
  ten-metre pine.
- The scent layer needs a plant population, not a rendered one: a level that
  keeps its sources invisible authors `invisibleVegetation` instead of
  `vegetation`, exactly as `invisibleGround` keeps the surface.
- Slot capacity is the worst case the source can produce. The vegetation
  candidate grid is 8 metres, so a 64-metre chunk holds at most 64 plants;
  each slot is sized for that and packs the plants it actually holds into
  the front of its range, leaving the tail hidden.
- The Scent Level's 128-metre camera range plus one preload layer produces a
  7 x 7 resident window with 49 reusable slots in one `THREE.Points` object
  and one draw call. At the current dense trial values that is 219,520
  buffered points; `particlesPerPlant` per family is the one lever on it,
  and each family carries a moderate alternative beside it in the preset.
- A slot write is gathered once and then spent in bounded steps of 256
  particles, and uploaded only when the last step finishes, so a chunk
  crossing never spends thousands of particles in one frame slice and a slot
  is never half new on the GPU.
- Both layers drift on the shared turning wind of `src/world/wind.ts`,
  sampled once per frame and scaled by each layer's own authored reach. The
  wind clock runs separately from the 60-second animation clock, which would
  otherwise turn the wind back onto the same bearing every minute.
- Every particle now drifts on its own phase and amplitude instead of one
  phase derived from its resting position, which had made a cloud slide as a
  rigid block. Trail prints each walk away along their own bearing, faster
  than they age, so a route frays at its old end.
- Measured on one machine under software rendering (`bun run benchmark
  --profile quick`), the isolated Scent Level moved from 5.90 ms median frame
  time with the four-cloud layer to 7.20 ms at the moderate values, 14.10 ms
  at 40 particles for the largest family, and 14.80 ms at the 70 authored
  now. The cost is not linear in the particle count: the first jump cost
  eight milliseconds and nearly doubling the points again cost less than one.
  The dense values are a deliberate, recorded exception to the performance
  rule, kept for review rather than decided.
- Recycled chunk slots rewrite only their position, color, phase, rise, and
  visibility buffer ranges through the shared frame-budgeted stream queue;
  revisiting a chunk recreates the same scent.
- Live animals print their scent where they walk, at an authored rate per
  second, into one fixed ring drawn in a second opaque call. A print stays
  where it was left and ages against the same looping clock — lifting,
  widening, and thinning out — so the route the animal took becomes visible
  rather than a cloud that travels with it. One signature per species; the
  ring is allocated only where the Animals module runs, from level 05 on.
- One looping vertex-shader time uniform drives rise, sway, and a life-cycle
  point-size fade in both layers; fully faded points leave clip space and
  rasterize nothing. A rise duration that does not divide the 60-second loop
  evenly, and a trail lifetime above it, are rejected rather than shipped.
- A sense-intensity uniform (0..1) scales the fade; it is still authored
  through the preset. The Dramaturgy Runtime now supplies the show clock and
  schedule, but it drives narration only — per-sense envelopes are not built.
- One show fade uniform scales both layers together through the module
  handle's `setIntensity`, because the plant scent and the printed routes are
  one sense and a show must not leave half of it standing.
- Module unload removes the object and disposes geometry and material.

### Terrain

- Terrain uses 49 fixed 64-metre mesh slots with 32 segments per side in the
  current 180-metre Test Level view.
- Initial chunks are complete before activation. Recycled chunks sample one
  vertex row per stream job step into fixed staging arrays.
- A changed chunk is published atomically only after all rows are ready.
- Neighboring chunks sample identical absolute border coordinates instead of
  generating independent edges.
- Terrain writes `groundY`; it never raises river-bed vertices to the separate
  water `surfaceY`.
- Zone Visualizer maps all five `ZoneId` values to distinct diagnostic colors.
  Terrain stores four continuous conditions in one optional `vec4` attribute;
  the fragment shader classifies after interpolation. Visualization adds no
  meshes, textures, draw calls, or duplicate geometry.
- The height field combines rolling terrain, small detail, and broad hill
  swells behind a continuous region mask. The current authored seed contains
  calm lowlands, deep valleys, and densely undulating hill areas without
  discrete seams. The broad swells carry most of the height range while the
  rolling layer sets how often hills recur, so relief grows without the
  ground becoming steep.
- Terrain unload removes its group and disposes every geometry and its shared
  material.

### Grass

- Only the `test` and `design-test` diagnostic presets author a `grass`
  block. No narrative level does at present: grass is the densest
  near-camera surface in the world and Thermal Perception samples a
  four-octave noise field per fragment on every surface it decorates, so the
  pair is parked until that cost is measured. Everything below still
  describes the module, which is unchanged.
- Grass uses one fixed `InstancedBufferGeometry` with 25 reusable 64-metre
  slots: its own 64-metre range plus one preload ring. The range is a module
  constant, not the level view distance, so a level that sees 180 metres no
  longer drags the grass window out behind it.
- The current maximum meadow density produces 152,100 fixed candidates. Each
  candidate is one compact `vec4` and two crossed triangles.
- Absolute integer cells recreate stable roots. The level independently sets
  meadow and shrub-slope density and height. Candidates rejected by that zone
  density, water, or either forest remain in fixed ranges but are clipped
  before rasterization.
- Recycled slots use cooperative row jobs and partial instance-buffer uploads.
  Ordinary frames update only one wind-time uniform.
- Wind direction, strength, and speed come from the immutable `WORLD_WIND`
  configuration in `src/world/wind.ts`, the shared source for all wind-reactive
  components.
- Grass carries the three.js chunk anchors (`<common>`, `<project_vertex>`,
  and `<color_fragment>`) in its own GLSL, so the shared `UnlitMaterialEffect`
  patch decorates it exactly as it decorates a built-in material pass. The
  composition root decides which effects reach the grass material — Echo
  Depth and the Vegetation thermal variant, when a level authoring grass
  also authors those senses, which none currently does. Grass imports no
  sense module and its root-to-tip gradient stays its own base color below
  full sense intensity.
- Grass owns and disposes its mesh, geometry, material, and typed buffer.

### Vegetation and Rocks

- Both modules use deterministic candidates on separate 64-metre chunk windows.
  The level supplies only instances per hectare by zone; module definitions own
  variants, seed, candidate spacing, asset details, and target metre heights.
- Named GLTF objects may be a single Mesh or a Group. Every descendant Mesh is
  retained as an instanced model part with its authored transform.
- One fixed CPU slot pool stays allocated, while accepted placements are
  compacted into each `InstancedMesh`; rejected candidates therefore produce no
  vertex work.
- Vegetation excludes water and keeps each scaled asset footprint outside the
  analytical river edge. It selects sparse meadow growth, conifers, deciduous
  trees, or shrubs by zone. Rocks exclude water and become densest on shrub
  slopes.
- Forest density is currently 150 conifers or deciduous trees per hectare.
  Stable
  world-cell random values vary deciduous model, height, Y rotation, crown
  width, and crown depth without reshuffling during streaming.
- Cooperative row jobs replace recycled slots. Outgoing static content is
  hidden before Terrain can recycle its supporting ground; replacements appear
  only after both their own slot and the foundational Terrain jobs are complete.
  Each module owns and disposes its pool, mobile unlit materials, and preloaded
  source assets.

### Animals

- Deer, Stag, Fox, and Rat provide ten cloned actors in authored per-species
  counts with explicit allowed zones, walk clip, target metre height, and speed.
- Deterministic habitat search gives actors separate angular territories around
  the player, interleaves species, and chooses the nearest point allowed for
  each species. Simple movement follows `surfaceYAt()`, turns before a
  disallowed zone, and relocates actors outside the bounded active radius.
- The Test Level selects at most four actors from separate directions before
  filling vacant slots by distance. Animals do not import or query concrete
  sibling modules. Their animated mesh parts use the small population limit
  instead of stale static animation bounds.
- The same four visible actors derive a local surface normal from four nearby
  height samples. Their body follows the slope while its forward axis remains
  aligned with movement; hidden actors incur no orientation sampling cost.
- Unload stops mixers, releases clone skeletons, and disposes source assets.

### Magnetic Sense

- Magnetic Sense is the level-06 sense with two consumers sharing one
  field-direction and intensity uniform set: a terrain material effect and a
  sky-dome world module, returned together by `createMagneticSense` as
  `{ terrain, sky }`. Line, pulse, and sky glow colors are preset-authored
  like every other sense palette; the composition root skips the sense
  entirely at intensity zero.
- The terrain effect decorates Terrain's selected presentation material; it
  adds no geometry, texture, light, transparent layer, or draw call.
- Absolute world positions feed one analytical stream coordinate. Height warp
  bends the lines with the existing terrain and `fwidth` stabilizes their edge.
- Magnetic base lines blend at 20% opacity. Narrow bright pulses run strictly
  inside their boundaries in the same opaque fragment pass. Pixels outside the
  stripes retain their base ground color.
- The sky cue is one opaque back-side dome (120 m radius, `depthWrite` off,
  `renderOrder` −1, one added draw call) that follows the full camera
  position each frame. Its fragment shader shows the level haze everywhere
  except an analytic glow at the horizon toward the field direction — the
  same direction the ground pulses travel toward; the shared intensity
  uniform fades the glow back into the haze without transparency.
- Magnetic Sense never reaches Grass: the stripes stay a Terrain material
  effect, and the composition root does not put them in the grass effect
  list.

### Mycelium (Connections)

- Mycelium is the level-07 sense: one web world module returned by
  `createConnectionsModule`, blending over the unchanged carried world
  (no terrain material effect exists). Depth, pulse, and per-source node
  colors are preset-authored; the composition root skips the sense
  entirely at intensity zero.
- The web adds exactly two draw calls from fixed pools: instanced
  camera-facing cord envelopes (4096 rows, the first four reserved for
  animal links with nearest-node hysteresis) and pixel-capped node glow
  points (1280). Both are transparent with `depthWrite` off and
  `depthTest` on (motion-trail precedent), masked in-shader to the
  88-metre web radius and collapsed in the vertex stage beyond it. Each
  envelope renders three fine meandering filaments with periodic knot
  junctions procedurally in its fragment shader, so the web reads far
  denser than its actual node and edge counts; sub-pixel strands dim by
  coverage instead of widening.
- Node anchors cross module boundaries only through the shared
  `ConnectionNodeSource` / `ConnectionActorSource` contracts: vegetation
  and rocks replay their deterministic placements, the scent module keeps
  the forest clearing positions the finished web links, animals expose live
  visible-actor positions.
- Topology (kNN plus minimum spanning tree) runs in the repository's
  first Web Worker, owned by the module and reached through typed
  transferable messages; gathering runs as bounded stream-queue steps
  (one 32-metre chunk per step) and stale worker replies are discarded
  by an aggregate window generation.

### Echo Depth

- Echo Depth replaces the surface color of Terrain, Vegetation, and Rocks
  with one camera-distance palette ramp; it adds no geometry, texture,
  light, scene pass, or draw call.
- The vertex stage writes only the rotation-invariant camera-space radial
  distance; the effect uses no normals, so Terrain's deleted `normal`
  attribute needs no special handling.
- The fragment stage blends four smoothstep segments across the authored
  level-03 palette; the final intensity mix (0..1) fades the whole sense
  against the base color. Every surface shows only its depth-ramp color —
  a near-form rim accent was removed by an art decision.
- All patched programs share one uniform set. The composition root skips the
  effect entirely when the preset omits `echoDepth` or authors intensity
  zero, so an inactive sense costs no GPU work; a future runtime driver must
  deactivate rather than merely zero the uniform.

### Motion Sense

- Motion Sense is the level-04 content module: persistent fly swarms and
  invisible circling bird flocks whose movement prints motion-trail ring
  buffers, ported from the proven bm-base motion layer and rewritten from
  TSL to the repository's raw GLSL idiom. Each actor implements the
  module's `MotionPointSource` seam and prints into its own trail ring;
  bird bodies render nothing (perception-only actors, three points per
  bird with a deterministic wing flap).
- The fly simulation is a bounded boid integration: stepped hash noise for
  the insect jitter, eight strided flockmate samples per fly (never the full
  pairing), a boundary-free swarm envelope, and a hard clamp that guarantees
  no fly sinks below its terrain clearance. All placement and per-fly
  character values derive from stateless integer hashes; the module uses no
  `Math.random`.
- Each swarm gets its own irregular volume: hashed anisotropic axes and a
  yaw stretch and tilt the cloud, a few slowly drifting density lobes keep
  its core lopsided, and flies are seeded Gaussian around those lobes. The
  envelope is a spring written in that volume's normalized frame, and outside
  the core its hold relaxes into a gentle constant drift instead of
  stiffening, so the cloud dissolves outward over several core radii; a
  quadratic term far out is all that stops anything leaving for good. Each
  fly also carries a hashed binding — most sit near one and make the dense
  core, the loose few wander metres clear of it, alone or in twos and threes.
  No cloud has a straight edge or repeats another's silhouette, and the
  ground clamp is the only hard boundary left.
- Because strays now reach several metres out, that ground clamp tilts: five
  height-field samples per swarm per frame fit a plane under the anchor, and
  every fly is held above that plane rather than above the anchor's own
  height, so a stray over a hillside rides the slope. Measured against the
  authored height field this holds flies clear of terrain within 0.12 m,
  against 3.02 m of penetration when the floor was flat. The force curves
  keep distances squared wherever a square root is not needed, which pays for
  the extra sampling: the whole fly update measures ~110 µs per frame at the
  authored 720 flies, unchanged from before the swarm volumes existed.
- The trail ring holds `flyCount × lifetimeFrames` particles. The CPU writes
  only the newest ring slot per frame (immutable spawn position, outward
  direction, spawn intensity, and spawn frame) as one contiguous
  `addUpdateRange` per attribute; fading, drift, and collapse derive
  GPU-only from one advancing frame uniform. At the authored 720 flies and
  108 bird points with fourteen-frame trails this is roughly 35 KB of
  bounded uploads per frame and three added draw calls.
- The composition root skips the module entirely when the preset omits
  `motion` or authors intensity zero; omitting the `birds` block runs the
  flies alone. The exported `MotionPointSource` interface remains the seam
  for further moving actors without a bus or sibling import.

### Thermal Perception

- Thermal Perception is the level-05 material-effect family: one shared
  radius-and-palette uniform set (intensity, 60-metre viewer radius,
  20-metre feather, six-stop false-color ramp) with a per-consumer warmth
  source, and an authored share of the carried echo color stays visible on
  every sensed surface so the false color sits inside the grey world instead
  of replacing it. The radius is the camera-space view distance already used by
  Echo Depth, so the radius itself needs no camera uniform. The one
  per-frame input is the set of warm bodies (see local heat emission
  below); nothing else about the field changes over time.
- Warmth varies across every sensed surface, not only between surfaces.
  Terrain declares an optional `warmthAt` sampler on its material-effect
  contract: during row-bounded chunk streaming it samples elevation plus
  zone conditions per vertex (water coldest and colder with depth, dry
  ground warmer with elevation, forest and slope boosts) into one streamed
  float attribute. Vegetation and Rocks hash their quantized instance
  world position into a stable warmth variation around authored base
  values, then shade each object internally from its own base and axis in
  metres, so one authored gradient reads alike on a shrub and a tall tree.
- Animals take a per-mesh effect through the Animals module's `effectsFor`
  option: the module measures each cloned actor once and hands the effect
  the matrix mapping that mesh's local space onto normalized body space.
  The actor shader reads the posed vertex through that matrix and falls off
  from an authored body core, so a torso holds the hottest reading while
  legs, snouts, tails, and antlers cool with how far they reach away from
  it. The falloff is authored in fractions of each actor's own height, so
  one core fits every species without per-species values.
- One organic texture then varies the warmth of every sensed surface. The
  fragment stage sums several octaves of value noise, spanning roughly nine
  metres down to a third of one so a wide surface varies at its own size and
  still breaks into fine grain close to, each turned by an
  orthonormal rotation and stepped by a non-integer factor so no grid,
  checkerboard, or repeat can form; sampling per fragment keeps the detail
  independent of mesh density. Ground, plants, and rocks sample it in world
  space; animals sample it in body space at a feature size expressed as a
  share of body height, so it travels with the animal and reads alike on
  every species. Each consumer authors its own texture depth, and the shader
  eases the texture off above an authored quiet warmth so body cores keep a
  defined shape. Fragments outside the radius return the carried color before
  the texture or the ramp is evaluated.
- Living bodies warm what stands around them. The Animals module reports its
  visible actors after every update through an optional `onBodiesUpdated`
  observer — position, heading, and body height, in an array it refills in
  place so a settled population allocates nothing — and the composition root
  hands that straight to Thermal Perception's `setHeatSources`. Animals still
  knows nothing about the heat view; it reports animal facts. The effect
  packs each body as an oriented segment on its own axis and every sensed
  surface adds the radiated warmth on top of its own reading, so ground
  inside a pool keeps its variation, the pool lies along the animal and turns
  with it rather than ringing it, its shape is pulled out of symmetry by the
  texture field, and its gaussian tail spreads over several times the
  animal's own height without ever reaching a distance where it stops, so no
  boundary can read as a ring. A
  living body does not radiate onto itself. The source count is bounded by
  the module and injected into the shared fragment stage as a compile-time
  array size.
- Every reading a surface computes for itself is folded into the warmth band
  its material belongs to, with both ends approached asymptotically inside a
  soft knee, so no surface leaves the range its substance would occupy and
  none piles into a plateau at the edge of it. The bands carry the material
  hierarchy: ground and rock stay in the violet-to-cyan end, plants reach
  magenta and orange where they are exposed, and only living bodies own the
  hottest colors. Terrain's own elevation, forest, and slope mapping is scaled
  to that end rather than left to the band to catch, and warmth radiated by a
  nearby body is added after the band, the one thing that may carry a surface
  past its own range.
- A per-consumer contrast curve then gives each surface its definition. It is
  monotone and smooth, fixing cold, an authored pivot, and full heat in place
  while steepening in between, so readings that differ separate further and
  neither end clips; there is no plateau anywhere that could posterize into a
  band and no edge detection that could draw an outline. Each pivot sits on
  the warmth that consumer's own readings cluster around, and the curve acts
  on the finished reading, so body cores, radiated pools, and surface texture
  all sharpen from the same temperature difference.
- The composition root orders thermal first in every effect list because
  the first-applied patch executes last and wins the final surface color
  (documented in the shared `material-shader-patch.ts` helper, which all
  three material effects now use); the carried echo ramp shows through
  outside the radius and at the feathered edge. The root skips the effect
  entirely when the preset omits `thermal` or authors intensity zero, so
  an inactive sense costs no GPU work and no warmth attribute.

## Runtime Assets

`public/animals` contains four animated animal GLBs, `public/trees` contains
eight tree and shrub GLBs, and `public/rocks` contains four rock GLBs. Animal
and tree manifests record source URLs, CC0 attribution, checksums, and
available model structure. The rock manifest records source URLs and checksums;
its selected object names remain in the Rocks definition. Runtime URLs match the
Vite public paths.

Level Runtime loads only the fixed assets owned by enabled module definitions.
URLs are deduplicated within each module's request set before World Runtime starts.
Manifests remain metadata rather than a parallel runtime configuration system.

## Verification

The last clean verification recorded:

- `bun test`: 153 tests
- `bun run check`: strict TypeScript
- `bun run lint`: clean Biome run
- `bun run build`: Vite production build, including the emitted
  `topology.worker` chunk
- `bun run benchmark`: replays the fixed route and writes a report
  artifact; its counters were confirmed identical across repeated runs

Fallow reports no dead production exports or complexity violations, but
does report known duplicated placement code in Vegetation and Rocks and
the deliberate data duplication between the sparse level presets that
carry earlier sense layers verbatim (`scent`, `echo`, `motion`,
`thermal`, `magnetic`, `connections`). The formerly parallel shader-patch idiom of Magnetic Sense and
Echo Depth was extracted into the shared `material-shader-patch.ts` helper
when Thermal Perception arrived as the third material effect.

Vegetation and Rocks share deterministic density acceptance and weighted asset
selection. Their transform and placement policies remain module-local.

The 2026-08-24 short desktop Chromium settling smoke loaded every configured GLB with
HTTP 200 and produced no console errors or warnings. The initial settling view
reported 89–93 FPS, 16.8–17.1 ms p95, 61 draw calls, and 5.90 million rendered
triangles. This is diagnostic evidence, not a physical PICO acceptance result;
the separate performance audit contains the more demanding repeated browser
measurements. No 72 Hz or 90 Hz headset claim is approved.

The production build succeeds and retains the known warning that its main
JavaScript chunk is larger than 500 kB. Code splitting remains deferred until
loading or target-device evidence requires it.

## Not Part of the Current Build

- passthrough, `immersive-ar`, operator control, and presentation transitions
- normalized device-independent navigation and ICAROS input
- complete Test Level training flow and narrative state transitions
- floating origin, LOD, relevance fields, and spatial instance pools
- asset prefetching, retries, progress UI, and distance-based stream priorities
- visible water, other perception effects, mycelium, sky additions, and sound
  modules
- wind-coupled scent drift, scent fields, scent fading into the echo haze
  with distance, scent for animals in the levels that carry no Animals
  module, and a runtime scent-intensity driver

## Recommended Next Steps

Current and remaining landscape boundaries are recorded in
[Landscape Module Contracts](landscape-modules.md).

1. Render visible water from the existing river and surface facts.
2. Add terrain textures without replacing the current fixed mesh pool.
3. Add a deterministic benchmark route and validate the expanded landscape on
   desktop and physical PICO hardware.
4. Add LOD or offline asset optimization only if PICO evidence requires it.
