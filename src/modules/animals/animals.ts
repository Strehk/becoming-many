/**
 * Purpose: Connect the bounded animal population to the shared world lifecycle.
 * Context: Animated species are optional level content, not permanent world infrastructure.
 * Responsibility: Own animal actors, visibility, frame updates, assets, and cleanup.
 * Boundary: Species data lives in animals-definition; world facts come from World Surface.
 */

import type { Matrix4, PerspectiveCamera, Scene } from "three";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import type { WorldModule } from "../../world/module-runtime";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type AnimalActors,
  createAnimalActors,
  disposeAnimalActors,
  getVisibleActorPositions,
  readVisibleAnimalBodies,
  updateAnimalActors,
} from "./animal-actors";
import type { AnimalsDefinition } from "./animals-definition";

export type { AnimalsDefinition } from "./animals-definition";

export interface AnimalColors {
  readonly furColor: number;
  readonly lightFurColor: number;
  readonly darkFurColor: number;
  readonly featureColor: number;
}

export interface AnimalsPreset {
  readonly colors: AnimalColors;
}

/**
 * Build the effects for one animated mesh. The body matrix maps that mesh's
 * local space onto its actor's normalized body space (y 0..1 from lowest
 * point to crown), so an effect can vary across a body without knowing which
 * species it decorates.
 */
export type AnimalMaterialEffectsFor = (
  bodyMatrix: Matrix4,
) => readonly UnlitMaterialEffect[];

/** Where one visible animal stands, which way it faces, and how big it is. */
export interface AnimalBody {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly headingRadians: number;
  readonly heightMeters: number;

  /** Which species stands here; senses that differ per species need it. */
  readonly speciesId: string;
}

/** The writable form the module refills in place each frame. */
export type MutableAnimalBody = {
  -readonly [Key in keyof AnimalBody]: AnimalBody[Key];
};

/**
 * Report the visible animals after every update. The array is reused between
 * frames, so an observer that keeps it must copy what it needs.
 */
export type AnimalBodiesObserver = (bodies: readonly AnimalBody[]) => void;

export interface AnimalsModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly definition: AnimalsDefinition;
  readonly preset: AnimalsPreset;
  readonly assets: GltfAssets;
  readonly worldSurface: WorldSurface;
  readonly effectsFor?: AnimalMaterialEffectsFor;
  readonly onBodiesUpdated?: AnimalBodiesObserver;
}

interface AnimalsState {
  population: AnimalActors | undefined;
  readonly bodies: MutableAnimalBody[];
}

/** The world module plus the live positions other senses may consume. */
export interface AnimalsModuleHandle {
  readonly module: WorldModule;
  /** Tightly packed world xyz triples of the currently visible actors. */
  readonly getVisibleWorldPositions: () => Float32Array;
}

export function createAnimalsModule(
  options: AnimalsModuleOptions,
): AnimalsModuleHandle {
  validateAnimalsDefinition(options.definition);
  const state: AnimalsState = { population: undefined, bodies: [] };
  const packedPositions = new Float32Array(options.definition.maxVisible * 3);

  return {
    module: {
      load: () => loadAnimals(state, options),
      activate: () => setAnimalsVisible(state, true),
      update: (deltaSeconds) => updateAnimals(state, options, deltaSeconds),
      deactivate: () => setAnimalsVisible(state, false),
      unload: () => unloadAnimals(state, options.scene, options.assets),
    },
    getVisibleWorldPositions: () => {
      const actorCount = state.population
        ? getVisibleActorPositions(state.population, packedPositions)
        : 0;
      return packedPositions.subarray(0, actorCount * 3);
    },
  };
}

function validateAnimalsDefinition(parameters: AnimalsDefinition): void {
  const speciesIds = new Set(parameters.species.map(({ id }) => id));
  const actorCount = parameters.species.reduce(
    (total, species) => total + species.count,
    0,
  );
  if (speciesIds.size !== parameters.species.length) {
    throw new Error("Animal species ids must be unique");
  }
  if (
    !Number.isInteger(parameters.maxVisible) ||
    parameters.maxVisible < 0 ||
    parameters.maxVisible > actorCount
  ) {
    throw new RangeError(
      "Animal maxVisible must fit the configured population",
    );
  }
  if (parameters.activeRadiusMeters <= 0) {
    throw new RangeError("Animal activeRadiusMeters must be positive");
  }
  if (
    parameters.species.some(
      ({ allowedZones, count, heightMeters, speedMetersPerSecond }) =>
        !Number.isInteger(count) ||
        count <= 0 ||
        allowedZones.length === 0 ||
        heightMeters <= 0 ||
        speedMetersPerSecond < 0,
    )
  ) {
    throw new RangeError("Animal count, habitat, height, or speed is invalid");
  }
}

function loadAnimals(state: AnimalsState, options: AnimalsModuleOptions): void {
  const population = createAnimalActors({
    assets: options.assets,
    parameters: options.definition,
    colors: options.preset.colors,
    effectsFor: options.effectsFor,
    worldSurface: options.worldSurface,
    startX: options.camera.position.x,
    startZ: options.camera.position.z,
  });
  population.group.visible = false;
  options.scene.add(population.group);
  state.population = population;
}

function updateAnimals(
  state: AnimalsState,
  options: AnimalsModuleOptions,
  deltaSeconds: number,
): void {
  if (!state.population?.group.visible) return;

  updateAnimalActors(state.population, options.camera, deltaSeconds);
  if (!options.onBodiesUpdated) return;

  readVisibleAnimalBodies(state.population, state.bodies);
  options.onBodiesUpdated(state.bodies);
}

function setAnimalsVisible(state: AnimalsState, visible: boolean): void {
  if (state.population) state.population.group.visible = visible;
}

function unloadAnimals(
  state: AnimalsState,
  scene: Scene,
  assets: GltfAssets,
): void {
  const population = state.population;
  if (!population) return;

  state.population = undefined;
  scene.remove(population.group);
  disposeAnimalActors(population);
  disposeGltfAssets(assets);
}
