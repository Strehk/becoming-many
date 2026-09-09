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

import type { OrganVoiceName } from "../../dramaturgy/organ-score";
import type { SpatialAudio } from "../spatial-audio.runtime";
import type { OrganPlacementGroup } from "./drone-organ-settings";
import type { OrganRuntime } from "./organ-runtime";
import type { ListenerPose } from "./organ-signals";
import type { OrganClock } from "./organ-timeline";

export interface DroneOrganOptions {
  /** One beat of the score's pulse, in show seconds. */
  readonly pulseSeconds: number;
  /** Omission builds the full score; standalone practice borrows only wind. */
  readonly voices?: readonly OrganVoiceName[];
}

/**
 * What the show hands the organ each frame. Time is the show clock's: the
 * organ has no transport, and every step it plays is derived from
 * `showTimeSeconds`, so a seek lands where playing through would have.
 */
export interface DroneOrganFrame extends OrganClock {
  /** How strongly each voice sounds, 0..1, as the score derives it. */
  readonly voiceStrengths: Readonly<Record<OrganVoiceName, number>>;

  readonly listener: ListenerPose;

  /** World height under the listener; the height signal is measured from it. */
  readonly groundYMeters: number;

  /**
   * Tightly packed world xyz triples of one placement group's live clouds. An
   * empty array is a legitimate answer: the group's module may be unloaded, or
   * the level may not carry it at all.
   */
  readonly readGroupCenters: (group: OrganPlacementGroup) => Float32Array;
}

export interface DroneOrgan {
  readonly update: (frame: DroneOrganFrame) => void;

  /** Part of the explicit lifecycle; the organ owns every node it built. */
  readonly unload: () => Promise<void>;
}

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
