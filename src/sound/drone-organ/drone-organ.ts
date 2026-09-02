/**
 * Purpose: Play the drone organ under the show — the old instrument as a sound
 *   engine, without its user interface.
 * Context: Nine layers, each opened by one of the show's senses, so the ladder
 *   of perception is heard accumulating as much as it is seen. The composition
 *   is fixed; nothing about it is played live.
 * Responsibility: Own the organ's lifetime and the per-frame contract the show
 *   drives it through.
 * Boundary: Tone.js and the whole audio graph hang below `organ-runtime.ts`,
 *   which this file loads only once a show actually asks for the organ. When a
 *   sense rises is decided in `src/dramaturgy`.
 */

import type { ShowSense } from "../../dramaturgy/show-levels";
import type { OrganPlacementGroup } from "./drone-organ-settings";
import type { OrganRuntime } from "./organ-runtime";
import type { ListenerPose } from "./organ-signals";

export interface DroneOrganFrame {
  /** A held show holds the beat; the drones keep breathing through it. */
  readonly isPlaying: boolean;

  /** What opens the gated layers, on the same 0..1 scale the world uses. */
  readonly senseStrengths: Readonly<Record<ShowSense, number>>;

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
  readonly unload: () => void;
}

/**
 * Start the organ. Tone.js arrives with the dynamic import below and not
 * before: importing it builds an AudioContext of its own — the one the organ
 * then plays on — and a benchmark run or a bare level page must not pay for
 * one. Until the import lands the returned organ accepts frames and does
 * nothing with them.
 */
export function createDroneOrgan(): DroneOrgan {
  let runtime: OrganRuntime | undefined;
  let isUnloaded = false;

  void import("./organ-runtime").then(({ startOrganRuntime }) => {
    if (isUnloaded) return;

    runtime = startOrganRuntime();
  });

  return {
    update: (frame): void => {
      runtime?.update(frame);
    },

    unload: (): void => {
      isUnloaded = true;
      runtime?.dispose();
      runtime = undefined;
    },
  };
}
