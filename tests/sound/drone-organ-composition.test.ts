/**
 * Purpose: Lock the composed organ against the show it plays under.
 * Context: The composition is authored data ported from the instrument's own
 *   editor, so what it must satisfy is a contract, not an implementation.
 * Responsibility: Cover the voice vocabulary and the control ranges.
 * Boundary: How a voice sounds is not decidable outside a browser.
 */

import { describe, expect, test } from "bun:test";
import { ORGAN_VOICES } from "../../src/dramaturgy/organ-score";
import { DRONE_ORGAN_COMPOSITION } from "../../src/sound/drone-organ/drone-organ-settings";

const { layers } = DRONE_ORGAN_COMPOSITION;

function isControlValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

describe("the composed organ", () => {
  test("builds exactly one layer for every voice of the score", () => {
    const names = layers.map((layer) => layer.name);
    expect([...names].sort()).toEqual([...ORGAN_VOICES].sort());
  });

  test("keeps every control inside the range the knobs turned in", () => {
    for (const layer of layers) {
      expect(isControlValue(layer.volume)).toBe(true);
      expect(isControlValue(layer.roomSend)).toBe(true);
      expect(isControlValue(layer.cutoff)).toBe(true);
      expect(layer.pad.every(isControlValue)).toBe(true);
    }
  });

  test("patches signals into a reachable range", () => {
    const cables = layers.flatMap((layer) => [
      layer.modulation?.padX,
      layer.modulation?.padY,
    ]);
    for (const cable of cables) {
      if (!cable) continue;

      expect(isControlValue(cable.minimum)).toBe(true);
      expect(isControlValue(cable.maximum)).toBe(true);
      expect(isControlValue(cable.smoothing)).toBe(true);
      // A cable may run either way; a range that does not move is the bug.
      expect(cable.minimum).not.toBe(cable.maximum);
    }
  });

  test("places only what the moving world can carry", () => {
    for (const layer of layers) {
      const placement = layer.placement;
      if (!placement) continue;

      expect(["birds", "insects"]).toContain(placement.group);
      expect(isControlValue(placement.nearRadius)).toBe(true);
      expect(isControlValue(placement.falloff)).toBe(true);
    }
  });
});
