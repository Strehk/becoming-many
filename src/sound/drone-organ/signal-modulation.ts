/**
 * Purpose: Carry one world signal to one control, in range and without jitter.
 * Context: This is the old instrument's patch cable, minus the parts this
 *   composition leaves at their defaults: every cable it plugs in runs at full
 *   strength through a linear curve.
 * Responsibility: Own the range mapping and the inertia.
 * Boundary: Which signal and which control it joins is authored elsewhere.
 */

import type { OrganSignalName } from "./organ-signals";

/** How much inertia the strongest smoothing may hold; never fully frozen. */
const MAX_INERTIA = 0.97;

export interface ModulationSettings {
  /** The world signal this cable carries. */
  readonly source: OrganSignalName;

  /** Control value the signal's zero maps to; above `maximum` it inverts. */
  readonly minimum: number;
  readonly maximum: number;

  /** 0 follows the signal instantly, 1 nearly refuses to move. */
  readonly smoothing: number;
}

export interface Modulation {
  /** The control value this cable stands at after seeing one more frame. */
  readonly follow: (sourceValue: number) => number;
}

export function createModulation(settings: ModulationSettings): Modulation {
  const rate = 1 - Math.min(MAX_INERTIA, settings.smoothing * MAX_INERTIA);
  let current: number | undefined;

  return {
    follow: (sourceValue): number => {
      const target =
        settings.minimum + (settings.maximum - settings.minimum) * sourceValue;
      current =
        current === undefined ? target : current + (target - current) * rate;
      return Math.min(1, Math.max(0, current));
    },
  };
}
