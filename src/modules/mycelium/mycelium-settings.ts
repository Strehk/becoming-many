/**
 * Purpose: Define the complete configuration of the Connections sense.
 * Context: Levels author web reach, palette, and sources while the module owns bounded streaming.
 * Responsibility: Keep the public parameter contract and internal tuning values discoverable.
 * Boundary: Geometry, materials, shaders, topology, and lifecycle stay elsewhere.
 */

export const MYCELIUM_SETTINGS = {
  chunkLevel: 0 as const, // Selects 16-metre chunks on the shared world grid.
  // Two windows, because a chunk's cords are built against its neighbours'
  // nodes. The build window is what the web draws: a 5x5 square guaranteeing
  // coverage out to 32 metres from the viewer wherever inside the centre chunk
  // they stand, which the validated web radius never exceeds. The gather
  // window is one ring wider, so every built chunk always has all eight
  // neighbours resident and is therefore built once, completely, and never
  // rebuilt differently. Nodes in that outer ring are never nearer than 32
  // metres to the viewer, so the web radius masks them and their missing cords
  // are never seen.
  buildChunkRadius: 2,
  gatherChunkRadius: 3,
  neighborsPerNode: 2, // Nearest-neighbor edges on top of the spanning backbone.
  // Soil points the module seeds itself under the surface, filling the web to
  // the density of the wurzeln experiment instead of leaving it as sparse as
  // the world content happens to be. At this rate one 16-metre chunk carries
  // 128 of them, which is what the per-slot node capacity is cut for.
  soilNodesPerSquareMeter: 0.5,
  // Per-slot pool bounds, the grass field's fixed-range discipline: every
  // chunk owns one contiguous range it rewrites alone, so writing an entering
  // chunk cannot disturb a resident one. 128 seeded soil points leave room for
  // the world anchors of even a dense forest chunk; a chunk's cords are its
  // own spanning tree plus the neighbour links it claims.
  nodeSlotCapacity: 192,
  edgeSlotCapacity: 384,
  animalLinkCapacity: 4, // Mirrors the Animals visibility budget.
  // Depth of the root system. World anchors hang just under their own object
  // so a tree meets its roots; seeded soil points spread down through the
  // profile, biased shallow so the mat thins with depth rather than filling a
  // slab. Both are measured down from the ground the anchor stands on.
  surfaceRootDepthMeters: 0.02,
  soilMinimumDepthMeters: 0.35,
  soilDepthSpanMeters: 3.5,
  soilDepthBias: 1.8,
  // Strands fade out across this band inside the web radius, so the far rim
  // dissolves instead of ending on a circle.
  webFadeBandMeters: 12,
  // The ribbon is an invisible envelope; the fragment shader draws three
  // fine filaments meandering inside it, so one real edge reads as a strand
  // bundle without extra instances or draw calls.
  edgeBaseWidthMeters: 0.26,
  edgeWeightWidthSpanMeters: 0.18,
  // Filament half width as a fraction of the envelope half width: roughly
  // two-centimetre visible strands. The five-millimetre strands the sparse web
  // used were below what reads as a root at walking distance, and against the
  // pale carried haze they disappeared entirely.
  filamentWidthFraction: 0.18,
  // Longitudinal strip subdivisions letting the centerline wobble. The dense
  // web's cords are short, so they need far fewer than the long cords of the
  // sparse web did: 8 segments across 8,192 instances is 131,072 triangles,
  // below what the 25-segment 4,096-cord pool cost.
  edgeSegments: 8,
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
  // Proximity growth, the grass field's density rejection read backwards: the
  // topology is seeded once at full density and stays put, while each cord and
  // node carries a stable threshold and comes out once the density its own
  // distance allows reaches it. Approaching therefore brings out more roots,
  // not fatter ones. Anchoring this to the camera rather than to the generated
  // density keeps the dense core on the visitor instead of on the chunk
  // centre, and costs no topology rebuild.
  // Below the default order every other transparent object uses, so the mat is
  // drawn before the ground that covers it and the soil blends over it.
  webRenderOrder: -1,
  // The two ground opacities. Bare earth opens far enough to read the mat
  // through it; ground the grass field covers stays nearly solid, because the
  // opaque blades standing on it already hide most of what is below and the
  // lawn has to keep looking like a lawn.
  // Bare earth blends toward the carried background where no cord covers it,
  // so this stays high enough that open soil still reads as ground rather than
  // as a hole; the bone cords are at full alpha and show through it easily.
  soilBareOpacity: 0.5,
  soilCoveredOpacity: 0.9,
  growthNearDistanceMeters: 6,
  // Share of the seeded web present at the rim. The rest fades in as the
  // visitor approaches, so the mat reads as thin far out and full underfoot.
  growthFarFraction: 0.3,
  animationLoopSeconds: 60, // Bounds the pulse time uniform like the other senses.
  // Cords entering the window grow in over this long instead of appearing
  // between two frames. It rides a second, unwrapped clock: the pulse time
  // wraps every minute, and a stamp compared against a wrapped clock would
  // make a cord vanish for the rest of the loop.
  edgeFadeSeconds: 0.6,
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
  /** The seeded underground mat the world anchors hang in. */
  readonly soil?: ConnectionSourceStyle;
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
