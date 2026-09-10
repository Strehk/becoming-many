import { expect, test } from "bun:test";
import { Vector3 } from "three";
import { createFlightDeviation } from "../../../../src/modules/start/flight-path/flight-deviation";
import { START_EXERCISES } from "../../../../src/modules/start/start-exercises";

const route = {
  lengthMeters: 80,
  exerciseStartMeters: 30,
  exerciseEndMeters: 60,
  sample: (distance: number, target: Vector3) => {
    target.set(0, 0, -distance);
  },
  sampleDirection: (_distance: number, target: Vector3) => {
    target.set(0, 0, -1);
  },
};
function fixture() {
  const position = new Vector3();
  const view = {
    worldPosition: position,
    worldDirection: new Vector3(1, 0, 0),
    worldFlightDirection: new Vector3(1, 0, 0),
    viewHalfAngleRadians: 0.7,
    viewDistanceMeters: 128,
  };
  const observer = createFlightDeviation(
    { route, pose: { position: new Vector3(), yawRadians: 0 } },
    position,
    START_EXERCISES[0].deviation,
  );
  return { position, view, observer };
}

test("a wide corridor and visible rings prevent recovery despite lateral flight", () => {
  const { position, view, observer } = fixture();
  for (let x = 0; x <= 11; x += 0.5) {
    position.x = x;
    expect(observer.update(position, view)).toBe(false);
  }
  for (let x = 11.5; x <= 40; x += 0.5) {
    position.x = x;
    view.worldDirection.set(-x, 0, -45).normalize();
    expect(observer.update(position, view)).toBe(false);
  }
});

test("only sustained divergent travel with the ring area out of view resets", () => {
  const { position, view, observer } = fixture();
  let recovery = false;
  for (let x = 0; x <= 25; x += 0.5) {
    position.x = x;
    recovery = observer.update(position, view);
    if (x < 20) expect(recovery).toBe(false);
  }
  expect(recovery).toBe(true);
  expect(observer.update(position, view)).toBe(false);
});

test("returning toward the corridor does not reset even when looking away", () => {
  const { position, view, observer } = fixture();
  position.x = 35;
  expect(observer.update(position, view)).toBe(false);
  view.worldFlightDirection.set(-1, 0, 0);
  for (let x = 34.5; x >= 0; x -= 0.5) {
    position.x = x;
    expect(observer.update(position, view)).toBe(false);
  }
});
