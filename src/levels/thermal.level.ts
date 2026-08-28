/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as motionLevel } from "./motion.level";
import { sharedGrassZones } from "./shared-level-values";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Motion Perception preset
  // verbatim; the heat view exists only inside a viewer-centred radius, and
  // outside it the carried Motion world shows unchanged.
  ...motionLevel,
  // Under evaluation, not a decision: Grass is documented as excluded by
  // intent because its raw shader has no material-effect hook, so neither the
  // echo ramp nor the heat view reaches it. Its colors come from the level-03
  // dark stops, which is right outside the thermal radius and visibly wrong
  // inside it. Either Grass gains a hook or this field comes back out.
  grass: {
    rootColor: 0x101010,
    tipColor: 0x494949,
    zones: sharedGrassZones,
  },
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
  // #D5198A #FB5F16 #FCCE43, mapped cold to hot. These six are anchors, not
  // the visible colors: the module interpolates between them in gamma space,
  // so what the level actually shows is the continuous gradient through them.
  thermal: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Heat is a near sense: the false-color view reaches 30 metres and
    // feathers back into the echo ramp well inside its 120 m far distance.
    radiusMeters: 30,
    edgeFeatherMeters: 10,
    colors: {
      coldestColor: 0x2e1386,
      coldColor: 0x0c47d1,
      coolColor: 0x2eb4e8,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      // The average temperature of one plant or rock; the module spreads every
      // instance around it and varies the temperature across each model, so
      // these are the centre of a distribution rather than a color anyone
      // sees. Rocks sit cooler and vary less than living plants do.
      vegetationWarmth: 0.44,
      vegetationWarmthSpread: 0.14,
      rockWarmth: 0.31,
      rockWarmthSpread: 0.11,
    },
    // Core body temperature. It has to clear the module's environment ceiling
    // by enough that the whole body — torso down through legs to hooves —
    // still reads as alive against the ground the animal stands on.
    actorWarmth: 0.95,
  },
};
