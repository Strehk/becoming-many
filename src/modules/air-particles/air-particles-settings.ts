/**
 * Purpose: Define the complete configuration of the Air Particles effect.
 * Context: Levels author presentation and motion while the module owns bounded streaming.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Geometry, materials, shaders, lifecycle, and stream scheduling stay elsewhere.
 */

export const AIR_PARTICLES_SETTINGS = {
  defaultShape: "square", // Keeps the unmodified PointsMaterial fragment path unless a circle is requested.
  volumeChunkLevel: 2, // Selects 64-metre chunks on the shared world grid.
  preloadLayerCount: 1, // Prepares one volume layer beyond the visible radius.
  surfaceClearanceMeters: 0.5, // Keeps animated particles safely above sampled ground.
  animationLoopSeconds: 60, // Bounds the time uniform without per-frame buffer updates.
} as const;

export type AirParticleShape = "square" | "circle";

/** Level-authored density, appearance, and motion values. */
export interface AirParticlesParameters {
  readonly density: {
    readonly particlesPerChunk: number;
  };
  readonly appearance: {
    readonly color: number;
    readonly sizeMeters: number;
    readonly shape?: AirParticleShape;
  };
  readonly motion: {
    readonly horizontalAmplitudeMeters: number;
    readonly verticalAmplitudeMeters: number;
    readonly speedMultiplier: number;
  };
}
