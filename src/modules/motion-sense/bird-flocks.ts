/**
 * Purpose: Simulate the invisible bird flocks whose flight prints motion trails.
 * Context: Birds are perception-only actors; only their traces in the air are real.
 * Responsibility: Own deterministic flock orbits, wing-flap point motion, and the position stream.
 * Boundary: Trail printing, materials, rendering, and module lifecycle stay elsewhere.
 */

import type { WorldSurface } from "../../world-surface/world-surface";
import { getMotionRandom } from "./motion-random";
import {
  MOTION_SENSE_SETTINGS,
  type MotionSenseParameters,
} from "./motion-sense-settings";

const COMPONENTS_PER_VALUE = 3;
const TAU = Math.PI * 2;

/** Fixed random channel indexes keeping every hash stream independent. */
const BIRD_RANDOM_SCATTER_ANGLE = 0;
const BIRD_RANDOM_SCATTER_RADIUS = 1;
const BIRD_RANDOM_SCATTER_HEIGHT = 2;
const BIRD_RANDOM_FLAP_FREQUENCY = 3;
const BIRD_RANDOM_FLAP_PHASE = 4;
const FLOCK_RANDOM_START_ANGLE = 5;

type BirdParameters = NonNullable<MotionSenseParameters["birds"]>;

interface BirdFlocksOptions {
  readonly birds: BirdParameters;
  readonly groundYAt: WorldSurface["groundYAt"];
  readonly initialPlayerX: number;
  readonly initialPlayerZ: number;
}

/**
 * Pure data actor: no scene object exists because the bird bodies stay
 * invisible. The position stream feeds one Motion Trail ring through the
 * module's `MotionPointSource` seam.
 */
export interface BirdFlocks {
  /** Tightly packed world xyz triples of every bird point; stable identity. */
  readonly getWorldPositions: () => Float32Array;

  /**
   * Tightly packed world xyz triples, one per flock: where the flock itself
   * is, rather than where its individual birds are. Spatial audio places a
   * sound on the nearest flock through this; stable identity.
   */
  readonly getFlockCenters: () => Float32Array;
  readonly update: (
    deltaSeconds: number,
    playerX: number,
    playerZ: number,
  ) => void;
}

/** Count the trail points one bird parameter block produces. */
export function getBirdPointCount(birds: BirdParameters): number {
  return (
    birds.flockCount *
    birds.birdsPerFlock *
    MOTION_SENSE_SETTINGS.birdPointsPerBird
  );
}

/** Allocate the fixed flock pool orbiting air rings around the traveler. */
export function createBirdFlocks(options: BirdFlocksOptions): BirdFlocks {
  const { birds } = options;
  const settings = MOTION_SENSE_SETTINGS;
  const birdCount = birds.flockCount * birds.birdsPerFlock;
  const worldPositions = new Float32Array(
    getBirdPointCount(birds) * COMPONENTS_PER_VALUE,
  );
  const scatterOffsets = new Float32Array(birdCount * COMPONENTS_PER_VALUE);
  const flapFrequencies = new Float32Array(birdCount);
  const flapPhases = new Float32Array(birdCount);
  const anchors = Array.from({ length: birds.flockCount }, () => ({
    x: options.initialPlayerX,
    z: options.initialPlayerZ,
  }));
  const orbitAngles = new Float32Array(birds.flockCount);
  const flockCenters = new Float32Array(
    birds.flockCount * COMPONENTS_PER_VALUE,
  );
  let elapsedSeconds = 0;

  for (let birdIndex = 0; birdIndex < birdCount; birdIndex += 1) {
    const valueOffset = birdIndex * COMPONENTS_PER_VALUE;
    const scatterAngle =
      getMotionRandom(birdIndex, BIRD_RANDOM_SCATTER_ANGLE) * TAU;
    const scatterRadius =
      Math.sqrt(getMotionRandom(birdIndex, BIRD_RANDOM_SCATTER_RADIUS)) *
      settings.birdScatter.radiusMeters;
    scatterOffsets[valueOffset] = Math.cos(scatterAngle) * scatterRadius;
    scatterOffsets[valueOffset + 1] =
      (getMotionRandom(birdIndex, BIRD_RANDOM_SCATTER_HEIGHT) * 2 - 1) *
      settings.birdScatter.heightMeters;
    scatterOffsets[valueOffset + 2] = Math.sin(scatterAngle) * scatterRadius;
    flapFrequencies[birdIndex] =
      settings.birdFlapFrequency.minHertz +
      getMotionRandom(birdIndex, BIRD_RANDOM_FLAP_FREQUENCY) *
        (settings.birdFlapFrequency.maxHertz -
          settings.birdFlapFrequency.minHertz);
    flapPhases[birdIndex] =
      getMotionRandom(birdIndex, BIRD_RANDOM_FLAP_PHASE) * TAU;
  }
  for (let flockIndex = 0; flockIndex < birds.flockCount; flockIndex += 1) {
    orbitAngles[flockIndex] =
      getMotionRandom(flockIndex, FLOCK_RANDOM_START_ANGLE) * TAU;
  }

  const writePositions = (): void => {
    for (let flockIndex = 0; flockIndex < birds.flockCount; flockIndex += 1) {
      writeFlockPositions({
        options,
        flockIndex,
        anchor: anchors[flockIndex] ?? { x: 0, z: 0 },
        orbitAngle: orbitAngles[flockIndex] ?? 0,
        elapsedSeconds,
        worldPositions,
        flockCenters,
        scatterOffsets,
        flapFrequencies,
        flapPhases,
      });
    }
  };
  writePositions();

  return {
    getWorldPositions: () => worldPositions,
    getFlockCenters: () => flockCenters,
    update: (deltaSeconds, playerX, playerZ) => {
      if (deltaSeconds <= 0) return;

      elapsedSeconds += deltaSeconds;
      for (let flockIndex = 0; flockIndex < birds.flockCount; flockIndex += 1) {
        const anchor = anchors[flockIndex];
        if (!anchor) continue;

        // Flock centres drift gently after the traveler instead of being
        // rigidly attached, so orbits feel anchored in the world.
        anchor.x += (playerX - anchor.x) * settings.birdAnchorFollowRate;
        anchor.z += (playerZ - anchor.z) * settings.birdAnchorFollowRate;
        orbitAngles[flockIndex] =
          (orbitAngles[flockIndex] ?? 0) +
          (birds.flightSpeedMetersPerSecond /
            getOrbitRadius(flockIndex, birds.flockCount)) *
            deltaSeconds;
      }
      writePositions();
    },
  };
}

/** The orbit radius for one flock, interpolated near to far across the pool. */
function getOrbitRadius(flockIndex: number, flockCount: number): number {
  const { birdOrbitRadius } = MOTION_SENSE_SETTINGS;
  const mix = flockCount <= 1 ? 0 : flockIndex / (flockCount - 1);
  return (
    birdOrbitRadius.minMeters +
    (birdOrbitRadius.maxMeters - birdOrbitRadius.minMeters) * mix
  );
}

interface FlockWriteInput {
  readonly options: BirdFlocksOptions;
  readonly flockIndex: number;
  readonly anchor: { readonly x: number; readonly z: number };
  readonly orbitAngle: number;
  readonly elapsedSeconds: number;
  readonly worldPositions: Float32Array;
  readonly flockCenters: Float32Array;
  readonly scatterOffsets: Float32Array;
  readonly flapFrequencies: Float32Array;
  readonly flapPhases: Float32Array;
}

/** Compose body and wingtip world positions for every bird of one flock. */
function writeFlockPositions(input: FlockWriteInput): void {
  const { birds, groundYAt } = input.options;
  const settings = MOTION_SENSE_SETTINGS;
  const radius = getOrbitRadius(input.flockIndex, birds.flockCount);
  const centerX = input.anchor.x + Math.cos(input.orbitAngle) * radius;
  const centerZ = input.anchor.z + Math.sin(input.orbitAngle) * radius;

  // The flight heading is the orbit tangent; wings extend perpendicular.
  const headingX = -Math.sin(input.orbitAngle);
  const headingZ = Math.cos(input.orbitAngle);
  const lateralX = -headingZ;
  const lateralZ = headingX;
  const halfSpan = settings.birdWingSpanMeters / 2;

  // Where the flock as a whole is: its orbit point at flight height. One extra
  // ground sample per flock, which is what spatial audio needs to place it.
  const centerOffset = input.flockIndex * COMPONENTS_PER_VALUE;
  input.flockCenters[centerOffset] = centerX;
  input.flockCenters[centerOffset + 1] =
    groundYAt(centerX, centerZ) + birds.flightHeightMeters;
  input.flockCenters[centerOffset + 2] = centerZ;

  for (let localIndex = 0; localIndex < birds.birdsPerFlock; localIndex += 1) {
    const birdIndex = input.flockIndex * birds.birdsPerFlock + localIndex;
    const scatterOffset = birdIndex * COMPONENTS_PER_VALUE;
    const bodyX = centerX + (input.scatterOffsets[scatterOffset] ?? 0);
    const bodyZ = centerZ + (input.scatterOffsets[scatterOffset + 2] ?? 0);
    const bodyY =
      groundYAt(bodyX, bodyZ) +
      birds.flightHeightMeters +
      (input.scatterOffsets[scatterOffset + 1] ?? 0);
    const flapTime =
      input.elapsedSeconds * (input.flapFrequencies[birdIndex] ?? 6) * TAU +
      (input.flapPhases[birdIndex] ?? 0);
    const flapLift = Math.sin(flapTime) * settings.birdFlapAmplitudeMeters;

    const pointOffset =
      birdIndex * settings.birdPointsPerBird * COMPONENTS_PER_VALUE;
    input.worldPositions[pointOffset] = bodyX;
    input.worldPositions[pointOffset + 1] = bodyY;
    input.worldPositions[pointOffset + 2] = bodyZ;
    input.worldPositions[pointOffset + 3] = bodyX + lateralX * halfSpan;
    input.worldPositions[pointOffset + 4] = bodyY + flapLift;
    input.worldPositions[pointOffset + 5] = bodyZ + lateralZ * halfSpan;
    input.worldPositions[pointOffset + 6] = bodyX - lateralX * halfSpan;
    input.worldPositions[pointOffset + 7] = bodyY + flapLift;
    input.worldPositions[pointOffset + 8] = bodyZ - lateralZ * halfSpan;
  }
}
