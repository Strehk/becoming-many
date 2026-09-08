import { expect, mock, test } from "bun:test";
import { Group, Vector3 } from "three";
import {
  createStartModule,
  type StartParameters,
} from "../../src/modules/start/start.module";
import type { StartParticleFrame } from "../../src/modules/start/start-particles.effect";
import { ModuleRuntime } from "../../src/world/module-runtime";

const PARAMETERS: StartParameters = {
  arrivalSeconds: 0.2,
  formationSeconds: 0.3,
  dissolutionSeconds: 0.4,
  guideDistanceMeters: 3,
  goals: [
    { direction: "right", offsetMeters: [2, 0, -5], radiusMeters: 1 },
    { direction: "left", offsetMeters: [-2, 0, -10], radiusMeters: 1 },
    { direction: "up", offsetMeters: [-2, 3, -15], radiusMeters: 1 },
    { direction: "down", offsetMeters: [0, -1, -20], radiusMeters: 1 },
  ],
};

function createPractice() {
  const worldPosition = new Vector3(0, 4, 0);
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    viewPitchDegrees: 0,
    parameters: PARAMETERS,
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);

  function formGoal(): Vector3 {
    runtime.update(PARAMETERS.arrivalSeconds);
    runtime.update(PARAMETERS.formationSeconds);
    expect(start.readObservation().phase).toBe("flying");
    return start.readObservation().goalPosition.clone();
  }

  function moveTo(position: Vector3, deltaSeconds = 0.1): void {
    worldPosition.copy(position);
    // Run publishes playback every frame; an unchanged command cannot erase travel.
    start.setPlaying(true);
    runtime.update(deltaSeconds);
  }

  return { start, runtime, worldPosition, formGoal, moveTo };
}

test("all four spatial goals require passage and remain open without a time limit", () => {
  const { start, runtime, formGoal, moveTo } = createPractice();
  for (const [index, direction] of (
    ["right", "left", "up", "down"] as const
  ).entries()) {
    const center = formGoal();
    expect(start.readObservation().direction).toBe(direction);
    runtime.update(1_000);
    expect(start.readObservation().phase).toBe("flying");
    expect(start.readObservation().crossingCount).toBe(index);

    // Pass the plane outside the aperture, then return without entering the disk.
    moveTo(center.clone().add(new Vector3(3, 0, 2)));
    moveTo(center.clone().add(new Vector3(3, 0, -2)));
    expect(start.readObservation().phase).toBe("flying");
    expect(start.readObservation().goalPosition).toEqual(center);
    moveTo(center.clone().add(new Vector3(3, 0, 2)));
    moveTo(center.clone().add(new Vector3(0, 0, 2)));
    moveTo(center.clone().add(new Vector3(0, 0, -20)), 0.5);
    expect(start.readObservation().phase).toBe("crossed");
    expect(start.readObservation().crossingCount).toBe(index + 1);

    // Reversing inside the completion phase cannot count the same goal twice.
    moveTo(center.clone().add(new Vector3(0, 0, 2)), 0);
    moveTo(center.clone().add(new Vector3(0, 0, -2)), 0);
    expect(start.readObservation().crossingCount).toBe(index + 1);
    runtime.update(PARAMETERS.dissolutionSeconds);
  }
  expect(start.readObservation().phase).toBe("complete");
  runtime.update(1_000);
  expect(start.readObservation().crossingCount).toBe(4);
  expect(start.readObservation().phase).toBe("complete");
  runtime.unload(start.module);
});

test("a wake begins at the actual intersection and follows the travelled direction", () => {
  const { start, runtime, formGoal, moveTo } = createPractice();
  const center = formGoal();
  moveTo(center.clone().add(new Vector3(-1.6, 0.3, 5)));
  moveTo(center.clone().add(new Vector3(2.4, 0.3, -5)));
  const wake = start.readObservation().wake;
  expect(wake).toBeDefined();
  expect(wake?.position.x).toBeCloseTo(center.x + 0.4);
  expect(wake?.position.y).toBeCloseTo(center.y + 0.3);
  expect(wake?.position.z).toBeCloseTo(center.z);
  const direction = new Vector3(4, 0, -10).normalize();
  expect(wake?.direction.x).toBeCloseTo(direction.x);
  expect(wake?.direction.y).toBeCloseTo(direction.y);
  expect(wake?.direction.z).toBeCloseTo(direction.z);
  expect(wake?.ageSeconds).toBe(0);
  runtime.update(0.1);
  expect(start.readObservation().wake?.ageSeconds).toBeCloseTo(0.1);
  runtime.unload(start.module);
});

test("pause and inactive lifetimes never count movement that happened invisibly", () => {
  const { start, runtime, worldPosition, formGoal, moveTo } = createPractice();
  const center = formGoal();
  moveTo(center.clone().add(new Vector3(0, 0, 2)));
  start.setPlaying(false);
  worldPosition.copy(center).add(new Vector3(0, 0, -2));
  runtime.update(100);
  expect(start.readObservation().phase).toBe("flying");
  start.setPlaying(true);
  runtime.update(0.1);
  expect(start.readObservation().crossingCount).toBe(0);

  // Also cover a suspended tab without any paused World frames.
  start.setPlaying(false);
  worldPosition.copy(center).add(new Vector3(0, 0, 2));
  start.setPlaying(true);
  runtime.update(0.1);
  expect(start.readObservation().crossingCount).toBe(0);

  runtime.deactivate(start.module);
  worldPosition.copy(center).add(new Vector3(0, 0, -2));
  runtime.update(100);
  runtime.activate(start.module);
  runtime.update(0.1);
  expect(start.readObservation().crossingCount).toBe(0);
  moveTo(center.clone().add(new Vector3(0, 0, 2)));
  expect(start.readObservation().crossingCount).toBe(1);
  runtime.unload(start.module);
});

test("pause freezes formation and reset or reload starts fresh at the new arrival pose", () => {
  const { start, runtime, worldPosition, formGoal, moveTo } = createPractice();
  runtime.update(PARAMETERS.arrivalSeconds);
  runtime.update(0.1);
  const progress = start.readObservation().formationProgress;
  start.setPlaying(false);
  runtime.update(100);
  expect(start.readObservation().formationProgress).toBe(progress);
  start.setPlaying(true);
  start.reset();
  worldPosition.set(20, 8, 30);
  runtime.update(0);
  const center = formGoal();
  expect(center).toEqual(new Vector3(22, 8, 25));
  moveTo(center.clone().add(new Vector3(0, 0, -2)));
  expect(start.readObservation().crossingCount).toBe(1);

  runtime.unload(start.module);
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().wake).toBeUndefined();
  runtime.unload(start.module);
});

test("the selected presentation ends after a partial load and receives no inactive frames", () => {
  const worldPosition = new Vector3();
  const failure = new Error("Particle preparation failed");
  const load = mock(() => {});
  const update = mock((_frame: StartParticleFrame) => {});
  const setVisible = mock((_visible: boolean) => {});
  const unload = mock(() => {});
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    viewPitchDegrees: 0,
    parameters: PARAMETERS,
    particles: { load, update, setVisible, unload },
  });
  const runtime = new ModuleRuntime();
  load.mockImplementationOnce(() => {
    throw failure;
  });
  expect(() => runtime.load(start.module)).toThrow(failure);
  runtime.unload(start.module);
  runtime.unload(start.module);
  expect(unload).toHaveBeenCalledTimes(1);
  runtime.update(1);
  expect(update).not.toHaveBeenCalled();

  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0.1);
  expect(setVisible).toHaveBeenLastCalledWith(true);
  expect(update).toHaveBeenCalledTimes(1);
  runtime.deactivate(start.module);
  expect(setVisible).toHaveBeenLastCalledWith(false);
  runtime.update(100);
  expect(update).toHaveBeenCalledTimes(1);
  runtime.unload(start.module);
  expect(unload).toHaveBeenCalledTimes(2);
});

test("Show can finish speech after a crossing without completing any unflown goal", () => {
  const { start, runtime, formGoal, moveTo } = createPractice();
  const center = formGoal();
  start.setGoalAdvanceAllowed(false);
  moveTo(center.clone().add(new Vector3(0, 0, -2)));
  runtime.update(30);
  expect(start.readObservation().phase).toBe("crossed");
  expect(start.readObservation().crossingCount).toBe(1);
  expect(start.readObservation().formationProgress).toBe(0);
  start.setGoalAdvanceAllowed(true);
  runtime.update(0.1);
  expect(start.readObservation().direction).toBe("left");
  expect(start.readObservation().crossingCount).toBe(1);
  formGoal();
  runtime.update(100);
  expect(start.readObservation().phase).toBe("flying");
  runtime.unload(start.module);
});

test("a missed goal behind the heading shows a horizontal turn-around cue", () => {
  const worldPosition = new Vector3();
  let arrowAngle = 0;
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    viewPitchDegrees: 30,
    parameters: PARAMETERS,
    particles: {
      load() {},
      unload() {},
      setVisible() {},
      update(frame) {
        arrowAngle = frame.arrowAngleRadians;
      },
    },
  });
  start.module.load();
  start.module.activate();
  start.module.update?.(0);
  worldPosition.set(10, 0, -10);
  start.module.update?.(0.1);
  expect(arrowAngle).toBe(Math.PI);
  worldPosition.x = -10;
  start.module.update?.(0.1);
  expect(arrowAngle).toBe(0);
  expect(start.readObservation().crossingCount).toBe(0);
  start.module.unload();
});
