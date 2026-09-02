/**
 * Purpose: Define the Echolocation level preset ("Bat — Depth", level 03).
 * Context: Echolocation (level 03) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import {
  sharedAirParticles,
  sharedEchoDepth,
  sharedEchoHazeColor,
  sharedEchoRocks,
  sharedEchoVegetation,
  sharedScentParticles,
} from "./shared-level-values";

export const level: LevelPreset = {
  backgroundColor: sharedEchoHazeColor,
  viewDistance: 128,
  testUi: true,
  terrain: {
    opacity: 1,
  },
  vegetation: sharedEchoVegetation,
  // Grass returns here and carries through every later level, because they
  // spread this preset. It is the clipmap field, not the older `grass`
  // module: that one stays parked. The blades answer to the senses like any
  // other surface — Echo Depth takes their color outright, Thermal covers it
  // inside its radius — so nothing here authors a look, only a density and a
  // size. What a field this dense costs under the heat view is still
  // unmeasured on the target device.
  grassClipmap: {
    // Both of these are the near field, and the near field is where the
    // field costs. Measured on the quick profile, Thermal Perception, as the
    // grass surcharge over the same level without it: 19 tufts to 20 m costs
    // 3.0 ms p95, 12 to 20 m costs 2.6 ms, 12 to 14 m costs 1.4 ms. The
    // cheapest of those is not the one to take: at 14 m the viewer flies
    // seven metres up, so nearly everything in frame already sits in the
    // thinning zone and the meadow reads as bare ground. Reaching less far
    // costs almost nothing to give up instead, because the law has already
    // thinned the distance to a few percent — at 100 m four blades in a
    // hundred survive and a far chunk starts twenty instances.
    tuftsPerSquareMeter: 21.85,
    // Full density holds this far and then falls with one over distance
    // squared. Shorter than the source demo's 32 m: this world is flown over
    // rather than walked through, and grass that stays dense into the
    // distance reads as a carpet instead of as a meadow.
    fullDensityRadiusMeters: 14,
    // An exact maximum, not a nominal value: scatter and clumping only ever
    // take from it, so a typical blade stands near 0.9 m and the tallest
    // reach 2.1 m. The demo authored 3 m, which is right at eye level when
    // walking and too tall for a landscape seen from above; a third of that
    // reduction was given back because the field read as mown.
    bladeHeightMeters: 3,
    bladeWidthMeters: 0.2,
    colors: {
      rootColor: 0x16240c,
      tipColor: 0x94c356,
    },
  },
  rocks: sharedEchoRocks,
  // Senses layer, never swap: the White World air layer and the Scent World
  // layer stay present while the depth response becomes dominant.
  airParticles: sharedAirParticles,
  scentParticles: sharedScentParticles,
  echoDepth: sharedEchoDepth,
};
