import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createParticleLight } from "../../../../src/modules/start/particle-elements/particle-light";
import { createRingPassage } from "../../../../src/modules/start/particle-elements/ring-passage";
import { START_SETTINGS } from "../../../../src/modules/start/start-exercises";

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

// 2. Passage changes light only; completed sections own ring retirement
test("success sweeps once without changing section lifetime", () => {
  const settings = START_SETTINGS.elementLight;
  const light = createParticleLight(settings);
  light.reset(2);
  const before = light.update(0.1)[0]?.head ?? 0;
  expect(light.update(0.1)[0]?.head).toBeGreaterThan(before);
  light.pass(0);
  const peak = light.update(settings.flashSeconds / 2);
  expect(peak[0]?.head).toBeCloseTo(0.5);
  expect(peak[0]?.strength).toBe(1);
  expect(peak[1]?.strength).toBe(settings.guideStrength);
  light.update(30);
  const finishedHead = peak[0]?.head;
  light.pass(0);
  expect(light.update(0)[0]?.head).toBe(finishedHead);
  light.reset(2);
  expect(light.update(0)[0]?.strength).toBe(settings.guideStrength);
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

test("audio pulses share idle sweep starts and one-shot passage feedback", () => {
  const settings = START_SETTINGS.elementLight;
  const light = createParticleLight(settings);
  light.reset(2);
  expect(light.readPulses()).toEqual([0, 0]);
  light.update(0);
  expect(light.readPulses()).toEqual([1, 0]);
  light.update(settings.staggerSeconds);
  expect(light.readPulses()).toEqual([1, 1]);
  light.update(settings.periodSeconds - settings.staggerSeconds);
  expect(light.readPulses()).toEqual([2, 1]);
  light.pass(0);
  light.pass(0);
  expect(light.readPulses()).toEqual([3, 1]);
  light.update(settings.periodSeconds * 2);
  expect(light.readPulses()[0]).toBe(3);
  light.reset(0);
  expect(light.readPulses()).toEqual([]);
});
