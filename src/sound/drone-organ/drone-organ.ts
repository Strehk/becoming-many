/**
 * Purpose: Play the drone organ under the show — the old instrument as a sound
 *   engine, without its user interface.
 * Context: Nine voices, each brought in by the dramaturgy's score, so the
 *   ladder of perception is heard accumulating as much as it is seen. The
 *   composition is fixed; nothing about it is played live.
 * Responsibility: Own the organ's lifetime and the per-frame contract the show
 *   drives it through.
 * Boundary: Tone.js and the whole audio graph hang below `organ-runtime.ts`,
 *   which this file loads only once a show actually asks for the organ. When
 *   a voice sounds, and to what pulse, is decided in `src/dramaturgy`.
 */

import type { OrganVoiceName } from "../../dramaturgy/organ-score";
import type { OrganPlacementGroup } from "./drone-organ-settings";
import type { OrganRuntime } from "./organ-runtime";
import type { ListenerPose } from "./organ-signals";
import type { OrganClock } from "./organ-timeline";

export interface DroneOrganOptions {
  /** One beat of the score's pulse, in show seconds. */
  readonly pulseSeconds: number;
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
  readonly unload: () => void;
}

/**
 * Start the organ. Tone.js arrives with the dynamic import below and not
 * before: importing it builds an AudioContext of its own — the one the organ
 * then plays on — and a benchmark run or a bare level page must not pay for
 * one. Until the import lands the returned organ accepts frames and does
 * nothing with them.
 */
export function createDroneOrgan(options: DroneOrganOptions): DroneOrgan {
  let runtime: OrganRuntime | undefined;
  let isUnloaded = false;

  void import("./organ-runtime").then(({ startOrganRuntime }) => {
    if (isUnloaded) return;

    runtime = startOrganRuntime(options);
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
