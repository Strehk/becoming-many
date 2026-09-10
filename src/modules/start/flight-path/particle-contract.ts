import type { PointsMaterial, Vector3 } from "three";

// 1. Public particle settings
/**
 * Inclusive endpoints; equal values disable variation.
 * Density and size require 0 <= from <= to. Color endpoints may be in either order.
 */
export interface ParticleRange {
  readonly from: number;
  readonly to: number;
}

export interface PathParticleParameters {
  /** Particles per meter, sampled per one-meter section; section counts round down. */
  readonly densityPerMeter: ParticleRange;
  /** Positive diameters in meters; each particle receives one stable sample. */
  readonly sizeMeters: ParticleRange;
  /** Two sRGB hex colors (0xRRGGBB), interpolated in linear RGB per particle. */
  readonly color: ParticleRange;
  /** Maximum scatter on each axis, in meters, before wind animation. */
  readonly spreadMeters: number;
  /** Integer seed; identical inputs reproduce the same particle attributes. */
  readonly seed: number;
}

// 2. Borrowed route
/** A finite route, independent of its particle representation. */
export interface FlightRoute {
  readonly lengthMeters: number;
  /** Write the local-space centerline position into target; distance is in [0, length]. */
  readonly sample: (distanceMeters: number, target: Vector3) => void;
}

// 3. Material lifetime
/** The caller disposes the material; update advances only GPU animation uniforms. */
export interface PathParticleMaterial {
  readonly pointsMaterial: PointsMaterial;
  readonly update: (deltaSeconds: number) => void;
}
