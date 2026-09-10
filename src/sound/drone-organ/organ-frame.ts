import type { OrganVoiceName } from "../../dramaturgy/organ-score";
import type { OrganPlacementGroup } from "./drone-organ-settings";
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
