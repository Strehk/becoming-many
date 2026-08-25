/**
 * Purpose: Define the complete configuration of the Scent Particles effect.
 * Context: Levels author density, palette, and motion while the module owns bounded streaming.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Geometry, materials, shaders, lifecycle, and stream scheduling stay elsewhere.
 */

import type { ZoneId } from "../../world-surface/zone-settings";

export const SCENT_PARTICLES_SETTINGS = {
  chunkLevel: 2, // Selects 64-metre chunks on the shared world grid.
  preloadLayerCount: 1, // Prepares one chunk layer beyond the visible radius.
  animationLoopSeconds: 60, // Bounds the time uniform; rise durations must divide it evenly.
  defaultIntensity: 1, // Full sense strength until a dramaturgy driver exists.
  // Scent sources exist only where trees grow.
  sourceZones: ["coniferForest", "deciduousForest"] satisfies readonly ZoneId[],
  placementAttemptsPerEmitter: 4, // Bounded candidate retries improve forest-edge coverage.
} as const;

/** Level-authored palette, density, pool size, appearance, and drift values. */
export interface ScentParticlesParameters {
  /** Signature colors; every generated emitter deterministically picks one. */
  readonly colors: readonly number[];
  readonly placement: {
    /** Upper bound; emitters whose candidates miss every forest stay hidden. */
    readonly emittersPerChunk: number;

    /** Emitter anchor height range above the sampled world ground. */
    readonly minHeightMeters: number;
    readonly maxHeightMeters: number;
  };
  readonly emission: {
    readonly particlesPerEmitter: number;

    /** Horizontal cloud scatter around the emitter anchor. */
    readonly cloudRadiusMeters: number;

    /** Full vertical cloud extent; small values keep clouds flat and grounded. */
    readonly cloudHeightMeters: number;
  };
  readonly appearance: {
    readonly sizeMeters: number;
    readonly intensity?: number;
  };
  readonly motion: {
    readonly riseHeightMeters: number;
    readonly riseDurationSeconds: number;
    readonly driftAmplitudeMeters: number;
    readonly speedMultiplier: number;
  };
}
