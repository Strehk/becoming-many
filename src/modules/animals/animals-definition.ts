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
  maxVisible: 4, // Bounds animated models and their draw calls on PICO.
  activeRadiusMeters: 96, // Repositions animals that fall well behind the player.
  species: [
    {
      id: "deer",
      url: "/animals/deer.glb",
      count: 3,
      heightMeters: 1.4,
      speedMetersPerSecond: 0.7,
      allowedZones: ["meadow", "deciduousForest"],
      walkAnimation: "Walk",
    },
    {
      id: "stag",
      url: "/animals/stag.glb",
      count: 2,
      heightMeters: 1.6,
      speedMetersPerSecond: 0.65,
      allowedZones: ["coniferForest", "deciduousForest"],
      walkAnimation: "Walk",
    },
    {
      id: "fox",
      url: "/animals/fox.glb",
      count: 2,
      heightMeters: 0.7,
      speedMetersPerSecond: 0.85,
      allowedZones: ["coniferForest", "deciduousForest", "shrubSlope"],
      walkAnimation: "Walk",
    },
    {
      id: "rat",
      url: "/animals/rat.glb",
      count: 3,
      heightMeters: 0.25,
      speedMetersPerSecond: 0.35,
      allowedZones: ["meadow", "shrubSlope"],
      walkAnimation: "RatArmature|Rat_Walk",
    },
  ],
};
