import { expect, test } from "bun:test";
import { Color } from "three";
import { START_EXERCISES } from "../start-exercises";
import type { FlightRoute } from "./particle-contract";
import { createPathParticleGeometry } from "./path-particles";

const PATH_PARTICLE_SETTINGS = START_EXERCISES[0].particles;

const STRAIGHT_ROUTE: FlightRoute = {
  lengthMeters: 4,
  sample: (distance, target) => {
    target.set(0, 0, -distance);
  },
};

// Public range behavior applies independently of the left-turn exercise.
test("fixed density, size, and color endpoints disable variation", () => {
  const geometry = createPathParticleGeometry(STRAIGHT_ROUTE, {
    densityPerMeter: { from: 10, to: 10 },
    sizeMeters: { from: 0.04, to: 0.04 },
    color: { from: 0x39999d, to: 0x39999d },
    spreadMeters: 0,
    seed: 17,
  });
  const color = new Color(0x39999d);
  expect(geometry.getAttribute("position").count).toBe(40);
  for (let index = 0; index < 40; index++) {
    expect(geometry.getAttribute("pathParticleSize").getX(index)).toBeCloseTo(
      0.04,
    );
    expect(geometry.getAttribute("color").getX(index)).toBeCloseTo(color.r);
    expect(geometry.getAttribute("position").getX(index)).toBe(0);
  }
  geometry.dispose();
});

test("density varies per meter within its public range", () => {
  const geometry = createPathParticleGeometry(STRAIGHT_ROUTE, {
    ...PATH_PARTICLE_SETTINGS,
    spreadMeters: 0,
  });
  const sections = [0, 0, 0, 0];
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const section = Math.floor(-positions.getZ(index));
    sections[section] = (sections[section] ?? 0) + 1;
  }
  for (const count of sections) {
    expect(count).toBeGreaterThanOrEqual(40);
    expect(count).toBeLessThanOrEqual(68);
  }
  expect(new Set(sections).size).toBeGreaterThan(1);
  geometry.dispose();
});

test("each particle gets a size and linear RGB color within the endpoints", () => {
  const geometry = createPathParticleGeometry(
    STRAIGHT_ROUTE,
    PATH_PARTICLE_SETTINGS,
  );
  const sizes = geometry.getAttribute("pathParticleSize");
  const colors = geometry.getAttribute("color");
  const from = new Color(PATH_PARTICLE_SETTINGS.color.from).toArray();
  const to = new Color(PATH_PARTICLE_SETTINGS.color.to).toArray();
  for (const size of sizes.array) {
    expect(size).toBeGreaterThanOrEqual(0.025 - 1e-8);
    expect(size).toBeLessThanOrEqual(0.055 + 1e-8);
  }
  for (let index = 0; index < colors.array.length; index++) {
    expect(colors.array[index]).toBeGreaterThanOrEqual(
      (from[index % 3] ?? Number.NaN) - 1e-8,
    );
    expect(colors.array[index]).toBeLessThanOrEqual(
      (to[index % 3] ?? Number.NaN) + 1e-8,
    );
  }
  expect(new Set(sizes.array).size).toBeGreaterThan(1);
  geometry.dispose();
});

test("the same seed reproduces buffers; zero density produces an empty trail", () => {
  const first = createPathParticleGeometry(
    STRAIGHT_ROUTE,
    PATH_PARTICLE_SETTINGS,
  );
  const second = createPathParticleGeometry(
    STRAIGHT_ROUTE,
    PATH_PARTICLE_SETTINGS,
  );
  for (const name of ["position", "color", "pathParticleSize"]) {
    expect(first.getAttribute(name).array).toEqual(
      second.getAttribute(name).array,
    );
  }
  const empty = createPathParticleGeometry(STRAIGHT_ROUTE, {
    ...PATH_PARTICLE_SETTINGS,
    densityPerMeter: { from: 0, to: 0 },
  });
  expect(empty.getAttribute("position").count).toBe(0);
  first.dispose();
  second.dispose();
  empty.dispose();
});

for (const density of [
  { from: 10, to: 2 },
  { from: -1, to: 2 },
  { from: 0, to: Infinity },
]) {
  test(`reject invalid density range ${density.from} to ${density.to}`, () => {
    expect(() =>
      createPathParticleGeometry(STRAIGHT_ROUTE, {
        ...PATH_PARTICLE_SETTINGS,
        densityPerMeter: density,
      }),
    ).toThrow(RangeError);
  });
}

test("reject excessive allocation before sampling the route", () => {
  expect(() =>
    createPathParticleGeometry(
      {
        lengthMeters: 100_000,
        sample: () => {
          throw new Error("Route must not be sampled");
        },
      },
      PATH_PARTICLE_SETTINGS,
    ),
  ).toThrow(RangeError);
});
