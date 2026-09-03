/**
 * Purpose: Lock the composed organ against the show it plays under.
 * Context: The composition is authored data ported from the instrument's own
 *   editor, so what it must satisfy is a contract, not an implementation.
 * Responsibility: Cover the gate vocabulary, the control ranges, and the
 *   promise that every sense of the ladder is heard.
 * Boundary: How a voice sounds is not decidable outside a browser.
 */

import { describe, expect, test } from "bun:test";
import {
  SHOW_LEVEL_STATES,
  type ShowSense,
} from "../../src/dramaturgy/show-levels";
import { DRONE_ORGAN_COMPOSITION } from "../../src/sound/drone-organ/drone-organ-settings";

const LADDER = SHOW_LEVEL_STATES.connections.senses;
const { layers } = DRONE_ORGAN_COMPOSITION;

function isControlValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

describe("the composed organ", () => {
  test("gates every layer on a sense of the ladder, or on nothing", () => {
    for (const layer of layers) {
      if (layer.gate === "always") continue;
      expect(LADDER).toContain(layer.gate);
    }
  });

  test("keeps one voice the show never puts away", () => {
    const ungated = layers.filter((layer) => layer.gate === "always");
    expect(ungated).toHaveLength(1);
  });

  test("gives every sense of the ladder a voice", () => {
    const gated = new Set(layers.map((layer) => layer.gate));
    for (const sense of LADDER as readonly ShowSense[]) {
      expect(gated.has(sense)).toBe(true);
    }
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
