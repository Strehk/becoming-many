/**
 * Purpose: Compose the authored blocks into the sense layers of the ladder.
 * Context: Each narrative level carries every layer below its own rung unchanged.
 * Responsibility: Name which blocks each sense adds; a preset spreads its layers in ladder order.
 * Boundary: Data only; presentation, timing, and runtime resources live elsewhere.
 */

import { AIR_PARTICLES } from "./authored/air-particles";
import { WARM_ANIMALS } from "./authored/animals";
import { CONNECTIONS } from "./authored/connections";
import { ECHO_DEPTH } from "./authored/echo-depth";
import { GRASS_CLIPMAP } from "./authored/grass-clipmap";
import { MAGNETIC_SENSE } from "./authored/magnetic-sense";
import { HEAT_MOTION_SENSE, MOTION_SENSE } from "./authored/motion-sense";
import { ROCKS } from "./authored/rocks";
import { RUINS } from "./authored/ruins";
import { SCENT_PARTICLES } from "./authored/scent-particles";
import { ZONE_TERRAIN } from "./authored/terrain";
import { THERMAL_PERCEPTION } from "./authored/thermal-perception";
import { VEGETATION } from "./authored/vegetation";
import type { WorldComposition } from "./level-preset";

/*
 * Spread in this order: white-world, scent, echo, motion, thermal, magnetic,
 * connections. Exactly one key is authored twice — THERMAL_LAYER's `motion`
 * replaces MOTION_LAYER's, so a level that carries heat also prints its bird
 * traces hot. Every other layer only adds keys.
 */

export const WHITE_WORLD_LAYER: Pick<WorldComposition, "airParticles"> = {
  airParticles: AIR_PARTICLES,
};

export const SCENT_LAYER: Pick<WorldComposition, "scentParticles"> = {
  scentParticles: SCENT_PARTICLES,
};

export const ECHO_LAYER: Pick<
  WorldComposition,
  "echoDepth" | "terrain" | "grassClipmap" | "vegetation" | "rocks" | "ruins"
> = {
  echoDepth: ECHO_DEPTH,
  terrain: ZONE_TERRAIN,
  grassClipmap: GRASS_CLIPMAP,
  vegetation: VEGETATION,
  rocks: ROCKS,
  ruins: RUINS,
};

export const MOTION_LAYER: Pick<WorldComposition, "motion"> = {
  motion: MOTION_SENSE,
};

export const THERMAL_LAYER: Pick<
  WorldComposition,
  "motion" | "animals" | "thermal"
> = {
  motion: HEAT_MOTION_SENSE,
  animals: WARM_ANIMALS,
  thermal: THERMAL_PERCEPTION,
};

export const MAGNETIC_LAYER: Pick<WorldComposition, "magnetic"> = {
  magnetic: MAGNETIC_SENSE,
};

export const CONNECTIONS_LAYER: Pick<WorldComposition, "connections"> = {
  connections: CONNECTIONS,
};
