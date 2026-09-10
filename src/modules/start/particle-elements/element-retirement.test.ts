import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createElementRetirement } from "./element-retirement";

const settings = { capacity: 3, dissolveSeconds: 1, clearanceMeters: 1 };
const flight = { position: new Vector3(), direction: new Vector3(0, 0, -1) };
const bounds = [
  { center: new Vector3(0, 0, -10), radius: 2 },
  { center: new Vector3(0, 0, 10), radius: 2 },
];

test("retirement preserves front rings and fades only complete bounds behind flight", () => {
  const retirement = createElementRetirement(settings);
  retirement.reset(bounds);
  retirement.update(2, flight);
  expect([...retirement.presence].slice(0, 2)).toEqual([1, 1]);
  retirement.request();
  retirement.update(0.5, flight);
  expect([...retirement.presence].slice(0, 2)).toEqual([1, 0.5]);
  retirement.update(2, flight);
  expect([...retirement.presence].slice(0, 2)).toEqual([1, 0]);
  expect(retirement.isFinished()).toBe(false);
  retirement.update(2, { ...flight, position: new Vector3(0, 0, -20) });
  expect(retirement.isFinished()).toBe(true);
});

test("turning toward a fading ring pauses retirement; overlap and zero direction preserve it", () => {
  const retirement = createElementRetirement(settings);
  retirement.reset(bounds.slice(1));
  retirement.request();
  retirement.update(0.25, flight);
  retirement.update(2, { ...flight, direction: new Vector3(0, 0, 1) });
  expect(retirement.presence[0]).toBe(0.75);
  retirement.update(2, { ...flight, position: new Vector3(0, 0, 9) });
  retirement.update(2, { ...flight, direction: new Vector3() });
  expect(retirement.presence[0]).toBe(0.75);
  retirement.reset(bounds);
  expect(retirement.presence[0]).toBe(1);
  expect(retirement.isFinished()).toBe(false);
});
