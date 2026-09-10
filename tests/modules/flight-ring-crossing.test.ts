import { expect, test } from "bun:test";
import { crossesFlightRing } from "../../src/modules/start/flight-ring-crossing";

const CENTER = { x: 0, y: 0, z: 0 };
const NORMAL = { x: 0, y: 0, z: 1 };

test("a fast segment crosses the open ring in either direction", () => {
  const before = { x: 0.5, y: 0.5, z: 100 };
  const after = { x: 0.5, y: 0.5, z: -100 };
  expect(crossesFlightRing(before, after, CENTER, NORMAL, 1)).toBe(true);
  expect(crossesFlightRing(after, before, CENTER, NORMAL, 1)).toBe(true);
  expect(crossesFlightRing(before, CENTER, CENTER, NORMAL, 1)).toBe(true);
});

test("misses, the solid rim, parallel flight and leaving the plane are not passages", () => {
  for (const x of [1, 1.1]) {
    expect(
      crossesFlightRing(
        { x, y: 0, z: 2 },
        { x, y: 0, z: -2 },
        CENTER,
        NORMAL,
        1,
      ),
    ).toBe(false);
  }
  expect(
    crossesFlightRing(
      { x: -2, y: 0, z: 1 },
      { x: 2, y: 0, z: 1 },
      CENTER,
      NORMAL,
      1,
    ),
  ).toBe(false);
  expect(
    crossesFlightRing(CENTER, { x: 0, y: 0, z: -2 }, CENTER, NORMAL, 1),
  ).toBe(false);
  expect(crossesFlightRing(CENTER, CENTER, CENTER, NORMAL, 1)).toBe(false);
});

test("passage uses the authored world-space plane rather than an assumed forward axis", () => {
  const center = { x: 10, y: 3, z: -2 };
  const normal = { x: 1, y: 0, z: 0 };
  expect(
    crossesFlightRing(
      { x: 8, y: 3.5, z: -2 },
      { x: 12, y: 3.5, z: -2 },
      center,
      normal,
      1,
    ),
  ).toBe(true);
  expect(
    crossesFlightRing(
      { x: 8, y: 5, z: -2 },
      { x: 12, y: 5, z: -2 },
      center,
      normal,
      1,
    ),
  ).toBe(false);
});
