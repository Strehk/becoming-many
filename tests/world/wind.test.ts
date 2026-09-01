/**
 * Purpose: Verify the shared wind turns like weather and stays exactly bounded.
 * Context: Scent leans on the wind every frame, so its sample must be stable and seamless.
 * Responsibility: Cover purity, the direction turn, the gust range, and the loop wrap.
 * Boundary: How each module reacts to the wind is covered by that module's tests.
 */

import { expect, test } from "bun:test";
import {
  getWorldWind,
  WORLD_WIND,
  wrapWindSeconds,
} from "../../src/world/wind";

test("the wind is a pure function of time", () => {
  for (const seconds of [0, 7.5, 61, 133.25]) {
    expect(getWorldWind(seconds)).toEqual(getWorldWind(seconds));
  }
});

test("the direction turns and stays inside the authored swing", () => {
  const [meanX, meanZ] = WORLD_WIND.directionXZ;
  const meanRadians = Math.atan2(meanZ, meanX);
  const maximumSwingRadians =
    (WORLD_WIND.swingDegrees * Math.PI) / 180 + Number.EPSILON;

  const bearings: number[] = [];
  for (let seconds = 0; seconds < WORLD_WIND.loopSeconds; seconds += 1) {
    const wind = getWorldWind(seconds);

    // The sample is a unit direction, so a consumer may scale it directly.
    expect(Math.hypot(wind.directionX, wind.directionZ)).toBeCloseTo(1, 6);

    const offset = Math.atan2(wind.directionZ, wind.directionX) - meanRadians;
    const wrapped = Math.atan2(Math.sin(offset), Math.cos(offset));
    // The two swing terms can add, so the reachable swing is wider than one.
    expect(Math.abs(wrapped)).toBeLessThanOrEqual(maximumSwingRadians * 1.4);
    bearings.push(wrapped);
  }

  // It must actually turn, and turn both ways around its mean.
  expect(Math.max(...bearings)).toBeGreaterThan(0.3);
  expect(Math.min(...bearings)).toBeLessThan(-0.3);
});

test("the strength breathes without ever blowing backwards", () => {
  const strengths: number[] = [];
  for (let seconds = 0; seconds < WORLD_WIND.loopSeconds; seconds += 1) {
    strengths.push(getWorldWind(seconds).strength);
  }

  const lowest = Math.min(...strengths);
  const highest = Math.max(...strengths);
  expect(lowest).toBeGreaterThan(0);
  expect(highest).toBeGreaterThan(WORLD_WIND.strength);
  expect(highest / lowest).toBeGreaterThan(1.5);
});

test("the wind clock wraps seamlessly at the authored loop", () => {
  expect(wrapWindSeconds(WORLD_WIND.loopSeconds + 12)).toBeCloseTo(12, 9);

  const atStart = getWorldWind(3);
  const afterOneLoop = getWorldWind(WORLD_WIND.loopSeconds + 3);
  expect(afterOneLoop.directionX).toBeCloseTo(atStart.directionX, 9);
  expect(afterOneLoop.directionZ).toBeCloseTo(atStart.directionZ, 9);
  expect(afterOneLoop.strength).toBeCloseTo(atStart.strength, 9);
});
