/**
 * Purpose: Create and update the small animated animal population.
 * Context: Animals need bounded movement without a generic behavior framework.
 * Responsibility: Clone models, choose valid zone homes, move actors, and animate nearby ones.
 * Boundary: Asset loading, module lifecycle, and world generation stay elsewhere.
 */

import {
  AnimationMixer,
  Box3,
  Group,
  type Material,
  Mesh,
  type PerspectiveCamera,
  SkinnedMesh,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import { getCellRandom } from "../../world/chunk-candidates";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type AlignAnimalToSurface,
  createAnimalSurfaceAlignment,
} from "./animal-surface-orientation";
import type { AnimalColors } from "./animals";
import type {
  AnimalSpeciesDefinition,
  AnimalsDefinition,
} from "./animals-definition";

const HOME_SEARCH_STEP_METERS = 12;
const TURN_RADIANS = 2.2;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const TERRITORY_MIN_RADIUS_RATIO = 0.35;
const TERRITORY_MAX_RADIUS_RATIO = 0.75;

export interface AnimalActors {
  readonly group: Group;
  readonly actors: readonly AnimalActor[];
  readonly parameters: AnimalsDefinition;
  readonly worldSurface: WorldSurface;
  readonly alignToSurface: AlignAnimalToSurface;
}

interface AnimalActor {
  readonly root: Group;
  readonly mixer: AnimationMixer;
  readonly materials: readonly Material[];
  readonly species: AnimalSpeciesDefinition;
  hasHabitat: boolean;
  headingRadians: number;
}

interface AnimalPlan {
  readonly species: AnimalSpeciesDefinition;
  readonly speciesIndex: number;
  readonly speciesActorIndex: number;
}

interface CreateAnimalActorsOptions {
  readonly assets: GltfAssets;
  readonly parameters: AnimalsDefinition;
  readonly colors: AnimalColors;
  readonly effects?: readonly UnlitMaterialEffect[];
  readonly worldSurface: WorldSurface;
  readonly startX: number;
  readonly startZ: number;
}

interface PlaceAnimalOptions {
  readonly parameters: AnimalsDefinition;
  readonly worldSurface: WorldSurface;
  readonly startX: number;
  readonly startZ: number;
}

interface HabitatSearchOptions extends PlaceAnimalOptions {
  readonly actor: AnimalActor;
  readonly actorCount: number;
  readonly actorIndex: number;
}

interface HabitatPoint {
  readonly x: number;
  readonly z: number;
}

export function createAnimalActors(
  options: CreateAnimalActorsOptions,
): AnimalActors {
  const group = new Group();
  group.name = "Animals";
  const actors = createConfiguredActors(options, group);
  const alignToSurface = createAnimalSurfaceAlignment(options.worldSurface);

  return {
    group,
    actors,
    parameters: options.parameters,
    worldSurface: options.worldSurface,
    alignToSurface,
  };
}

function createConfiguredActors(
  options: CreateAnimalActorsOptions,
  group: Group,
): AnimalActor[] {
  const animalPlans = createAnimalPlans(options.parameters.species);

  return animalPlans.map((plan, actorIndex) => {
    const actor = createAnimalActor(
      options.assets,
      options.colors,
      options.effects ?? [],
      plan,
      actorIndex,
    );
    placeActor(actor, options, actorIndex, animalPlans.length);
    group.add(actor.root);
    return actor;
  });
}

/** Interleave species so neighbouring territories do not contain one species only. */
function createAnimalPlans(
  speciesSettings: readonly AnimalSpeciesDefinition[],
): AnimalPlan[] {
  return speciesSettings
    .flatMap((species, speciesIndex) =>
      Array.from({ length: species.count }, (_, speciesActorIndex) => ({
        species,
        speciesIndex,
        speciesActorIndex,
      })),
    )
    .sort(
      (first, second) =>
        first.speciesActorIndex - second.speciesActorIndex ||
        first.speciesIndex - second.speciesIndex,
    );
}

export function updateAnimalActors(
  population: AnimalActors,
  camera: PerspectiveCamera,
  deltaSeconds: number,
): void {
  for (const [actorIndex, actor] of population.actors.entries()) {
    keepActorNearPlayer(population, actor, actorIndex, camera);
    moveActor(population, actor, deltaSeconds);
  }

  showNearestActors(population, camera);
  for (const actor of population.actors) {
    if (!actor.root.visible) continue;
    population.alignToSurface(actor.root, actor.headingRadians);
    actor.mixer.update(deltaSeconds);
  }
}

export function disposeAnimalActors(population: AnimalActors): void {
  const skeletons = new Set<SkinnedMesh["skeleton"]>();
  for (const actor of population.actors) {
    actor.mixer.stopAllAction();
    actor.mixer.uncacheRoot(actor.root);
    for (const material of actor.materials) material.dispose();
    actor.root.traverse((object) => {
      if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
    });
  }
  for (const skeleton of skeletons) skeleton.dispose();
  population.group.clear();
}

function createAnimalActor(
  assets: GltfAssets,
  colors: AnimalColors,
  effects: readonly UnlitMaterialEffect[],
  plan: AnimalPlan,
  actorIndex: number,
): AnimalActor {
  const { species } = plan;
  const asset = getAnimalAsset(assets, species.id);
  const model = clone(asset.scene);
  const materials: Material[] = [];
  model.traverse((object) => {
    if (object instanceof Mesh) {
      const sources = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const replacements = sources.map((source) =>
        createUnlitMaterial(source, getAnimalColor(colors, source.name)),
      );
      applyMaterialEffects(effects, replacements);
      object.material = Array.isArray(object.material)
        ? replacements
        : (replacements[0] ?? object.material);
      materials.push(...replacements);
    }
    if (object instanceof SkinnedMesh) {
      // Animated limbs can leave the static glTF bounds. Only the nearest
      // bounded actors render, so disabling per-part culling is predictable.
      object.frustumCulled = false;
    }
  });
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const sourceHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    throw new Error(`Animal has no measurable height: ${species.id}`);
  }
  model.position.y -= bounds.min.y;
  const root = new Group();
  root.name = `Animal:${species.id}:${actorIndex}`;
  root.scale.setScalar(species.heightMeters / sourceHeight);
  root.add(model);

  const mixer = new AnimationMixer(root);
  const clip = asset.animations.find(
    ({ name }) => name === species.walkAnimation,
  );
  if (!clip) {
    throw new Error(
      `GLTF animation not found: ${species.id}/${species.walkAnimation}`,
    );
  }
  mixer.clipAction(clip).play();

  return {
    root,
    mixer,
    materials,
    species,
    hasHabitat: false,
    headingRadians: getCellRandom(593, actorIndex, 0, 0) * Math.PI * 2,
  };
}

function getAnimalColor(colors: AnimalColors, materialName: string): number {
  if (materialName === "furLight") return colors.lightFurColor;
  if (materialName === "furDark") return colors.darkFurColor;
  if (materialName === "feature") return colors.featureColor;
  return colors.furColor;
}

function getAnimalAsset(assets: GltfAssets, assetId: string): GLTF {
  const asset = assets.get(assetId);
  if (!asset) throw new Error(`Missing animal asset: ${assetId}`);
  return asset;
}

function placeActor(
  actor: AnimalActor,
  options: PlaceAnimalOptions,
  actorIndex: number,
  actorCount: number,
): void {
  const point = findHabitatPoint({
    ...options,
    actor,
    actorCount,
    actorIndex,
  });
  actor.hasHabitat = point !== undefined;
  if (!point) return;

  actor.root.position.set(
    point.x,
    options.worldSurface.surfaceYAt(point.x, point.z),
    point.z,
  );
}

function findHabitatPoint(
  options: HabitatSearchOptions,
): HabitatPoint | undefined {
  const territoryCenter = getTerritoryCenter(options);
  const candidates = createHabitatCandidates(options, territoryCenter);
  return candidates.find((point) =>
    options.actor.species.allowedZones.includes(
      options.worldSurface.zoneAt(point.x, point.z),
    ),
  );
}

/** Give every actor a separate angular territory inside the active radius. */
function getTerritoryCenter(options: HabitatSearchOptions): HabitatPoint {
  const angle = getTerritoryAngle(options);
  const radius = getTerritoryRadius(options);

  return {
    x: options.startX + Math.sin(angle) * radius,
    z: options.startZ + Math.cos(angle) * radius,
  };
}

function getTerritoryAngle(options: HabitatSearchOptions): number {
  const sectorSize = FULL_CIRCLE_RADIANS / options.actorCount;
  const randomAngle = getCellRandom(
    options.parameters.seed,
    options.actorIndex,
    0,
    2,
  );

  return (
    (options.actorIndex + 0.5) * sectorSize +
    (randomAngle - 0.5) * sectorSize * 0.5
  );
}

function getTerritoryRadius(options: HabitatSearchOptions): number {
  const randomRadius = getCellRandom(
    options.parameters.seed,
    options.actorIndex,
    0,
    3,
  );
  const radiusRatio =
    TERRITORY_MIN_RADIUS_RATIO +
    randomRadius * (TERRITORY_MAX_RADIUS_RATIO - TERRITORY_MIN_RADIUS_RATIO);
  return options.parameters.activeRadiusMeters * radiusRatio;
}

/** Rank the bounded player-area grid by proximity to this actor's territory. */
function createHabitatCandidates(
  options: HabitatSearchOptions,
  territoryCenter: HabitatPoint,
): HabitatPoint[] {
  const radiusSteps = Math.floor(
    options.parameters.activeRadiusMeters / HOME_SEARCH_STEP_METERS,
  );
  const stepsPerSide = radiusSteps * 2 + 1;
  const candidates = Array.from({ length: stepsPerSide ** 2 }, (_, index) =>
    createHabitatCandidate(options, index, stepsPerSide, radiusSteps),
  ).filter((point) => isInsideActiveRadius(options, point));

  return candidates.sort(
    (first, second) =>
      squaredDistance(first, territoryCenter) -
      squaredDistance(second, territoryCenter),
  );
}

function createHabitatCandidate(
  options: HabitatSearchOptions,
  index: number,
  stepsPerSide: number,
  radiusSteps: number,
): HabitatPoint {
  const x =
    options.startX +
    ((index % stepsPerSide) - radiusSteps) * HOME_SEARCH_STEP_METERS;
  const z =
    options.startZ +
    (Math.floor(index / stepsPerSide) - radiusSteps) * HOME_SEARCH_STEP_METERS;

  return { x, z };
}

function isInsideActiveRadius(
  options: HabitatSearchOptions,
  point: HabitatPoint,
): boolean {
  return (
    squaredDistance(point, { x: options.startX, z: options.startZ }) <=
    options.parameters.activeRadiusMeters ** 2
  );
}

function squaredDistance(
  first: Pick<HabitatPoint, "x" | "z">,
  second: Pick<HabitatPoint, "x" | "z">,
): number {
  return (first.x - second.x) ** 2 + (first.z - second.z) ** 2;
}

function keepActorNearPlayer(
  population: AnimalActors,
  actor: AnimalActor,
  actorIndex: number,
  camera: PerspectiveCamera,
): void {
  const distance = horizontalDistance(
    actor.root.position.x,
    actor.root.position.z,
    camera.position.x,
    camera.position.z,
  );
  if (
    actor.hasHabitat &&
    distance <= population.parameters.activeRadiusMeters
  ) {
    return;
  }

  placeActor(
    actor,
    {
      parameters: population.parameters,
      worldSurface: population.worldSurface,
      startX: camera.position.x,
      startZ: camera.position.z,
    },
    actorIndex,
    population.actors.length,
  );
}

function moveActor(
  population: AnimalActors,
  actor: AnimalActor,
  deltaSeconds: number,
): void {
  const distance = actor.species.speedMetersPerSecond * deltaSeconds;
  const nextX =
    actor.root.position.x + Math.sin(actor.headingRadians) * distance;
  const nextZ =
    actor.root.position.z + Math.cos(actor.headingRadians) * distance;

  if (
    !actor.species.allowedZones.includes(
      population.worldSurface.zoneAt(nextX, nextZ),
    )
  ) {
    actor.headingRadians += TURN_RADIANS;
    return;
  }

  actor.root.position.set(
    nextX,
    population.worldSurface.surfaceYAt(nextX, nextZ),
    nextZ,
  );
}

function showNearestActors(
  population: AnimalActors,
  camera: PerspectiveCamera,
): void {
  for (const actor of population.actors) actor.root.visible = false;
  if (!population.group.visible) return;

  showNearestActorPerDirection(population, camera);
  fillRemainingVisibleSlots(population, camera);
}

/** Prefer one nearby actor in each direction before filling empty slots. */
function showNearestActorPerDirection(
  population: AnimalActors,
  camera: PerspectiveCamera,
): void {
  for (
    let directionIndex = 0;
    directionIndex < population.parameters.maxVisible;
    directionIndex += 1
  ) {
    const nearest = findNearestHiddenActor(
      population.actors,
      camera,
      directionIndex,
      population.parameters.maxVisible,
    );
    if (nearest) nearest.root.visible = true;
  }
}

function fillRemainingVisibleSlots(
  population: AnimalActors,
  camera: PerspectiveCamera,
): void {
  let visibleCount = population.actors.filter(
    ({ root }) => root.visible,
  ).length;

  while (visibleCount < population.parameters.maxVisible) {
    const nearest = findNearestHiddenActor(population.actors, camera);
    if (!nearest) return;
    nearest.root.visible = true;
    visibleCount += 1;
  }
}

function findNearestHiddenActor(
  actors: readonly AnimalActor[],
  camera: PerspectiveCamera,
  directionIndex?: number,
  directionCount?: number,
): AnimalActor | undefined {
  let nearest: AnimalActor | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const actor of actors) {
    if (!actor.hasHabitat || actor.root.visible) continue;
    if (!isInDirection(actor, camera, directionIndex, directionCount)) continue;
    const distance = actor.root.position.distanceToSquared(camera.position);
    if (distance >= nearestDistance) continue;
    nearest = actor;
    nearestDistance = distance;
  }
  return nearest;
}

function isInDirection(
  actor: AnimalActor,
  camera: PerspectiveCamera,
  directionIndex: number | undefined,
  directionCount: number | undefined,
): boolean {
  if (directionIndex === undefined || directionCount === undefined) return true;

  const angle = Math.atan2(
    actor.root.position.x - camera.position.x,
    actor.root.position.z - camera.position.z,
  );
  const positiveAngle = (angle + FULL_CIRCLE_RADIANS) % FULL_CIRCLE_RADIANS;
  const actorDirection = Math.floor(
    (positiveAngle / FULL_CIRCLE_RADIANS) * directionCount,
  );
  return actorDirection === directionIndex;
}

function horizontalDistance(
  firstX: number,
  firstZ: number,
  secondX: number,
  secondZ: number,
): number {
  return Math.hypot(firstX - secondX, firstZ - secondZ);
}
