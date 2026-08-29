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
      // Plants are the warmest thing in the world that is not alive, and the
      // warmth sits where the plant meets the sky: the base warmth is what a
      // shaded trunk holds, and the gradient carries heat up and outward, so
      // a crown and its fine outer branches read warmer than the stem that
      // holds them. Only tall plants gain much from it, which is why a low
      // shrub stays near its trunk temperature while a tree crown climbs.
      vegetationWarmth: 0.4,
      vegetationWarmthSpread: 0.14,
      vegetationHeightWarmthPerMeter: 0.022,
      vegetationAxisWarmthPerMeter: 0.015,
      vegetationTextureWarmth: 0.07,
      vegetationContrast: 0.45,
      // Rock is cold, heavy substance: it sits near the ground's own range,
      // warmest on the face the sun reaches and cooler down its flanks.
      rockWarmth: 0.2,
      rockWarmthSpread: 0.1,
      rockHeightWarmthPerMeter: 0.05,
      rockAxisWarmthPerMeter: -0.03,
      rockTextureWarmth: 0.05,
      rockContrast: 0.3,
    },
    // What each material's own substance may reach, whatever its elevation,
    // gradient, texture, and contrast add up to. Ground and rock are held in
    // the violet-to-cyan end; plants may climb into magenta and orange where
    // they are exposed; only a living body owns the hottest colors.
    bands: {
      terrain: { floorWarmth: 0.02, ceilingWarmth: 0.36 },
      vegetation: { floorWarmth: 0.2, ceilingWarmth: 0.78 },
      rocks: { floorWarmth: 0.04, ceilingWarmth: 0.36 },
      animals: { floorWarmth: 0.4, ceilingWarmth: 1 },
    },
    // The organic texture over the ground: deep enough to break the elevation
    // ramp into mottled patches, shallow next to the 0.45 span that ramp
    // covers, so the landscape's shape still leads the reading.
    terrainTextureWarmth: 0.07,
    // Definition: the ground's readings cluster low on the ramp, so pulling
    // them apart around that cluster separates hollow from ridge and forest
    // from meadow. It stays the gentlest curve in the world, because the
    // ground's band is narrow and a stronger one would only press its upper
    // half against the ceiling instead of separating anything.
    terrainContrast: 0.3,
    // Warm-blooded animals are the hottest thing in the world: the body core
    // reaches the yellow end of the ramp outright, and the falloff carries
    // legs, snouts, and tails back down into the magenta and cyan bands.
    actorWarmth: 0.96,
    actorExtremityFalloff: 0.42,
    // A quarter of what the core-to-limb falloff spans, and the shader eases
    // it off above the quiet warmth, so a coat varies while the hot core
    // keeps a defined edge.
    actorTextureWarmth: 0.1,
    // Living bodies get the strongest curve of anything in the world: it
    // pushes the core toward full heat and the limbs down past the warm
    // stop, so an animal reads as a contoured shape rather than a warm blob.
    actorContrast: 0.8,
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
