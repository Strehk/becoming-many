/**
 * Purpose: Define the complete configuration of the Connections sense.
 * Context: Levels author web reach, palette, and sources while the module owns bounded streaming.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Geometry, materials, shaders, topology, and lifecycle stay elsewhere.
 */

export const MYCELIUM_SETTINGS = {
  chunkLevel: 1 as const, // Selects 32-metre chunks on the shared world grid.
  // A 7x7 window guarantees coverage out to exactly three chunks from the
  // viewer, which the validated web radius never exceeds.
  windowChunkRadius: 3,
  neighborsPerNode: 2, // Nearest-neighbor edges on top of the spanning backbone.
  // Fixed staging and GPU pool bound for one window: dense forest peaks
  // near 830 anchors across the 5.0 resident hectares.
  nodeCapacity: 1280,
  edgeCapacity: 4096, // Spanning plus neighbor edges with headroom.
  animalLinkCapacity: 4, // Mirrors the Animals visibility budget.
  edgeLiftMeters: 0.05, // Cord height above ground; avoids terrain z-fighting.
  // Strands fade out across this band inside the web radius, so the far rim
  // dissolves instead of ending on a circle.
  webFadeBandMeters: 12,
  // The ribbon is an invisible envelope; the fragment shader draws three
  // fine filaments meandering inside it, so one real edge reads as a strand
  // bundle without extra instances or draw calls.
  edgeBaseWidthMeters: 0.14,
  edgeWeightWidthSpanMeters: 0.1,
  // Filament half width as a fraction of the envelope half width; roughly
  // five-millimetre visible strands at the default envelope.
  filamentWidthFraction: 0.06,
  // Longitudinal strip subdivisions letting the centerline wobble; 25 slim
  // quads per cord in the same single instanced draw call.
  edgeSegments: 25,
  wobbleAmplitudeMeters: 0.5,
  pulseLengthFraction: 0.25, // Pulse band length as a fraction of its edge.
  // Hallucinated in-between junctions: one bright knot per this many metres
  // of cord stands in for nodes that do not exist in the topology.
  knotSpacingMeters: 2.5,
  nodeBaseSizeMeters: 0.22,
  nodePixelScale: 300, // Perspective point attenuation numerator.
  // Keep a retargeted animal link while its node stays within this factor of
  // the nearest one, so links do not flicker between equidistant nodes.
  animalLinkHysteresis: 1.25,
  animationLoopSeconds: 60, // Bounds the time uniform like the other senses.
} as const;

/** How one participating world-element class appears in the web. */
export interface ConnectionSourceStyle {
  readonly nodeColor: number;
  /** Relative pull in topology weighting and overflow priority, 0..1. */
  readonly weight: number;
}

/** Omitted classes do not participate in the web. */
export interface ConnectionsSources {
  readonly vegetation?: ConnectionSourceStyle;
  readonly scentEmitters?: ConnectionSourceStyle;
  readonly animals?: ConnectionSourceStyle;
  readonly rocks?: ConnectionSourceStyle;
}

export interface ConnectionsColors {
  /** Deep tone shading the cord midpoints toward the underground. */
  readonly depthColor: number;
  /** Traveling light pulses on the cords. */
  readonly pulseColor: number;
}

/** Level-authored strength, web reach, pulse motion, sources, palette. */
export interface ConnectionsParameters {
  /** Sense strength 0..1; the composition root skips the sense at zero. */
  readonly intensity: number;
  /** The web is visible inside this viewer-centred radius. */
  readonly webRadiusMeters: number;
  readonly pulseSpeedMetersPerSecond: number;
  readonly sources: ConnectionsSources;
  readonly colors: ConnectionsColors;
}
