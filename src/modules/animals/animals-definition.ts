/**
 * Purpose: Define the fixed bounded animal population used by landscape levels.
 * Context: Levels activate Animals while the module owns species and behavior values.
 * Responsibility: Keep species assets, habitats, scale, movement, and runtime bounds explicit.
 * Boundary: World shape and zone classification live in World Surface.
 */

import type { ZoneId } from "../../world-surface/zone-settings";

export interface AnimalSpeciesDefinition {
  readonly id: string;
  readonly url: string;
  readonly count: number;
  readonly heightMeters: number;
  readonly speedMetersPerSecond: number;
  readonly allowedZones: readonly ZoneId[];
  readonly walkAnimation: string;
}

export interface AnimalsDefinition {
  readonly seed: number;
  readonly maxVisible: number;
  readonly activeRadiusMeters: number;
  readonly species: readonly AnimalSpeciesDefinition[];
}

export const ANIMALS_DEFINITION: AnimalsDefinition = {
  seed: 953, // Keeps animal homes stable across level loads.

  /**
   * Bounds animated models and their draw calls on PICO. This is the only
   * number here with a frame cost that scales with it: every other actor sits
   * in the population at two surface queries a frame, while a visible one
   * carries its skinning, its mixer, its four slope samples, and its five to
   * seven draw calls.
   *
   * Six rather than four because four, spread over the six directions the
   * selection uses, left the world reading as empty between sightings. It is
   * also the count of ground heat pools Thermal Perception carries
   * (`THERMAL_GROUND_HEAT_SOURCE_COUNT`), so that every visible body warms the
   * ground it stands on; raising this without raising that leaves the extra
   * animals standing on cold ground.
   */
  maxVisible: 6,
  activeRadiusMeters: 96, // Repositions animals that fall well behind the player.

  /*
   * The population is deliberately larger than the visible budget. Actors that
   * are not drawn still walk their territories and still relocate when the
   * player leaves them behind, so what the visible slots select from is a world
   * that has been living rather than a ring of animals parked around the
   * camera. Counts follow how common each species should feel: rats and deer
   * are met often, a stag rarely.
   */
  species: [
    {
      id: "deer",
      url: "/animals/deer.glb",
      count: 5,
      heightMeters: 1.4,
      speedMetersPerSecond: 0.7,
      allowedZones: ["meadow", "deciduousForest"],
      walkAnimation: "Walk",
    },
    {
      id: "stag",
      url: "/animals/stag.glb",
      count: 3,
      heightMeters: 1.6,
      speedMetersPerSecond: 0.65,
      allowedZones: ["coniferForest", "deciduousForest"],
      walkAnimation: "Walk",
    },
    {
      id: "fox",
      url: "/animals/fox.glb",
      count: 4,
      heightMeters: 0.7,
      speedMetersPerSecond: 0.85,
      allowedZones: ["coniferForest", "deciduousForest", "shrubSlope"],
      walkAnimation: "Walk",
    },
    {
      id: "rat",
      url: "/animals/rat.glb",
      count: 5,
      heightMeters: 0.25,
      speedMetersPerSecond: 0.35,
      allowedZones: ["meadow", "shrubSlope"],
      walkAnimation: "RatArmature|Rat_Walk",
    },
  ],
};
