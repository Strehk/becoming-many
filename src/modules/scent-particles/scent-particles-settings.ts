/**
 * Purpose: Define the complete configuration of the Scent Particles effect.
 * Context: Levels author one signature per species while the module owns bounded streaming.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Geometry, materials, shaders, lifecycle, and stream scheduling stay elsewhere.
 */

import type { PlantScentGroupId } from "../scent-sources";

export const SCENT_PARTICLES_SETTINGS = {
  chunkLevel: 2, // Selects 64-metre chunks, the grid Vegetation is placed on.
  preloadLayerCount: 1, // Prepares one chunk layer beyond the visible radius.
  animationLoopSeconds: 60, // Bounds the time uniform; rise durations must divide it evenly.
  defaultIntensity: 1, // Full strength unless a running show supplies its fade.
} as const;

/**
 * One plant family's scent. The emission volume is authored in fractions of
 * the plant's own height, so one signature fits a waist-high bush and a
 * ten-metre pine without the level restating a size per model.
 */
export interface PlantScentSignature {
  readonly color: number;

  /**
   * Particles one plant of this group emits. This is the density lever and
   * the frame cost: the streamed window holds up to 64 plants per 64-metre
   * chunk across 49 chunks, and the largest value here sizes every slot.
   */
  readonly particlesPerPlant: number;

  /** Emission band along the plant, 0 at its foot and 1 at its crown tip. */
  readonly emissionBottomFraction: number;
  readonly emissionTopFraction: number;

  /** Emission radius around the plant axis, as a fraction of its height. */
  readonly emissionRadiusFraction: number;

  /**
   * How far one particle of this plant lifts over its life. It is authored
   * per family rather than once for the layer because a bush releasing its
   * scent as high as a pine would visibly leave the plant it belongs to.
   */
  readonly riseHeightMeters: number;
}

/** One animal species' scent, printed along the route it actually walks. */
export interface AnimalScentSignature {
  readonly color: number;
}

/** The scent trail live actors leave behind them. */
export interface AnimalScentParameters {
  /** Keyed by the species ids of the Animals definition. */
  readonly signatures: Readonly<Record<string, AnimalScentSignature>>;

  /** Prints per animal per second; with the lifetime this sizes the ring. */
  readonly printsPerSecond: number;

  /** How long one printed particle stays; never above the animation loop. */
  readonly lifetimeSeconds: number;

  /** Print volume around the animal, in fractions of its own height. */
  readonly emissionBottomFraction: number;
  readonly emissionTopFraction: number;
  readonly emissionRadiusFraction: number;

  /** How far a printed particle drifts up over its whole life. */
  readonly riseHeightMeters: number;

  /**
   * Metres the shared wind carries a print across its whole lifetime, at
   * wind strength 1. The route's old end is carried furthest, so a trail
   * leans and frays downwind instead of lying still.
   */
  readonly windResponseMeters: number;
}

/** Level-authored signatures, appearance, and drift values. */
export interface ScentParticlesParameters {
  /** One signature per plant family; every family must be authored. */
  readonly plants: Readonly<Record<PlantScentGroupId, PlantScentSignature>>;

  /** Omitted where a level carries no animals, as levels 02 to 04 do. */
  readonly animals?: AnimalScentParameters;

  readonly appearance: {
    readonly sizeMeters: number;
    readonly intensity?: number;
  };
  readonly motion: {
    /** Must divide the animation loop evenly or the loop visibly jumps. */
    readonly riseDurationSeconds: number;
    readonly driftAmplitudeMeters: number;
    readonly speedMultiplier: number;

    /**
     * Metres the shared wind carries a plant's scent across one particle
     * life, at wind strength 1. Small values let the scent lean off its
     * plant; large ones tear it away and the plant stops being findable.
     */
    readonly windResponseMeters: number;
  };
}
