import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { START_SETTINGS } from "../start-exercises";
import { createParticleLight } from "./particle-light";
import { createRingPassage } from "./ring-passage";

// 1. Real opening crossings: forward only, swept intersection, once per ring
const ring = {
  elementIndex: 2,
  center: new Vector3(),
  direction: new Vector3(0, 0, -1),
  radiusMeters: 2,
};
test("forward crossing triggers once and ignores stationary or reverse motion", () => {
  const passage = createRingPassage(3);
  passage.reset([ring], new Vector3(0, 0, 1));
  expect(passage.update(new Vector3(0, 0, 1))).toEqual([]);
  expect(passage.update(new Vector3(0, 0, -1))).toEqual([2]);
  expect(passage.update(new Vector3(0, 0, 1))).toEqual([]);
  expect(passage.update(new Vector3(0, 0, -1))).toEqual([]);
  passage.reset([ring], new Vector3(0, 0, -1));
  expect(passage.update(new Vector3(0, 0, 1))).toEqual([]);
});
test("misses and teleports cannot trigger success; resetting permits a new passage", () => {
  const passage = createRingPassage(3);
  passage.reset([ring], new Vector3(3, 0, 1));
  expect(passage.update(new Vector3(3, 0, -1))).toEqual([]);
  passage.reset([ring], new Vector3(0, 0, 4));
  expect(passage.update(new Vector3(0, 0, -4))).toEqual([]);
  passage.reset([ring], new Vector3(0, 0, 1));
  expect(passage.update(new Vector3(0, 0, 0))).toEqual([2]);
  expect(passage.update(new Vector3(0, 0, -1))).toEqual([]);
});
test("rotated openings use the swept plane intersection, not endpoint distance", () => {
  const passage = createRingPassage(3);
  const rotated = {
    ...ring,
    center: new Vector3(10, 5, 0),
    direction: new Vector3(1, 0, 0),
  };
  passage.reset([rotated], new Vector3(9, 5, 1.9));
  expect(passage.update(new Vector3(11, 5, 2.1))).toEqual([2]);
  passage.reset([], new Vector3());
  expect(passage.update(new Vector3(1, 0, 0))).toEqual([]);
});

// 2. A common forward light coordinate, followed by independent delayed dissolution
test("success sweeps forward, preserves other elements and dissolves without replay", () => {
  const settings = START_SETTINGS.elementLight;
  const light = createParticleLight(settings);
  light.reset(2);
  const before = light.update(0.1)[0]?.head ?? 0;
  expect(light.update(0.1)[0]?.head).toBeGreaterThan(before);
  light.pass(0);
  const peak = light.update(settings.flashSeconds / 2);
  expect(peak[0]?.head).toBeCloseTo(0.5);
  expect(peak[0]?.strength).toBe(1);
  expect(peak[0]?.presence).toBe(1);
  expect(peak[1]?.strength).toBe(settings.guideStrength);
  light.update(settings.flashSeconds / 2 + settings.dissolveSeconds / 2);
  expect(peak[0]?.presence).toBeCloseTo(0.5);
  expect(peak[1]?.presence).toBe(1);
  light.pass(0);
  light.update(settings.dissolveSeconds);
  expect(peak[0]?.presence).toBe(0);
  light.reset(2);
  expect(light.update(0)[0]?.presence).toBe(1);
});

test("light storage is bounded and reset removes old success state", () => {
  const light = createParticleLight(START_SETTINGS.elementLight);
  expect(() => light.reset(START_SETTINGS.elementLight.capacity + 1)).toThrow(
    RangeError,
  );
  light.reset(1);
  light.pass(0);
  light.update(1);
  light.reset(0);
  light.pass(0);
  expect(light.update(1)).toEqual([]);
  light.reset(1);
  expect(light.update(0)[0]?.strength).toBe(
    START_SETTINGS.elementLight.guideStrength,
  );
});
