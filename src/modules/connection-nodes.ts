/**
 * Purpose: Share the contract for world elements joining the Connections web.
 * Context: Several modules expose deterministic anchors; Mycelium consumes them.
 * Responsibility: Type static per-chunk anchor sources and live actor sources.
 * Boundary: Anchor generation stays in each provider; topology stays in Mycelium.
 */

/** The participating world-element class; preset colors and weights key off it. */
export type ConnectionSourceClass =
  | "vegetation"
  | "scentEmitters"
  | "animals"
  | "rocks";

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

/** Live world positions of a bounded moving population. */
export interface ConnectionActorSource {
  readonly sourceClass: ConnectionSourceClass;
  /** Tightly packed world xyz triples of the currently visible actors. */
  readonly getWorldPositions: () => Float32Array;
}
