/**
 * Purpose: Share the contract for world elements joining the Connections web.
 * Context: Several modules expose deterministic anchors; Mycelium consumes them.
 * Responsibility: Type deterministic per-chunk anchor sources.
 * Boundary: Anchor generation stays in each provider; topology stays in Mycelium.
 */

/** The participating world-element class; preset colors and weights key off it. */
export type ConnectionSourceClass =
  | "vegetation"
  | "scentEmitters"
  | "rocks"
  | "soil";

export type PushConnectionAnchor = (
  worldX: number,
  worldY: number,
  worldZ: number,
) => void;

/** Deterministic per-chunk anchors one module exposes to the web. */
export interface ConnectionNodeSource {
  readonly sourceClass: ConnectionSourceClass;
  /** Append every anchor inside one aligned world chunk of the given size. */
  readonly appendChunkAnchors: (
    chunkX: number,
    chunkZ: number,
    chunkSizeMeters: number,
    pushAnchor: PushConnectionAnchor,
  ) => void;
}
