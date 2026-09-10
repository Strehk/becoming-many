import type { Context } from "tone";

export interface SpatialSourceParameters {
  readonly referenceDistanceMeters: number;
  readonly maximumDistanceMeters: number;
  readonly rolloffFactor: number;
}

/** Playback and its input node remain owned by the caller. Coordinates are metres. */
export interface SpatialSource {
  readonly setPosition: (x: number, y: number, z: number) => void;
  /** Metres from this object to the shared, last published listener pose. */
  readonly readDistanceMeters: () => number;
  readonly unload: () => void;
}

/**
 * Run-owned Tone context and the only listener-pose writer on that context.
 * Sound followers borrow context; they must end before this owner unloads.
 * The native Show timebase remains separate and is never connected here.
 */
export interface SpatialAudio {
  readonly context: Context;
  readonly createSource: (
    input: AudioNode,
    parameters: SpatialSourceParameters,
  ) => SpatialSource;
  /** Run calls once per frame after locomotion, using the latest available XR pose. */
  readonly update: () => void;
  readonly unload: () => Promise<void>;
}
