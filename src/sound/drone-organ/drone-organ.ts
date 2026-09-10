/**
 * Purpose: Play the drone organ under the show — the old instrument as a sound
 *   engine, without its user interface.
 * Context: Nine voices, each brought in by the dramaturgy's score, so the
 *   ladder of perception is heard accumulating as much as it is seen. The
 *   composition is fixed; nothing about it is played live.
 * Responsibility: Own the organ's lifetime and the per-frame contract the show
 *   drives it through.
 * Boundary: Run owns the shared Tone context; this lazy follower owns the
 *   organ graph below `organ-runtime.ts`. Voice timing comes from dramaturgy.
 */

import type { SpatialAudio } from "../spatial-audio";
import type { DroneOrgan, DroneOrganOptions } from "./organ-frame";
import type { OrganRuntime } from "./organ-runtime";

/**
 * Lazily build organ followers on the Run-owned Tone context. The organ owns
 * its nodes and pending import; it neither writes listener pose nor closes
 * the borrowed context. A cancelled import never publishes live voices.
 */
export function createDroneOrgan(
  options: DroneOrganOptions,
  audio: SpatialAudio,
): DroneOrgan {
  let runtime: OrganRuntime | undefined;
  const cancellation = new AbortController();
  let unloading: Promise<void> | undefined;
  const loading = import("./organ-runtime").then(
    async ({ startOrganRuntime }) => {
      runtime = await startOrganRuntime(options, audio, cancellation.signal);
    },
  );
  // Observe a failed lazy start immediately; unload still returns that failure.
  void loading.catch((error: unknown) =>
    console.error("Organ startup failed", error),
  );

  return {
    update: (frame): void => {
      if (!cancellation.signal.aborted) runtime?.update(frame);
    },
    unload: (): Promise<void> => {
      cancellation.abort();
      unloading ??= loading.then(() => runtime?.unload());
      return unloading;
    },
  };
}
