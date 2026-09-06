/**
 * Purpose: Share the contract for world elements that emit a visible scent.
 * Context: Scent Particles renders signatures for populations it must not import.
 * Responsibility: Name the scent species vocabulary, per-chunk plants, and live bodies.
 * Boundary: Placement stays with each provider; particles and colors stay in Scent.
 */

/**
 * The plant families that carry one scent signature each. Vegetation maps its
 * models onto these; levels author one color and emission per entry. The
 * vocabulary is deliberately coarser than the asset list: a signature the
 * traveler cannot tell apart from its neighbour is not a signature.
 */
export type PlantScentGroupId =
  | "conifer"
  | "deciduous"
  | "birch"
  | "bush"
  | "floweringBush"
  | "deadWood";

export const PLANT_SCENT_GROUP_IDS = [
  "conifer",
  "deciduous",
  "birch",
  "bush",
  "floweringBush",
  "deadWood",
] as const satisfies readonly PlantScentGroupId[];

/**
 * Receive one scent-emitting plant. The height is the plant's authored world
 * height, so a consumer can size the emission volume to the individual plant
 * without knowing which model stands there.
 */
export type PushScentPlant = (
  worldX: number,
  groundY: number,
  worldZ: number,
  heightMeters: number,
  groupId: PlantScentGroupId,
) => void;

/** A deterministic per-chunk plant population exposed to the scent sense. */
export interface PlantScentSource {
  /** Groups emitted by this source; bounds its palette and particle capacity. */
  readonly groupIds: readonly PlantScentGroupId[];

  /**
   * The hard upper bound of plants inside one aligned chunk of the given
   * size. Scent allocates fixed buffers from it, so it must never be
   * exceeded, and a bound far above the real count only wastes memory.
   */
  readonly maxPlantsPerChunk: (chunkSizeMeters: number) => number;

  /** Append every scent-emitting plant inside one aligned world chunk. */
  readonly appendChunkPlants: (
    chunkX: number,
    chunkZ: number,
    chunkSizeMeters: number,
    pushPlant: PushScentPlant,
  ) => void;
}

/** The current animal vocabulary shared by bodies and scent signatures. */
export type AnimalSpeciesId = "deer" | "stag" | "fox" | "rat";

/**
 * Where one live scent-emitting actor stands this frame. The scent sense
 * prints from these positions; it never holds the actor itself.
 */
export interface ScentActorBody {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heightMeters: number;
  readonly speciesId: AnimalSpeciesId;
}

/** Report the currently emitting actors after every world update. */
export type ScentActorObserver = (bodies: readonly ScentActorBody[]) => void;
