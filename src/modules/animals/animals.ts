/**
 * Purpose: Connect the bounded animal population to the shared world lifecycle.
 * Context: Animated species are optional level content, not permanent world infrastructure.
 * Responsibility: Own animal actors, visibility, frame updates, assets, and cleanup.
 * Boundary: Species data lives in animals-definition; world facts come from World Surface.
 */

import type { PerspectiveCamera, Scene } from "three";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import type { ActorMaterialEffect } from "../../utils/asset-loader/material-effect";
import type { WorldModule } from "../../world/module-runtime";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type AnimalActors,
  createAnimalActors,
  disposeAnimalActors,
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

/** Animals as a world module plus the read access other senses need. */
export interface AnimalsModule extends WorldModule {
  /**
   * Visit the world position of every currently rendered actor. Living bodies
   * are heat sources, and a sense that reacts to them needs to know where they
   * are without reaching into this module's population.
   */
  readonly forEachVisibleActor: (
    visit: (worldX: number, worldY: number, worldZ: number) => void,
  ) => void;
}

export interface AnimalsModuleOptions {
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  readonly definition: AnimalsDefinition;
  readonly preset: AnimalsPreset;
  readonly assets: GltfAssets;
  readonly worldSurface: WorldSurface;

  /**
   * Effects are handed the species' body height alongside the material: a
   * sense that models a living body has to scale its response to the size of
   * the one in front of it.
   */
  readonly effects?: readonly ActorMaterialEffect[];
}

interface AnimalsState {
  population: AnimalActors | undefined;
}

export function createAnimalsModule(
  options: AnimalsModuleOptions,
): AnimalsModule {
  validateAnimalsDefinition(options.definition);
  const state: AnimalsState = { population: undefined };

  return {
    load: () => loadAnimals(state, options),
    activate: () => setAnimalsVisible(state, true),
    update: (deltaSeconds) =>
      updateAnimals(state, options.camera, deltaSeconds),
    deactivate: () => setAnimalsVisible(state, false),
    unload: () => unloadAnimals(state, options.scene, options.assets),
    forEachVisibleActor: (visit) => visitVisibleActors(state, visit),
  };
}

function visitVisibleActors(
  state: AnimalsState,
  visit: (worldX: number, worldY: number, worldZ: number) => void,
): void {
  const population = state.population;
  if (!population?.group.visible) return;

  for (const actor of population.actors) {
    if (!actor.root.visible) continue;

    const { x, y, z } = actor.root.position;
    visit(x, y, z);
  }
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
    effects: options.effects,
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
  camera: PerspectiveCamera,
  deltaSeconds: number,
): void {
  if (state.population?.group.visible) {
    updateAnimalActors(state.population, camera, deltaSeconds);
  }
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
