<!--
Purpose: Record the verified implementation state of Becoming Many.
Context: The project has moved from initial planning into a working landscape test MVP.
Responsibility: Summarize what exists, what is verified, and what should happen next.
Boundary: Product vision and long-term design remain in the specialized documents.
-->

# Current Development Status

Snapshot: 2026-08-28

The current `src/` and `public/` trees are the source of truth. This page is
the concise entry point for the current implementation.

## Runnable Result

`bun run dev` starts a Vite application that shows the Thermal Perception
level:

- the complete Motion Perception world carried over unchanged: the warm
  off-white haze background, the grayscale Echo Depth ramp on Terrain,
  Vegetation, and Rocks, the earlier air and scent layers, and the fly
  swarms, bird flocks, and printed motion trails, because senses layer
  instead of swapping
- a false-color heat view inside a 30-metre viewer radius that feathers
  over 10 metres back into the grayscale world: water reads coldest and
  colder with depth, dry ground warms with elevation, forest and slope
  hold extra warmth, and every plant and rock keeps a stable hashed
  temperature variation across restreaming
- the bounded animal population joining the world as the strongest heat
  signatures: warm bodies read in the hot magenta-to-yellow palette bands
  inside the radius and sit in the echo grayscale outside it
- the diagnostic test overlay
- pointer-lock mouse look
- WASD and arrow-key flight along the mouse look direction
- a user-triggered Three.js `immersive-vr` button

The application currently selects `thermal.level.ts` in its minimal browser
entry. It has one Level Runtime composition root and one render loop. The
Motion Perception level remains available by selecting `motion.level.ts`
instead, the Echolocation level by selecting `echo.level.ts`, the Scent
World base experiment by selecting `scent.level.ts`, and the Design Test
landscape by selecting `designTest.level.ts`.

## Implemented System

### Runtime

- `src/main.ts` only selects the active level and calls `startLevel()`.
- `level-runtime.ts` preloads fixed assets for enabled modules, applies the sparse preset,
  creates only enabled modules, and connects desktop controls.
- `world-runtime.ts` owns the Three.js scene, perspective camera, WebGL
  renderer, timer, resize handling, module runtime, stream queue, and one
  `renderer.setAnimationLoop()`. It does not import level or concrete module
  code.
- `webxr-entry.ts` enables WebXR and adds Three.js `VRButton` for
  `immersive-vr` sessions.
- Every frame updates desktop movement, active modules, bounded stream work,
  and then renders once.

### Levels and Modules

- `LevelPreset` is sparse: a level defines only the values and optional module
  parameters it needs.
- `white-world.level.ts` defines a white background, a 128-metre view distance,
  and Air Particles parameters without Terrain.
- `scent.level.ts` is the Scent World base experiment: a pale warm background,
  a 128-metre view distance, the test overlay, Scent Particles, the unchanged
  White World Air Particles layer, and the invisible ground flag.
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
- The sparse `invisibleGround: true` flag clamps flight above the shared
  deterministic world surface without creating the Terrain module or any
  rendered geometry.
- `test.level.ts` uses a 180-metre view distance, activates
  Terrain, Grass, Vegetation, Rocks, and Animals, selects Zone Visualizer as
  the Terrain presentation, and adds Magnetic Sense as a material effect.
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
  to Animals and to per-consumer warmth sources.

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

- Every resident 64-metre chunk deterministically tries a bounded candidate
  search for up to two emitters from its absolute coordinates and keeps only
  candidates inside the module-owned source zones (conifer and deciduous
  forest); misses stay hidden in their fixed particle range and never
  rasterize.
- Kept emitters anchor 1–2 metres above the sampled world ground as flat
  clouds (one-metre vertical extent, gentle rise), each with one signature
  color from the level palette.
- The Scent Level's 128-metre camera range plus one preload layer produces a
  7 x 7 resident window with 49 reusable slots and 18,816 buffered points in
  one `THREE.Points` object and one draw call.
- Recycled chunk slots rewrite only their position, color, phase, and
  visibility buffer ranges through the shared frame-budgeted stream queue;
  revisiting a chunk recreates the same emitters.
- One looping vertex-shader time uniform drives rise, sway, and a life-cycle
  point-size fade; fully faded points leave clip space and rasterize nothing.
- A sense-intensity uniform (0..1) scales the fade; it is authored through the
  preset because the runtime schedule driver remains an open decision.
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
- The height field combines rolling terrain, small detail, and mountain ridges
  behind a continuous region mask. The current authored seed contains calm
  lowlands, deep valleys, and mountain areas without discrete seams.
- Terrain unload removes its group and disposes every geometry and its shared
  material.

### Grass

- Grass uses one fixed `InstancedBufferGeometry` with 81 reusable 64-metre
  slots, including one preload ring around the 180-metre view distance.
- The current maximum meadow density produces 492,804 fixed candidates. Each
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

- Magnetic Sense decorates Terrain's selected presentation material; it adds no
  geometry, texture, light, transparent layer, or draw call.
- Absolute world positions feed one analytical stream coordinate. Height warp
  bends the lines with the existing terrain and `fwidth` stabilizes their edge.
- Magnetic base lines blend at 20% opacity. Narrow bright pulses run strictly
  inside their boundaries in the same opaque fragment pass. Pixels outside the
  stripes retain their base ground color.
- Grass remains visually and architecturally independent.

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
  radius-and-palette uniform set (intensity, 30-metre viewer radius,
  10-metre feather, six-stop false-color ramp) with a per-consumer warmth
  source. The radius is the camera-space view distance already used by
  Echo Depth, so the effect needs no camera uniform and no per-frame
  update; the field is fully static.
- Terrain declares an optional `warmthAt` sampler on its material-effect
  contract: during row-bounded chunk streaming it samples elevation plus
  zone conditions per vertex (water coldest and colder with depth, dry
  ground warmer with elevation, forest and slope boosts) into one streamed
  float attribute. Vegetation and Rocks hash their quantized instance
  world position into a stable warmth variation around authored base
  values; Animals gained the shared `effects` option and carry one
  constant near-hot warmth.
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

- `bun test`: 119 tests
- `bun run check`: strict TypeScript
- `bun run lint`: clean Biome run
- `bun run build`: Vite production build

Fallow reports no dead production exports or complexity violations, but
does report known duplicated placement code in Vegetation and Rocks and
the deliberate data duplication between the sparse level presets that
carry earlier sense layers verbatim (`scent`, `echo`, `motion`,
`thermal`). The formerly parallel shader-patch idiom of Magnetic Sense and
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
- complete Test Level training flow, audio timeline, and narrative state transitions
- floating origin, LOD, relevance fields, and spatial instance pools
- asset prefetching, retries, progress UI, and distance-based stream priorities
- visible water, other perception effects, mycelium, sky additions, and sound
  modules
- wind-coupled scent drift, scent fields, emitters that move while placed,
  scent for non-forest zones or animals, and a runtime scent-intensity driver

## Recommended Next Steps

Current and remaining landscape boundaries are recorded in
[Landscape Module Contracts](landscape-modules.md).

1. Render visible water from the existing river and surface facts.
2. Add terrain textures without replacing the current fixed mesh pool.
3. Add a deterministic benchmark route and validate the expanded landscape on
   desktop and physical PICO hardware.
4. Add LOD or offline asset optimization only if PICO evidence requires it.
