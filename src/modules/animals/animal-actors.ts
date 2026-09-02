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
  Matrix4,
  Mesh,
  SkinnedMesh,
} from "three";
import type { GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type { GltfAssets } from "../../utils/asset-loader/gltf-assets";
import { applyMaterialEffects } from "../../utils/asset-loader/material-effect";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import { getCellRandom } from "../../world/chunk-candidates";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  type AlignAnimalToSurface,
  createAnimalSurfaceAlignment,
} from "./animal-surface-orientation";
import type {
  AnimalColors,
  AnimalMaterialEffectsFor,
  MutableAnimalBody,
} from "./animals";
import type {
  AnimalSpeciesDefinition,
  AnimalsDefinition,
} from "./animals-definition";

const HOME_SEARCH_STEP_METERS = 12;
const TURN_RADIANS = 2.2;
/*
 * An animal turns on an arc, not on the spot. The radius is authored in body
 * heights rather than in metres so a stag sweeps wide and a rat turns tight,
 * and the angular rate follows from it and the animal's own speed — which is
 * what a turning circle is. Turning at one authored rate instead gave every
 * species a radius under half a metre: the body did swing round rather than
 * snap, but it pivoted almost in place, which is not how a walking animal
 * changes direction.
 */
const TURN_RADII_PER_BODY_HEIGHT = 2.5;
/*
 * How far ahead the way is read, in turning radii, plus a step of margin. A
 * turn started at the edge itself cannot be walked out before crossing it,
 * because completing one carries the body up to a full radius further on. Read
 * this far ahead and the animal leans away from ground it may not enter while
 * still walking, so the edge turns it rather than stopping it.
 */
const TURN_LOOKAHEAD_RADII = 1.5;
const TURN_LOOKAHEAD_MARGIN_METERS = 1;
/* Below this the turn is walked out, and the animal may aim a new one. */
const TURN_SETTLED_RADIANS = 0.05;
const FULL_CIRCLE_RADIANS = Math.PI * 2;
const TERRITORY_MIN_RADIUS_RATIO = 0.35;
const TERRITORY_MAX_RADIUS_RATIO = 0.75;
/*
 * Only the nearest few actors of the population are drawn, and which few that
 * is changes as the traveler moves and turns: an actor taking a slot used to
 * arrive complete between two frames, which reads as an animal popping into
 * the distance. It fades in over this instead, and an actor losing its slot
 * fades back out, so the bounded set changes without anything appearing.
 * Under a second, or a body would visibly ghost while it walked.
 */
const APPEARANCE_FADE_SECONDS = 0.8;
/* Below this an actor holds no slot and is worth nothing to draw. */
const MINIMUM_APPEARANCE = 0.002;

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

  /** Where the body is turning to; the heading follows it at a bounded rate. */
  targetHeadingRadians: number;

  /** Whether this actor holds one of the bounded visible slots this frame. */
  selected: boolean;

  /**
   * How far this actor has arrived, 0..1. It drives material opacity, and the
   * root stays in the scene until it reaches zero, so an actor that loses its
   * slot walks out of sight instead of vanishing between two frames.
   */
  appearance: number;
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
  readonly effectsFor?: AnimalMaterialEffectsFor;
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
      options.effectsFor,
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
  viewpoint: Viewpoint,
  deltaSeconds: number,
): void {
  for (const [actorIndex, actor] of population.actors.entries()) {
    keepActorNearPlayer(population, actor, actorIndex, viewpoint);
    moveActor(population, actor, deltaSeconds);
  }

  showNearestActors(population, viewpoint);
  for (const actor of population.actors) {
    updateActorAppearance(actor, deltaSeconds);
    if (!actor.root.visible) continue;
    population.alignToSurface(actor.root, actor.headingRadians);
    actor.mixer.update(deltaSeconds);
  }
}

/**
 * Carry one actor toward being there or being gone. A body that is on its way
 * out keeps walking and keeps its slot in the scene until it is invisible, so
 * the fade is the animal leaving rather than a frame in which it is dropped.
 */
function updateActorAppearance(actor: AnimalActor, deltaSeconds: number): void {
  const target = actor.selected ? 1 : 0;
  const step = deltaSeconds / APPEARANCE_FADE_SECONDS;
  actor.appearance =
    Math.abs(target - actor.appearance) <= step
      ? target
      : actor.appearance + Math.sign(target - actor.appearance) * step;
  actor.root.visible = actor.appearance > MINIMUM_APPEARANCE;
  for (const material of actor.materials) material.opacity = actor.appearance;
}

/**
 * Fill `bodies` with the visible actors, reusing its entries so the per-frame
 * report allocates nothing once the visible count settles.
 */
export function readVisibleAnimalBodies(
  population: AnimalActors,
  bodies: MutableAnimalBody[],
): void {
  let count = 0;
  for (const actor of population.actors) {
    if (!actor.root.visible) continue;

    let body = bodies[count];
    if (!body) {
      body = {
        x: 0,
        y: 0,
        z: 0,
        headingRadians: 0,
        heightMeters: 0,
        speciesId: "",
      };
      bodies[count] = body;
    }
    body.x = actor.root.position.x;
    body.y = actor.root.position.y;
    body.z = actor.root.position.z;
    body.headingRadians = actor.headingRadians;
    body.heightMeters = actor.species.heightMeters;
    body.speciesId = actor.species.id;
    count++;
  }
  bodies.length = count;
}

/**
 * Pack the world positions of the currently visible actors into the given
 * buffer and return how many actors were written. The visible set is bounded
 * by the definition's visibility budget.
 */
export function getVisibleActorPositions(
  population: AnimalActors,
  outPositions: Float32Array,
): number {
  let actorCount = 0;
  for (const actor of population.actors) {
    if (!actor.root.visible) continue;
    const offset = actorCount * 3;
    if (offset + 3 > outPositions.length) break;
    outPositions[offset] = actor.root.position.x;
    outPositions[offset + 1] = actor.root.position.y;
    outPositions[offset + 2] = actor.root.position.z;
    actorCount += 1;
  }
  return actorCount;
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

/**
 * Map model space onto normalized body space: y runs 0..1 from the lowest
 * point to the crown, and x and z stay in the same units around the body's
 * own vertical axis, so a measurement means the same thing on every species.
 */
function createBodySpaceMatrix(bounds: Box3, sourceHeight: number): Matrix4 {
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  return new Matrix4()
    .makeScale(1 / sourceHeight, 1 / sourceHeight, 1 / sourceHeight)
    .multiply(new Matrix4().makeTranslation(-centerX, -bounds.min.y, -centerZ));
}

function createAnimalActor(
  assets: GltfAssets,
  colors: AnimalColors,
  effectsFor: AnimalMaterialEffectsFor | undefined,
  plan: AnimalPlan,
  actorIndex: number,
): AnimalActor {
  const { species } = plan;
  const asset = getAnimalAsset(assets, species.id);
  const model = clone(asset.scene);
  // Measure before decorating: an effect may need the body the material
  // belongs to, and the bounds also fix the scale that follows.
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const sourceHeight = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    throw new Error(`Animal has no measurable height: ${species.id}`);
  }
  const toBodySpace = createBodySpaceMatrix(bounds, sourceHeight);
  const materials: Material[] = [];
  model.traverse((object) => {
    if (object instanceof Mesh) {
      const sources = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const replacements = sources.map((source) =>
        createUnlitMaterial(source, getAnimalColor(colors, source.name)),
      );
      // Transparent for the whole loaded lifetime, at full opacity whenever
      // an actor is fully there. Toggling the flag with the fade would
      // recompile the patched shader twice per appearance, which is a hitch
      // on the headset; a handful of actors in the transparent pass is not.
      // They keep writing depth, so nothing behind one shows through it.
      for (const material of replacements) material.transparent = true;
      if (effectsFor) {
        // Every mesh sits under its own rig transform, so each one carries
        // its own route from mesh space into the shared body space.
        const bodyMatrix = toBodySpace.clone().multiply(object.matrixWorld);
        applyMaterialEffects(effectsFor(bodyMatrix), replacements);
      }
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
  const startHeadingRadians =
    getCellRandom(593, actorIndex, 0, 0) * Math.PI * 2;

  return {
    root,
    mixer,
    materials,
    species,
    hasHabitat: false,
    headingRadians: startHeadingRadians,
    targetHeadingRadians: startHeadingRadians,
    selected: false,
    appearance: 0,
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

  // A placed actor is somewhere else than it was. Starting it over at nothing
  // means it fades in where it now stands rather than crossing the world in
  // one frame if it happens to hold a visible slot.
  actor.appearance = 0;
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
  viewpoint: Viewpoint,
): void {
  const distance = horizontalDistance(
    actor.root.position.x,
    actor.root.position.z,
    viewpoint.worldPosition.x,
    viewpoint.worldPosition.z,
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
      startX: viewpoint.worldPosition.x,
      startZ: viewpoint.worldPosition.z,
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
  turnTowardTarget(actor, deltaSeconds);

  // Aim one turn and let the body walk it out. Aiming again every frame the
  // way ahead stays blocked would push the target away from a heading that is
  // still catching up with it, and the animal would spin.
  if (!canWalkTo(population, actor, getLookaheadMeters(actor))) {
    if (isTurnSettled(actor)) {
      actor.targetHeadingRadians = actor.headingRadians + TURN_RADIANS;
    }
  }

  // The lookahead turns the animal in time in open country. Where it cannot —
  // a zone narrower than one turning circle — this is what still keeps the
  // body inside its own habitat, at the cost of standing while it turns.
  const distance = actor.species.speedMetersPerSecond * deltaSeconds;
  if (!canWalkTo(population, actor, distance)) return;

  const nextX =
    actor.root.position.x + Math.sin(actor.headingRadians) * distance;
  const nextZ =
    actor.root.position.z + Math.cos(actor.headingRadians) * distance;
  actor.root.position.set(
    nextX,
    population.worldSurface.surfaceYAt(nextX, nextZ),
    nextZ,
  );
}

/** Whether the ground this far along the current heading may be entered. */
function canWalkTo(
  population: AnimalActors,
  actor: AnimalActor,
  distanceMeters: number,
): boolean {
  const worldX =
    actor.root.position.x + Math.sin(actor.headingRadians) * distanceMeters;
  const worldZ =
    actor.root.position.z + Math.cos(actor.headingRadians) * distanceMeters;
  return actor.species.allowedZones.includes(
    population.worldSurface.zoneAt(worldX, worldZ),
  );
}

/** The arc one species turns on, in metres: a stag sweeps, a rat pivots. */
function getTurnRadiusMeters(actor: AnimalActor): number {
  return actor.species.heightMeters * TURN_RADII_PER_BODY_HEIGHT;
}

function getLookaheadMeters(actor: AnimalActor): number {
  return (
    getTurnRadiusMeters(actor) * TURN_LOOKAHEAD_RADII +
    TURN_LOOKAHEAD_MARGIN_METERS
  );
}

/** Advance the heading toward the aimed one by at most this frame's turn. */
function turnTowardTarget(actor: AnimalActor, deltaSeconds: number): void {
  const difference = shortestAngle(
    actor.targetHeadingRadians - actor.headingRadians,
  );
  // The rate is the speed over the turning radius, so the body walks an arc
  // of that radius however fast its species moves.
  const step =
    (actor.species.speedMetersPerSecond / getTurnRadiusMeters(actor)) *
    deltaSeconds;
  actor.headingRadians +=
    Math.abs(difference) <= step ? difference : Math.sign(difference) * step;
}

function isTurnSettled(actor: AnimalActor): boolean {
  const difference = shortestAngle(
    actor.targetHeadingRadians - actor.headingRadians,
  );
  return Math.abs(difference) <= TURN_SETTLED_RADIANS;
}

/** The signed way round from one angle to another, never the long way. */
function shortestAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

function showNearestActors(
  population: AnimalActors,
  viewpoint: Viewpoint,
): void {
  for (const actor of population.actors) actor.selected = false;
  if (!population.group.visible) return;

  showNearestActorPerDirection(population, viewpoint);
  fillRemainingVisibleSlots(population, viewpoint);
}

/** Prefer one nearby actor in each direction before filling empty slots. */
function showNearestActorPerDirection(
  population: AnimalActors,
  viewpoint: Viewpoint,
): void {
  for (
    let directionIndex = 0;
    directionIndex < population.parameters.maxVisible;
    directionIndex += 1
  ) {
    const nearest = findNearestHiddenActor(
      population.actors,
      viewpoint,
      directionIndex,
      population.parameters.maxVisible,
    );
    if (nearest) nearest.selected = true;
  }
}

function fillRemainingVisibleSlots(
  population: AnimalActors,
  viewpoint: Viewpoint,
): void {
  let visibleCount = population.actors.filter(
    ({ selected }) => selected,
  ).length;

  while (visibleCount < population.parameters.maxVisible) {
    const nearest = findNearestHiddenActor(population.actors, viewpoint);
    if (!nearest) return;
    nearest.selected = true;
    visibleCount += 1;
  }
}

function findNearestHiddenActor(
  actors: readonly AnimalActor[],
  viewpoint: Viewpoint,
  directionIndex?: number,
  directionCount?: number,
): AnimalActor | undefined {
  let nearest: AnimalActor | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const actor of actors) {
    if (!actor.hasHabitat || actor.selected) continue;
    if (!isInDirection(actor, viewpoint, directionIndex, directionCount))
      continue;
    const distance = actor.root.position.distanceToSquared(
      viewpoint.worldPosition,
    );
    if (distance >= nearestDistance) continue;
    nearest = actor;
    nearestDistance = distance;
  }
  return nearest;
}

function isInDirection(
  actor: AnimalActor,
  viewpoint: Viewpoint,
  directionIndex: number | undefined,
  directionCount: number | undefined,
): boolean {
  if (directionIndex === undefined || directionCount === undefined) return true;

  const angle = Math.atan2(
    actor.root.position.x - viewpoint.worldPosition.x,
    actor.root.position.z - viewpoint.worldPosition.z,
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
