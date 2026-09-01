/**
 * Purpose: Print and render the scent an animal leaves along the route it walks.
 * Context: Animals wander live; their scent must stay behind them, not travel with them.
 * Responsibility: Own the fixed print ring, its partial uploads, and disposal.
 * Boundary: Animal behavior, visibility budgets, and the world clock stay elsewhere.
 */

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Points,
  type PointsMaterial,
} from "three";
import type { ScentActorBody } from "../scent-sources";
import {
  createScentTrailMaterial,
  type ScentParticleMaterial,
} from "./scent-particle-material";
import type {
  AnimalScentParameters,
  ScentParticlesParameters,
} from "./scent-particles-settings";
import {
  createScentRandomKey,
  getScentRandom,
  type ScentRandomKey,
} from "./scent-random";

const COMPONENTS_PER_VALUE = 3;

/** Fixed per-print random component indexes. */
const PRINT_RANDOM_HEIGHT = 0;
const PRINT_RANDOM_SCATTER_X = 1;
const PRINT_RANDOM_SCATTER_Z = 3;
const PRINT_RANDOM_PHASE = 5;

/**
 * Bound the catch-up after a long frame. Without it, one stalled frame would
 * spend a whole ring on a single animal and erase the routes around it.
 */
const MAXIMUM_PRINTS_PER_BODY_PER_FRAME = 8;

interface ScentTrailFieldOptions {
  readonly parameters: ScentParticlesParameters;
  readonly animals: AnimalScentParameters;
  readonly maxActorCount: number;
  /** Shared with the module handle; a show fades the sense through it. */
  readonly senseFadeUniform?: { readonly value: number };
}

/** One fixed print ring shared by every actor, drawn in one opaque call. */
export interface ScentTrailField {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  readonly material: ScentParticleMaterial;
  readonly animals: AnimalScentParameters;
  readonly capacity: number;
  readonly speciesColors: Float32Array;
  readonly colorIndexBySpecies: ReadonlyMap<string, number>;
  readonly printedPositions: Float32Array;
  readonly printedColors: Float32Array;
  readonly printTimes: Float32Array;
  readonly printedPhases: Float32Array;
  readonly printedVisibility: Float32Array;
  readonly positionAttribute: BufferAttribute;
  readonly colorAttribute: BufferAttribute;
  readonly printTimeAttribute: BufferAttribute;
  readonly phaseAttribute: BufferAttribute;
  readonly visibilityAttribute: BufferAttribute;

  /** Fractional prints each actor slot still owes, kept between frames. */
  readonly pendingPrints: Float32Array;

  /** Reused across prints so no print allocates its own key. */
  readonly randomKey: ScentRandomKey;
  printCursor: number;
  printCounter: number;
}

/** Allocate the print ring from the actor budget, print rate, and lifetime. */
export function createScentTrailField({
  parameters,
  animals,
  maxActorCount,
  senseFadeUniform,
}: ScentTrailFieldOptions): ScentTrailField {
  const printsPerActor = Math.ceil(
    animals.printsPerSecond * animals.lifetimeSeconds,
  );
  const capacity = Math.max(1, maxActorCount * printsPerActor);
  const printedPositions = new Float32Array(capacity * COMPONENTS_PER_VALUE);
  const printedColors = new Float32Array(capacity * COMPONENTS_PER_VALUE);
  const printTimes = new Float32Array(capacity);
  const printedPhases = new Float32Array(capacity);
  const printedVisibility = new Float32Array(capacity);
  const positionAttribute = new BufferAttribute(
    printedPositions,
    COMPONENTS_PER_VALUE,
  );
  const colorAttribute = new BufferAttribute(
    printedColors,
    COMPONENTS_PER_VALUE,
  );
  const printTimeAttribute = new BufferAttribute(printTimes, 1);
  const phaseAttribute = new BufferAttribute(printedPhases, 1);
  const visibilityAttribute = new BufferAttribute(printedVisibility, 1);
  positionAttribute.setUsage(DynamicDrawUsage);
  colorAttribute.setUsage(DynamicDrawUsage);
  printTimeAttribute.setUsage(DynamicDrawUsage);
  phaseAttribute.setUsage(DynamicDrawUsage);
  visibilityAttribute.setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("color", colorAttribute);
  geometry.setAttribute("scentPrintTime", printTimeAttribute);
  geometry.setAttribute("scentPhase", phaseAttribute);
  geometry.setAttribute("scentVisible", visibilityAttribute);
  const material = createScentTrailMaterial({
    appearance: parameters.appearance,
    motion: parameters.motion,
    animals,
    senseFadeUniform,
  });
  const points = new Points(geometry, material.pointsMaterial);

  // Prints stay where they were left, so the ring spans wherever the animals
  // have been. Its bounds change constantly; object culling would rebuild
  // them every frame for one draw call that is already small.
  points.frustumCulled = false;

  const speciesIds = Object.keys(animals.signatures);

  return {
    points,
    material,
    animals,
    capacity,
    speciesColors: createSpeciesColors(animals, speciesIds),
    colorIndexBySpecies: new Map(
      speciesIds.map((speciesId, index) => [speciesId, index]),
    ),
    printedPositions,
    printedColors,
    printTimes,
    printedPhases,
    printedVisibility,
    positionAttribute,
    colorAttribute,
    printTimeAttribute,
    phaseAttribute,
    visibilityAttribute,
    pendingPrints: new Float32Array(maxActorCount),
    randomKey: createScentRandomKey(),
    printCursor: 0,
    printCounter: 0,
  };
}

/**
 * Print this frame's share of scent for every emitting actor and upload only
 * the range that changed. Prints are spent at the authored rate rather than
 * once per frame, so the trail keeps its spacing at any frame rate.
 */
export function printScentTrail(
  field: ScentTrailField,
  bodies: readonly ScentActorBody[],
  timeSeconds: number,
  deltaSeconds: number,
): void {
  const firstPrintIndex = field.printCursor;
  let printCount = 0;

  for (let bodyIndex = 0; bodyIndex < bodies.length; bodyIndex += 1) {
    const body = bodies[bodyIndex];
    const pending = field.pendingPrints[bodyIndex];
    if (!body || pending === undefined) break;

    const owed = pending + field.animals.printsPerSecond * deltaSeconds;
    const prints = Math.min(
      Math.floor(owed),
      MAXIMUM_PRINTS_PER_BODY_PER_FRAME,
    );
    field.pendingPrints[bodyIndex] = owed - Math.floor(owed);

    const colorIndex = field.colorIndexBySpecies.get(body.speciesId);
    if (colorIndex === undefined) continue;

    for (let print = 0; print < prints; print += 1) {
      writePrint(field, body, colorIndex, timeSeconds);
      printCount += 1;
    }
  }

  if (printCount === 0) return;
  markUploadRanges(field, firstPrintIndex, printCount);
}

export function disposeScentTrailField(field: ScentTrailField): void {
  field.points.geometry.dispose();
  field.points.material.dispose();
}

/** Write one print into the ring and advance the cursor over the oldest. */
function writePrint(
  field: ScentTrailField,
  body: ScentActorBody,
  colorIndex: number,
  timeSeconds: number,
): void {
  const { animals, randomKey } = field;
  const printIndex = field.printCursor;
  // Every print draws from a fresh coordinate, so consecutive prints of one
  // animal scatter independently instead of stacking on one offset.
  randomKey.chunkX = field.printCounter;
  randomKey.chunkZ = printIndex;
  const valueOffset = printIndex * COMPONENTS_PER_VALUE;
  const colorValueOffset = colorIndex * COMPONENTS_PER_VALUE;
  const emissionRadius = animals.emissionRadiusFraction * body.heightMeters;
  const heightRandom = getScentRandom(randomKey, PRINT_RANDOM_HEIGHT);
  const heightFraction =
    animals.emissionBottomFraction +
    heightRandom *
      (animals.emissionTopFraction - animals.emissionBottomFraction);

  field.printedPositions[valueOffset] =
    body.x + getPrintScatter(randomKey, PRINT_RANDOM_SCATTER_X, emissionRadius);
  field.printedPositions[valueOffset + 1] =
    body.y + heightFraction * body.heightMeters;
  field.printedPositions[valueOffset + 2] =
    body.z + getPrintScatter(randomKey, PRINT_RANDOM_SCATTER_Z, emissionRadius);

  for (let component = 0; component < COMPONENTS_PER_VALUE; component += 1) {
    field.printedColors[valueOffset + component] =
      field.speciesColors[colorValueOffset + component] ?? 0;
  }

  field.printTimes[printIndex] = timeSeconds;
  // Its own bearing, so a route frays apart instead of sliding as one thread.
  field.printedPhases[printIndex] = getScentRandom(
    randomKey,
    PRINT_RANDOM_PHASE,
  );
  field.printedVisibility[printIndex] = 1;
  field.printCursor = (printIndex + 1) % field.capacity;
  field.printCounter += 1;
}

/** Upload only the written prints; a ring wrap splits them into two ranges. */
function markUploadRanges(
  field: ScentTrailField,
  firstPrintIndex: number,
  printCount: number,
): void {
  const tailCount = Math.min(printCount, field.capacity - firstPrintIndex);
  addUploadRange(field, firstPrintIndex, tailCount);
  if (printCount > tailCount) addUploadRange(field, 0, printCount - tailCount);

  field.positionAttribute.needsUpdate = true;
  field.colorAttribute.needsUpdate = true;
  field.printTimeAttribute.needsUpdate = true;
  field.phaseAttribute.needsUpdate = true;
  field.visibilityAttribute.needsUpdate = true;
}

function addUploadRange(
  field: ScentTrailField,
  firstPrintIndex: number,
  printCount: number,
): void {
  const valueStart = firstPrintIndex * COMPONENTS_PER_VALUE;
  const valueCount = printCount * COMPONENTS_PER_VALUE;
  field.positionAttribute.addUpdateRange(valueStart, valueCount);
  field.colorAttribute.addUpdateRange(valueStart, valueCount);
  field.printTimeAttribute.addUpdateRange(firstPrintIndex, printCount);
  field.phaseAttribute.addUpdateRange(firstPrintIndex, printCount);
  field.visibilityAttribute.addUpdateRange(firstPrintIndex, printCount);
}

/**
 * Return one symmetric scatter offset that thins toward the boundary, so the
 * print reads as a body's worth of scent rather than a hard puff.
 */
function getPrintScatter(
  randomKey: ScentRandomKey,
  componentIndex: number,
  halfExtent: number,
): number {
  const firstDraw = getScentRandom(randomKey, componentIndex);
  const secondDraw = getScentRandom(randomKey, componentIndex + 1);
  return (firstDraw + secondDraw - 1) * halfExtent;
}

/** Convert the authored species signatures once into working-color triples. */
function createSpeciesColors(
  animals: AnimalScentParameters,
  speciesIds: readonly string[],
): Float32Array {
  const speciesColors = new Float32Array(
    speciesIds.length * COMPONENTS_PER_VALUE,
  );
  const converter = new Color();

  speciesIds.forEach((speciesId, speciesIndex) => {
    const signature = animals.signatures[speciesId];
    if (!signature) return;
    converter.set(signature.color);
    const valueOffset = speciesIndex * COMPONENTS_PER_VALUE;
    speciesColors[valueOffset] = converter.r;
    speciesColors[valueOffset + 1] = converter.g;
    speciesColors[valueOffset + 2] = converter.b;
  });

  return speciesColors;
}
