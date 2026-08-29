/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as motionLevel } from "./motion.level";
import { sharedEchoDepth } from "./shared-level-values";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Motion Perception preset
  // verbatim; the heat view exists only inside a viewer-centred radius, and
  // outside it the carried Motion world shows unchanged.
  ...motionLevel,
  // Grass is out of this level for now, by request. Nothing technical forces
  // it out — its shaders carry the effect anchors, so both the echo ramp and
  // the heat view do reach it — and the open question is still where ground
  // cover belongs: it is a world element, so if it returns it belongs in the
  // Echo Level, with levels 03 and 04 carrying it too.
  //
  // New in level 05: the river shows its water instead of the depth ramp. The
  // tone is the level-05 `coldColor` anchor, the palette's own place for water
  // and the coldest ground, so the one colored thing in the carried grayscale
  // world still comes from this level's documented six. Levels 03 and 04 keep
  // the river as the carved shape their ramp already draws.
  echoDepth: {
    ...sharedEchoDepth,
    waterColor: 0x0c47d1,
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
  // #D5198A #FB5F16 #FCCE43, mapped cold to hot. An ironbow ramp was tried in
  // its place on 2026-08-29 and reverted the same day; the decision log in
  // docs/levels/05-thermal-perception/README.md keeps what that showed.
  //
  // These six are anchors, not the visible colors: the module interpolates
  // between them in gamma space, so what the level actually shows is the
  // continuous gradient through them.
  thermal: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Heat is a near sense: the false-color view reaches 30 metres and
    // feathers back into the echo ramp well inside its 120 m far distance.
    radiusMeters: 30,
    edgeFeatherMeters: 10,
    colors: {
      // Water and the coldest ground, which the transparent cold end of the
      // ramp now leaves almost entirely to the carried echo depth map.
      coldestColor: 0x2e1386,
      coldColor: 0x0c47d1,
      // Where the cooled ground budget lands: dry ground climbs from blue
      // through cyan toward magenta with elevation and exposure, and stops
      // well short of the warm end.
      coolColor: 0x2eb4e8,
      warmColor: 0xd5198a,
      // The top two anchors belong to living bodies alone. Nothing that is
      // not alive can reach the environment ceiling, which sits below them.
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
    // Core body temperature, and the one place in this world that reaches the
    // top of the ramp: an animal's deep core and its face land on #FCCE43 and
    // nothing else ever does. The module takes the rest of the body down from
    // here, and the whole span still clears the environment ceiling, so even a
    // hoof reads as alive against the ground the animal stands on.
    actorWarmth: 1,
  },
};
