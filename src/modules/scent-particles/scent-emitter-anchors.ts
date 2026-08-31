/**
 * Purpose: Locate the deterministic forest-bound scent emitter anchors.
 * Context: The particle field renders clouds here; the Connections web links the same spots.
 * Responsibility: Own the shared anchor search, its random stream, and the anchor node source.
 * Boundary: Particle buffers, colors, motion, and lifecycle stay in the field and module.
 */

import { getChunkSize } from "../../world/chunk-system";
import type { WorldSurface } from "../../world-surface/world-surface";
import type { ZoneId } from "../../world-surface/zone-settings";
import type { ConnectionNodeSource } from "../connection-nodes";
import {
  SCENT_PARTICLES_SETTINGS,
  type ScentParticlesParameters,
} from "./scent-particles-settings";

const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/** Fixed emitter-level random component indexes shared with the field. */
const EMITTER_RANDOM_HEIGHT = 2;
const CANDIDATE_RANDOM_FIRST = 8;

/** The absolute chunk identity that seeds every emitter random value. */
export interface ScentEmitterChunk {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originZ: number;
}

export interface ScentEmitterAnchor {
  readonly worldX: number;
  readonly worldY: number;
  readonly worldZ: number;
}

/**
 * Try a bounded number of deterministic candidate positions and keep the
 * first one inside a scent source zone, anchored just above the ground.
 * Revisiting a chunk recreates the same anchors.
 */
export function findScentEmitterAnchor(
  chunk: ScentEmitterChunk,
  chunkSizeMeters: number,
  placement: ScentParticlesParameters["placement"],
  groundYAt: WorldSurface["groundYAt"],
  zoneAt: WorldSurface["zoneAt"],
  emitterIndex: number,
): ScentEmitterAnchor | undefined {
  const sourceZones: readonly ZoneId[] = SCENT_PARTICLES_SETTINGS.sourceZones;

  for (
    let attempt = 0;
    attempt < SCENT_PARTICLES_SETTINGS.placementAttemptsPerEmitter;
    attempt += 1
  ) {
    const componentBase = CANDIDATE_RANDOM_FIRST + attempt * 2;
    const worldX =
      chunk.originX +
      getScentRandom(chunk, emitterIndex, -1, componentBase) * chunkSizeMeters;
    const worldZ =
      chunk.originZ +
      getScentRandom(chunk, emitterIndex, -1, componentBase + 1) *
        chunkSizeMeters;
    if (!sourceZones.includes(zoneAt(worldX, worldZ))) continue;

    const heightRandom = getScentRandom(
      chunk,
      emitterIndex,
      -1,
      EMITTER_RANDOM_HEIGHT,
    );
    const worldY =
      groundYAt(worldX, worldZ) +
      placement.minHeightMeters +
      heightRandom * (placement.maxHeightMeters - placement.minHeightMeters);

    return { worldX, worldY, worldZ };
  }

  return undefined;
}

/** Expose the level-authored scent emitter anchors as web anchors. */
export function createScentConnectionSource(
  parameters: ScentParticlesParameters,
  groundYAt: WorldSurface["groundYAt"],
  zoneAt: WorldSurface["zoneAt"],
): ConnectionNodeSource {
  const scentChunkSize = getChunkSize(SCENT_PARTICLES_SETTINGS.chunkLevel);

  return {
    sourceClass: "scentEmitters",
    appendChunkAnchors: (chunkX, chunkZ, chunkSizeMeters, pushAnchor) => {
      const chunkRatio = scentChunkSize / chunkSizeMeters;
      if (!Number.isInteger(chunkRatio) || chunkRatio < 1) {
        throw new RangeError(
          "Anchor requests must align with the scent chunk grid",
        );
      }
      const scentChunkX = Math.floor(chunkX / chunkRatio);
      const scentChunkZ = Math.floor(chunkZ / chunkRatio);
      const chunk: ScentEmitterChunk = {
        chunkX: scentChunkX,
        chunkZ: scentChunkZ,
        originX: scentChunkX * scentChunkSize,
        originZ: scentChunkZ * scentChunkSize,
      };
      const minX = chunkX * chunkSizeMeters;
      const minZ = chunkZ * chunkSizeMeters;

      // The requested sub-chunks of one scent chunk partition its emitters.
      for (
        let emitterIndex = 0;
        emitterIndex < parameters.placement.emittersPerChunk;
        emitterIndex += 1
      ) {
        const anchor = findScentEmitterAnchor(
          chunk,
          scentChunkSize,
          parameters.placement,
          groundYAt,
          zoneAt,
          emitterIndex,
        );
        if (!anchor) continue;
        if (anchor.worldX < minX || anchor.worldX >= minX + chunkSizeMeters) {
          continue;
        }
        if (anchor.worldZ < minZ || anchor.worldZ >= minZ + chunkSizeMeters) {
          continue;
        }
        pushAnchor(anchor.worldX, anchor.worldY, anchor.worldZ);
      }
    },
  };
}

/**
 * Return one stable pseudo-random value in [0, 1) without keeping RNG state.
 * Emitter-level values pass particleIndex -1 so they share no stream with
 * their particles.
 */
export function getScentRandom(
  chunk: Pick<ScentEmitterChunk, "chunkX" | "chunkZ">,
  emitterIndex: number,
  particleIndex: number,
  componentIndex: number,
): number {
  let hash = Math.imul(chunk.chunkX, 73_856_093);
  hash ^= Math.imul(chunk.chunkZ, 19_349_663);
  hash ^= Math.imul(emitterIndex + 1, 2_971_215_073);
  hash ^= Math.imul(particleIndex + 2, 83_492_791);
  hash ^= Math.imul(componentIndex + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
