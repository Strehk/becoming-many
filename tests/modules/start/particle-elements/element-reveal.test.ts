import { expect, test } from "bun:test";
import { createElementReveal } from "../../../../src/modules/start/particle-elements/particle-animation";

const settings = { capacity: 4, fadeSeconds: 2, speedMetersPerSecond: 10 };

test("emergence follows route distance, including unsorted shapes and uneven spacing", () => {
  const reveal = createElementReveal(settings);
  reveal.reset([30, 10, 15]);
  reveal.update(0.25, Infinity);
  expect(reveal.presence[1]).toBeGreaterThan(0);
  expect(reveal.presence[2]).toBe(0);
  expect(reveal.presence[0]).toBe(0);
  reveal.update(0.5, Infinity);
  expect(reveal.presence[2]).toBeGreaterThan(0);
  expect(reveal.presence[0]).toBe(0);
  expect(reveal.presence[1]).toBeGreaterThan(reveal.presence[2] ?? 0);
  reveal.update(1.5, Infinity);
  expect(reveal.presence[0]).toBeGreaterThan(0);
  expect(reveal.presence[1]).toBe(1);
});

test("a late path front starts a gentle fade instead of revealing an aged ring at once", () => {
  const reveal = createElementReveal(settings);
  reveal.reset([10, 20]);
  reveal.update(20, 9);
  expect(Array.from(reveal.presence)).toEqual([0, 0, 0, 0]);
  reveal.update(0.1, 10);
  expect(reveal.presence[0]).toBeGreaterThan(0);
  expect(reveal.presence[0]).toBeLessThan(0.01);
  expect(reveal.presence[1]).toBe(0);
});

test("abandonment freezes pending reveal and pool reuse clears all old state", () => {
  const reveal = createElementReveal(settings);
  reveal.reset([10, 30]);
  reveal.update(0.5, Infinity);
  const before = Array.from(reveal.presence);
  reveal.cancel();
  reveal.update(10, Infinity);
  expect(Array.from(reveal.presence)).toEqual(before);
  reveal.reset([50]);
  expect(Array.from(reveal.presence)).toEqual([0, 0, 0, 0]);
  reveal.update(0.5, 50);
  expect(reveal.presence[0]).toBeGreaterThan(0);
  expect(reveal.presence[1]).toBe(0);
  reveal.reset([]);
  reveal.update(10, Infinity);
  expect(Array.from(reveal.presence)).toEqual([0, 0, 0, 0]);
});

test("invalid reveal budgets fail explicitly", () => {
  expect(() => createElementReveal({ ...settings, capacity: 0 })).toThrow();
  expect(() => createElementReveal({ ...settings, fadeSeconds: 0 })).toThrow();
  expect(() =>
    createElementReveal({ ...settings, speedMetersPerSecond: Infinity }),
  ).toThrow();
  const reveal = createElementReveal(settings);
  expect(() => reveal.reset([1, 2, 3, 4, 5])).toThrow("capacity");
});
