/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as motionLevel } from "./motion.level";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Motion Perception preset
  // verbatim; the heat view exists only inside a viewer-centred radius, and
  // outside it the carried Motion world shows unchanged.
  ...motionLevel,
  // New in level 05: warm bodies against the carried grayscale world. Fur
  // colors come from the level-03 dark stops so animals outside the thermal
  // radius sit inside the echo palette like vegetation does.
  animals: {
    colors: {
      furColor: 0x171717,
      lightFurColor: 0x494949,
      darkFurColor: 0x101010,
      featureColor: 0x101010,
    },
  },
  // Level 05 palette from docs/levels/README.md: #2E1386 #0C47D1 #2EB4E8
  // #D5198A #FB5F16 #FCCE43, mapped cold to hot.
  thermal: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Heat is a near sense: the false-color view reaches 60 metres and
    // feathers back into the echo ramp well inside its 96 m far distance.
    radiusMeters: 60,
    edgeFeatherMeters: 20,
    colors: {
      coldestColor: 0x2e1386,
      coldColor: 0x0c47d1,
      coolColor: 0x2eb4e8,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      // Plants hold mid warmth with wide per-plant variation, so a stand
      // fans across cyan into orange instead of massing into one tone; rocks
      // sit cooler and vary less, so living things stay the warmer read.
      // Each object then carries its own gradient: a plant holds its heat at
      // the trunk and near the ground and sheds it toward an outer canopy
      // open to the sky, while a rock is warmest on the face the sun reaches
      // and cooler down its shaded flanks.
      vegetationWarmth: 0.52,
      vegetationWarmthSpread: 0.2,
      vegetationHeightWarmthPerMeter: -0.02,
      vegetationAxisWarmthPerMeter: -0.03,
      vegetationTextureWarmth: 0.07,
      rockWarmth: 0.26,
      rockWarmthSpread: 0.14,
      rockHeightWarmthPerMeter: 0.22,
      rockAxisWarmthPerMeter: -0.07,
      rockTextureWarmth: 0.05,
    },
    // The organic texture over the ground: deep enough to break the elevation
    // ramp into mottled patches, shallow next to the 0.45 span that ramp
    // covers, so the landscape's shape still leads the reading.
    terrainTextureWarmth: 0.07,
    // Warm-blooded animals are the hottest thing in the world: the body core
    // reaches the yellow end of the ramp outright, and the falloff carries
    // legs, snouts, and tails back down into the magenta and cyan bands.
    actorWarmth: 0.96,
    actorExtremityFalloff: 0.42,
    // A quarter of what the core-to-limb falloff spans, and the shader eases
    // it off above the quiet warmth, so a coat varies while the hot core
    // keeps a defined edge.
    actorTextureWarmth: 0.1,
    // A body warms what surrounds it. The strength is a third of what the
    // ground's own elevation ramp spans, so a pool reads clearly while the
    // ground inside it keeps its own variation; the reach follows the
    // animal's size, so a stag blooms wider than a rat.
    heatEmission: {
      strength: 0.3,
      reachPerBodyHeight: 1.6,
    },
  },
};
