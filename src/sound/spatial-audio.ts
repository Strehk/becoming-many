import type { Context } from "tone";

/**
 * Run-owned Tone context and the only listener-pose writer on that context.
 * Sound followers borrow context; they must end before this owner unloads.
 * The native Show timebase remains separate and is never connected here.
 */
export interface SpatialAudio {
  readonly context: Context;
  /** Run calls once per frame after locomotion, using the latest available XR pose. */
  readonly update: () => void;
  readonly unload: () => Promise<void>;
}
