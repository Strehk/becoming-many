/**
 * Purpose: Provide the stateless random stream shared by the scent buffers.
 * Context: Scent data regenerates on chunk recycling and must repeat exactly.
 * Responsibility: Hash one scent coordinate and a component index into [0, 1).
 * Boundary: What each coordinate means stays with the calling buffer.
 */

const RANDOM_VALUE_RANGE = 0x1_0000_0000;

/**
 * Which scent value is being drawn: the absolute chunk, the source inside it,
 * and the particle of that source. Source-level values pass a particle index
 * of -1 so they share no stream with their particles. Callers reuse one
 * mutable key across a buffer write instead of allocating per particle.
 */
export interface ScentRandomKey {
  chunkX: number;
  chunkZ: number;
  sourceIndex: number;
  particleIndex: number;
}

export function createScentRandomKey(): ScentRandomKey {
  return { chunkX: 0, chunkZ: 0, sourceIndex: 0, particleIndex: -1 };
}

/**
 * Return one stable pseudo-random value in [0, 1) without keeping RNG state,
 * so revisiting a chunk recreates exactly the same scent.
 *
 * The mixing is unchanged from the first Scent World release: the Connections
 * web links positions this function produced, and level 07 must keep them.
 */
export function getScentRandom(
  key: ScentRandomKey,
  componentIndex: number,
): number {
  let hash = Math.imul(key.chunkX, 73_856_093);
  hash ^= Math.imul(key.chunkZ, 19_349_663);
  hash ^= Math.imul(key.sourceIndex + 1, 2_971_215_073);
  hash ^= Math.imul(key.particleIndex + 2, 83_492_791);
  hash ^= Math.imul(componentIndex + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);

  return (hash >>> 0) / RANDOM_VALUE_RANGE;
}
