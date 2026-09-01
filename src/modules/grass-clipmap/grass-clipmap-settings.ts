/**
 * Purpose: Define the complete configuration of the clipmap grass field.
 * Context: The layout, density law, and shader tiers come measured from the source demo.
 * Responsibility: Keep the public preset contract and the ported tuning values discoverable.
 * Boundary: Geometry, uniforms, streaming, and lifecycle stay elsewhere.
 */

export const GRASS_CLIPMAP_SETTINGS = {
  /**
   * Concentric rings of square chunks around the camera. Level 0 carries the
   * smallest chunks; every further level doubles the edge length and encloses
   * the previous one as a ring, so covered area grows exponentially while the
   * chunk count grows linearly.
   */
  layout: {
    /**
     * Chunks per level edge is twice this. Must stay even: only then is each
     * level's start index even, and only then do its edges fall on the grid of
     * the next coarser level. An odd value drops the inner hole into the
     * middle of a chunk, which tears gaps or draws an area twice.
     */
    ring: 4,
    /**
     * One level, which is what the source demo actually runs. Its page calls
     * `applyPreset("Performance")` on load, so the constructor defaults never
     * reach the screen: ring 4, one level, 187-metre coverage, 47-metre
     * chunks, and the 17 to 19 draw calls that layout is known for.
     *
     * A single level snaps to the fine grid instead of the doubled one,
     * because it has no coarser level to align its edges with. That lifts the
     * guaranteed margin from `(ring - 2)` to `(ring - 1)` chunks, which is
     * what makes this coverage reach far enough.
     *
     * Measured here, the coarse layout costs frame time for the draw calls it
     * saves: four levels with 8-metre chunks ran 159 draw calls at 6.6 ms p95
     * against 97 at 9.9 ms for one level with 44-metre chunks, because coarse
     * chunks allocate for their nearest edge across a far larger area. The
     * demo's layout is authored here anyway, on the author's instruction and
     * because it is the configuration the look was judged in.
     */
    levels: 1,
    /**
     * Half the edge length of level 0 in metres; the chunk size follows as
     * `coverage0 / ring`. Chosen so the guaranteed margin below covers the
     * fade-out distance — otherwise the field ends on a straight line instead
     * of dissolving into the haze. The demo's own rule is
     * `coverage0 = viewDistance * ring / (ring - 1)`, which at this world's
     * 128-metre view distance gives 171: chunks of 43 m and a margin of
     * exactly 128 m.
     */
    coverage0Meters: 171,
  },

  /**
   * Density falls with the square of the distance:
   * `D(d) = density0 * min(1, (fullDensityRadius / d))^2`.
   * Every level allocates what the law demands at its inner edge; the shader
   * thins the rest continuously by rank, so level borders carry no step.
   */
  density: {
    /**
     * Allocation steps per chunk, in quarters. Downward keeps a distant chunk
     * from starting as many instances as one in front of the camera only to
     * discard them.
     *
     * A single upward step covers the case where grid snapping brings a level
     * closer to the camera than its nominal inner edge, so the law demands
     * more there than the level allocated. Exactly one: two would push the
     * base allocation past the instance ceiling, and the resulting clamp
     * would break the exact factor-of-four progression that keeps the same
     * blades alive across a step change. A single-level layout needs none,
     * because level zero has no inner edge — it allocates full density and
     * the law never asks for more.
     */
    stepsUp: 0,
    stepsDown: 3,
    /**
     * Width of the thinning transition, relative to the surviving fraction.
     * A blade crossing the threshold shrinks to zero across this band instead
     * of vanishing; because the instances are low-discrepancy distributed, the
     * band dissolves spatially instead of travelling as a visible edge.
     */
    dissolve: 0.68,
    /**
     * Blade scatter, in multiples of the true mean spacing. Below 1.0 a blade
     * can never pass its neighbours and the allocation grid stays legible; the
     * scatter is what makes the field look grown rather than planted. Measured
     * free: 0.95, 1.6, and 2.5 all cost the same.
     */
    jitter: 1.6,
  },

  /**
   * Blades shrink to zero height between these distances rather than
   * disappearing, and chunks beyond the end are not drawn at all.
   *
   * This is the strongest single dial in the module — stronger than density,
   * segment count, and layout together. Measured on the quick profile,
   * Thermal Perception, with everything else at the source demo's settings:
   *
   *   128 m: 6.42 M triangles,  9.4 ms median, 14.9 ms p95, 74 missed frames
   *    90 m: 6.02 M triangles,  8.1 ms median, 13.6 ms p95, 55 missed frames
   *    60 m: 5.16 M triangles,  6.5 ms median, 12.1 ms p95, 21 missed frames
   *    40 m: 4.18 M triangles,  4.2 ms median,  8.0 ms p95,  1 missed frame
   *    20 m: 3.42 M triangles,  3.1 ms median,  6.7 ms p95,  0 missed frames
   *
   * An earlier measurement found no effect here and was wrong: it shrank the
   * coverage along with the fade, which kept the chunk count constant and
   * only dropped the far chunks the density law had already emptied.
   */
  fade: {
    startMeters: 24,
    endMeters: 60,
  },

  /**
   * Segments per blade and the distances where each takes over. The lowest
   * step is two segments, not one: a single triangle across the full blade
   * height is a long diagonal splinter whose bounding box the rasterizer walks
   * in quads, which measured 60 % slower than two segments despite three times
   * less geometry.
   */
  detail: {
    segments: [4, 3, 2, 2],
    /**
     * Used when distance detail is off, which is the default. Index 2 is two
     * segments, the lowest step there is — measured here as 2.31 M triangles
     * against 2.65 M for three, worth roughly 0.2 ms p95 at full density and
     * 0.5 ms at half. Two is also the floor for a reason the source demo
     * measured: one segment is a long diagonal splinter whose bounding box
     * the rasterizer walks in quads, and it came out 60 % slower than two
     * despite three times less geometry.
     */
    uniformSegmentIndex: 1,
    switchDistanceMeters: [9, 20, 50],
    /** Keeps a chunk sitting exactly on a threshold from flickering. */
    hysteresis: 1.12,
    /**
     * Distance detail only pays off while chunks are small against the switch
     * distances. At the sizes this layout uses, a whole chunk takes the detail
     * of its nearest edge and the switch changes a large area at once —
     * measured slower and visibly jumping, so it stays off.
     */
    byDistance: false,
    /** Shader tier per detail step; distant blades drop the invisible work. */
    tierOfDetail: [0, 0, 1, 2],
  },

  /**
   * The travelling gust wave. Direction and strength arrive from the shared
   * `WORLD_WIND`, as they must for every wind-reactive module; the wave that
   * carries them across the field is this module's own.
   */
  wind: {
    /** Radians per second the gust phase advances. */
    phaseSpeed: 1.35,
    /** Radians per metre along the wind direction. */
    phaseScalePerMeter: 0.055,
    /** Brings the shared wind strength onto the blade-bend scale. */
    strengthScale: 0.375,
  },

  /**
   * Instances per chunk are two to this power, squared. The ceiling has to
   * clear the largest allocation any level asks for, including its one upward
   * density step; the whole scene shares this single buffer.
   */
  instanceGridBits: 8,

  /**
   * The frustum test runs on the blade's real root, so this only has to cover
   * what the root does not know about itself: its own height and the scatter
   * that moved it off its cell. Testing a flat probe at ground level zero
   * instead would need a radius covering the world's whole elevation range,
   * and getting that wrong cuts a circle of bare ground around the viewer —
   * the angular error of a vertical offset is largest where blades are
   * nearest.
   */
  cullRadiusMeters: 3,

  /** Blade shape and the anti-aliasing floor that keeps distant blades stable. */
  blade: {
    /** Base bend of the blade; long blades hang further than short ones. */
    curve: 0.52,
    /**
     * Minimum angular width. Near blades keep their true width; beyond a
     * distance they inflate to this angle instead of falling below pixel size,
     * which is what makes thin grass shimmer.
     */
    minAngularWidth: 0.0022,
    /**
     * A second strip across the first. The per-blade work spreads over twice
     * the geometry, and a tuft stays visible from every direction instead of
     * nearly vanishing edge-on.
     */
    cross: true,
  },

  /**
   * Diagnostic lighting, carried from the source demo. The grass is lit while
   * every other module in this world is unlit, which is exactly why it lives
   * in its own level: wiring it into the sense layer is the next step and will
   * replace this block.
   */
  lighting: {
    sunDirection: [0.4, 0.4, 0.8],
    sunColor: 0xfff0d4,
    skyColor: 0x7ba6d6,
    ambientOcclusion: 0.74,
    translucency: 0.9,
    exposure: 1.06,
    fogDensity: 0.011,
  },

  /**
   * The camera-following height field that replaces the source demo's
   * analytical terrain. See `grass-height-field.ts` for why it exists.
   */
  heightField: {
    /** Matches Terrain's own vertex spacing: 64-metre chunks, 32 segments. */
    texelMeters: 2,
    /** 192 texels at 2 m is a 384-metre window, so ±192 m around its centre. */
    sizeTexels: 192,
    /** Re-centre once the camera has left this radius around the centre. */
    recenterMeters: 32,
    /** Rows filled per cooperative stream step while re-centring. */
    rowsPerStep: 8,
  },

  /** Grass strength per world-surface zone; every other zone stays bare. */
  zoneCoverage: {
    meadow: 1,
    shrubSlope: 0.45,
  },
} as const;

/** Level-authored palette of the grass field. */
export interface GrassClipmapColors {
  readonly rootColor: number;
  readonly tipColor: number;
}

/** Level-authored density, blade dimensions, and palette. */
export interface GrassClipmapPreset {
  /** Tufts per square metre inside the full-density radius. */
  readonly tuftsPerSquareMeter: number;
  /**
   * Radius of full density; beyond it the count falls with one over distance
   * squared. Inside it every blade stands at full size without a transition.
   */
  readonly fullDensityRadiusMeters: number;
  /** Exact maximum blade height, not a nominal value scatter multiplies. */
  readonly bladeHeightMeters: number;
  readonly bladeWidthMeters: number;
  readonly colors: GrassClipmapColors;
}
