import { expect, mock, test } from "bun:test";
import { Group, Vector3 } from "three";
import {
  createStartModule,
  type StartParameters,
} from "../../src/modules/start/start.module";
import type {
  StartParticleEffect,
  StartParticleFrame,
} from "../../src/modules/start/start-particles.effect";
import { ModuleRuntime } from "../../src/world/module-runtime";

const PARAMETERS: StartParameters = {
  maximumPracticeSeconds: 60,
  arrivalSeconds: 0.2,
  formationSeconds: 0.3,
  dissolutionSeconds: 0.4,
  directions: ["right", "left", "up", "down"],
  course: {
    firstDistanceMeters: [5, 5],
    spacingMeters: [5, 5],
    horizontalOffsetMeters: [2, 2],
    verticalOffsetMeters: [3, 3],
    radiusMeters: [1, 1],
  },
};

function createPractice(
  parameters: StartParameters = PARAMETERS,
  random: () => number = () => 0.5,
  particles?: StartParticleEffect,
) {
  const worldPosition = new Vector3(0, 4, 0);
  const viewerRig = new Group();
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig,
    parameters,
    random,
    particles,
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);

  function formGoal(): Vector3 {
    runtime.update(parameters.arrivalSeconds);
    runtime.update(parameters.formationSeconds);
    expect(start.readObservation().phase).toBe("flying");
    return start.readObservation().goalPosition.clone();
  }

  function moveTo(position: Vector3, deltaSeconds = 0.1): void {
    worldPosition.copy(position);
    // Run publishes playback every frame; an unchanged command cannot erase travel.
    start.setPlaying(true);
    runtime.update(deltaSeconds);
  }

  return { start, runtime, worldPosition, viewerRig, formGoal, moveTo };
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

    moveTo(center.clone().add(new Vector3(0, 0, 2)));
    moveTo(center.clone().add(new Vector3(0, 0, -2)), 0.5);
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
  const objects = {
    ringLeft: new Vector3(-1, 0, 0),
    ringRight: new Vector3(1, 0, 0),
    arrow: new Vector3(-2, 0, 0),
  };
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    parameters: PARAMETERS,
    particles: {
      load,
      update,
      setVisible,
      unload,
      readObjectAnchors: () => objects,
    },
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
  expect(start.readObservation().objects).toBe(objects);
  runtime.deactivate(start.module);
  expect(start.readObservation().objects).toBeUndefined();
  expect(setVisible).toHaveBeenLastCalledWith(false);
  runtime.update(100);
  expect(update).toHaveBeenCalledTimes(1);
  runtime.unload(start.module);
  expect(unload).toHaveBeenCalledTimes(2);
  expect(start.readObservation().objects).toBeUndefined();
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

test("cloud and formed targets keep their world anchor through player translation and rotation", () => {
  const worldPosition = new Vector3(5, 4, 3);
  const viewerRig = new Group();
  viewerRig.rotation.y = Math.PI / 3;
  let rendered: StartParticleFrame | undefined;
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig,
    parameters: PARAMETERS,
    particles: {
      load() {},
      unload() {},
      setVisible() {},
      readObjectAnchors: () => undefined,
      update(frame) {
        rendered = {
          ...frame,
          goalPosition: frame.goalPosition.clone(),
          goalNormal: frame.goalNormal.clone(),
        };
      },
    },
  });
  start.module.load();
  start.module.activate();
  start.module.update?.(0);
  start.module.update?.(PARAMETERS.arrivalSeconds);
  start.module.update?.(PARAMETERS.formationSeconds);
  const anchor = rendered?.goalPosition.clone();
  const normal = rendered?.goalNormal.clone();
  const angle = rendered?.arrowAngleRadians;
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    start.setPlaying(false);
    worldPosition.set(100 + heading, 20, -100);
    viewerRig.rotation.set(0.2, heading, -0.3);
    start.module.update?.(100);
    expect(rendered?.goalPosition).toEqual(anchor);
    expect(rendered?.goalNormal).toEqual(normal);
    expect(rendered?.arrowAngleRadians).toBe(angle);
    expect(start.readObservation().phase).toBe("flying");
    start.setPlaying(true);
  }
  expect(start.readObservation().phase).toBe("flying");
  expect(start.readObservation().crossingCount).toBe(0);
  start.module.unload();
});

test("generated courses respect direction and distance bounds at both sampling extremes", () => {
  const parameters: StartParameters = {
    ...PARAMETERS,
    course: {
      firstDistanceMeters: [5, 7],
      spacingMeters: [8, 12],
      horizontalOffsetMeters: [2, 4],
      verticalOffsetMeters: [3, 5],
      radiusMeters: [1, 1],
    },
  };
  for (const fraction of [0, 0.5, 1]) {
    const random = mock(() => fraction);
    const { start, runtime, formGoal, moveTo } = createPractice(
      parameters,
      random,
    );
    const previous = new Vector3(0, 4, 0);
    for (const [index, direction] of parameters.directions.entries()) {
      const center = formGoal();
      const step = center.clone().sub(previous);
      expect(step.z).toBeCloseTo(
        -(index === 0 ? 5 + 2 * fraction : 8 + 4 * fraction),
      );
      if (direction === "right" || direction === "left") {
        expect(step.x).toBeCloseTo(
          (2 + 2 * fraction) * (direction === "right" ? 1 : -1),
        );
        expect(step.y).toBe(0);
      } else {
        expect(step.x).toBe(0);
        expect(step.y).toBeCloseTo(
          (3 + 2 * fraction) * (direction === "up" ? 1 : -1),
        );
      }
      const sampled = random.mock.calls.length;
      runtime.update(100);
      start.setPlaying(false);
      runtime.update(100);
      expect(random.mock.calls.length).toBe(sampled);
      expect(start.readObservation().goalTarget).toEqual(center);
      moveTo(center.clone().add(new Vector3(0, 0, 2)));
      moveTo(center.clone().add(new Vector3(0, 0, -2)));
      expect(start.readObservation().crossingCount).toBe(index + 1);
      previous.copy(center);
      runtime.update(parameters.dissolutionSeconds);
    }
    expect(start.readObservation().phase).toBe("complete");
    runtime.unload(start.module);
  }
});

test("restart samples a fresh course without accumulating the previous course offset", () => {
  let fraction = 0;
  const parameters: StartParameters = {
    ...PARAMETERS,
    course: { ...PARAMETERS.course, firstDistanceMeters: [5, 7] },
  };
  const { start, runtime, formGoal } = createPractice(
    parameters,
    () => fraction,
  );
  expect(formGoal().z).toBe(-5);
  fraction = 1;
  start.reset();
  runtime.update(0);
  expect(formGoal().z).toBe(-7);
  runtime.unload(start.module);
});

test("invalid course ranges fail before presentation resources are acquired", () => {
  for (const range of [
    [0, 1],
    [2, 1],
    [1, Infinity],
    [NaN, 1],
  ] as const) {
    expect(() =>
      createPractice({
        ...PARAMETERS,
        course: { ...PARAMETERS.course, spacingMeters: range },
      }),
    ).toThrow("ordered distance ranges");
  }
});

test("curved previews stay world-fixed and never count as learning targets", () => {
  const worldPosition = new Vector3(0, 4, 0);
  const viewerRig = new Group();
  let frame: StartParticleFrame | undefined;
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig,
    parameters: {
      ...PARAMETERS,
      course: { ...PARAMETERS.course, radiusMeters: [1, 2] },
    },
    random: (() => {
      let samples = 0;
      return () => (samples++ % 10) / 10;
    })(),
    particles: {
      load() {},
      setVisible() {},
      unload() {},
      readObjectAnchors: () => undefined,
      update: (next) => {
        frame = next;
      },
    },
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);
  runtime.update(PARAMETERS.arrivalSeconds);
  runtime.update(PARAMETERS.formationSeconds);
  const snapshotPreviews = () =>
    frame?.previews?.map((preview) => ({
      position: preview.goalPosition.clone(),
      normal: preview.goalNormal.clone(),
      radius: preview.ringRadiusMeters,
    }));
  const previews = snapshotPreviews();
  expect(previews).toHaveLength(3);
  expect(previews?.[2]?.position.z).toBeGreaterThan(-9);
  expect(previews?.[2]?.position.z).toBeLessThan(-8);
  expect(previews?.[0]?.normal.x).toBeGreaterThan(0);
  // Cross a decorative plane outside the counted aperture: only a miss results.
  worldPosition.set(-2, 4, -11);
  viewerRig.rotation.y = 1;
  runtime.update(0.1);
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().crossingCount).toBe(0);
  expect(snapshotPreviews()).toEqual(previews);

  // A successful entry keeps the same world-fixed tunnel until its destination.
  worldPosition.set(0, 4, 0);
  viewerRig.rotation.set(0, 0, 0);
  start.reset();
  runtime.update(0);
  runtime.update(PARAMETERS.arrivalSeconds);
  runtime.update(PARAMETERS.formationSeconds);
  const entryPreviews = snapshotPreviews();
  worldPosition.set(2, 4, -6);
  runtime.update(0.1);
  expect(start.readObservation().phase).toBe("crossed");
  runtime.update(PARAMETERS.dissolutionSeconds);
  const nextPosition = new Vector3(0, 4, -10);
  expect(snapshotPreviews()).toEqual(entryPreviews);
  expect(start.readObservation().goalTarget).toEqual(nextPosition);
  expect(start.readObservation().goalPosition).toEqual(nextPosition);
  runtime.unload(start.module);
});

test("an outside passage fades out and retries the same lesson ahead of the current heading", () => {
  const { start, runtime, worldPosition, viewerRig, formGoal, moveTo } =
    createPractice();
  const center = formGoal();
  moveTo(center.clone().add(new Vector3(3, 0, 2)));
  moveTo(center.clone().add(new Vector3(3, 0, -2)));
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().missCount).toBe(1);
  expect(start.readObservation().wake).toBeUndefined();
  expect(start.readObservation().goalTarget).toEqual(center);

  viewerRig.rotation.y = Math.PI / 2;
  runtime.update(PARAMETERS.dissolutionSeconds);
  const nextTarget = new Vector3(2, 0, -5)
    .applyQuaternion(viewerRig.quaternion)
    .add(worldPosition);
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().attempt).toBe(1);
  expect(start.readObservation().direction).toBe("right");
  expect(start.readObservation().goalIndex).toBe(0);
  expect(start.readObservation().goalTarget).toEqual(nextTarget);
  formGoal();
  const normal = new Vector3(0, 0, 1).applyQuaternion(viewerRig.quaternion);
  moveTo(nextTarget.clone().addScaledVector(normal, 2));
  moveTo(nextTarget.clone().addScaledVector(normal, -2));
  expect(start.readObservation().phase).toBe("crossed");
  expect(start.readObservation().crossingCount).toBe(1);
  runtime.unload(start.module);
});

test("a distant receding target recycles spatially while waiting alone never expires it", () => {
  const { start, runtime, formGoal, moveTo } = createPractice();
  const center = formGoal();
  runtime.update(10_000);
  expect(start.readObservation().phase).toBe("flying");
  expect(start.readObservation().goalTarget).toEqual(center);
  expect(start.readObservation().missCount).toBe(0);
  // This remains in front of the goal plane, but leaves its relevance volume.
  moveTo(center.clone().add(new Vector3(120, 0, 10)));
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().missCount).toBe(1);
  expect(start.readObservation().crossingCount).toBe(0);
  runtime.unload(start.module);
});

test("pause holds miss feedback and cannot advance recycling", () => {
  const { start, runtime, formGoal, moveTo } = createPractice();
  const center = formGoal();
  moveTo(center.clone().add(new Vector3(3, 0, -2)));
  runtime.update(PARAMETERS.dissolutionSeconds / 2);
  expect(start.readObservation().phase).toBe("missed");
  const presence = start.readObservation().formationProgress;
  expect(presence).toBeCloseTo(0.5);
  start.setPlaying(false);
  runtime.update(10_000);
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().formationProgress).toBe(presence);
  expect(start.readObservation().goalTarget).toEqual(center);
  expect(start.readObservation().attempt).toBe(0);
  start.setPlaying(true);
  runtime.update(PARAMETERS.dissolutionSeconds / 2);
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().attempt).toBe(1);
  runtime.unload(start.module);
});

test("repeated misses recycle three preview slots without reloading presentation resources", () => {
  let frame: StartParticleFrame | undefined;
  const load = mock(() => {});
  const unload = mock(() => {});
  const { start, runtime, formGoal, moveTo } = createPractice(
    PARAMETERS,
    () => 0.5,
    {
      load,
      unload,
      setVisible() {},
      readObjectAnchors: () => undefined,
      update(next) {
        frame = next;
      },
    },
  );
  const slots = frame?.previews?.slice();
  expect(slots).toHaveLength(3);
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const center = formGoal();
    moveTo(center.clone().add(new Vector3(3, 0, -2)));
    expect(start.readObservation().phase).toBe("missed");
    runtime.update(PARAMETERS.dissolutionSeconds);
    expect(start.readObservation().attempt).toBe(attempt);
    expect(start.readObservation().missCount).toBe(attempt);
    expect(start.readObservation().crossingCount).toBe(0);
    expect(frame?.previews).toHaveLength(3);
    for (const [index, slot] of (frame?.previews ?? []).entries()) {
      expect(slots?.[index]).toBe(slot);
    }
  }
  expect(load).toHaveBeenCalledTimes(1);
  expect(unload).not.toHaveBeenCalled();
  runtime.unload(start.module);
  expect(unload).toHaveBeenCalledTimes(1);
});

test("opening speech delays the first course until it can form ahead of the live flight pose", () => {
  const { start, runtime, worldPosition, viewerRig } = createPractice();
  start.setGoalAdvanceAllowed(false);
  worldPosition.set(100, 20, -200);
  viewerRig.rotation.y = Math.PI / 3;
  runtime.update(30);
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().crossingCount).toBe(0);
  start.setGoalAdvanceAllowed(true);
  runtime.update(0);
  expect(start.readObservation().phase).toBe("forming");
  expect(start.readObservation().goalTarget).toEqual(
    new Vector3(2, 0, -5)
      .applyQuaternion(viewerRig.quaternion)
      .add(worldPosition),
  );
  runtime.update(PARAMETERS.formationSeconds);
  expect(start.readObservation().phase).toBe("flying");
  expect(start.readObservation().missCount).toBe(0);
  runtime.unload(start.module);
});

test("overtaking an unfinished formation retires it without awarding a passage", () => {
  const { start, runtime, moveTo } = createPractice();
  runtime.update(PARAMETERS.arrivalSeconds);
  expect(start.readObservation().phase).toBe("forming");
  const center = start.readObservation().goalTarget.clone();
  moveTo(
    center.clone().add(new Vector3(0, 0, -2)),
    PARAMETERS.formationSeconds / 2,
  );
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().missCount).toBe(1);
  runtime.update(PARAMETERS.dissolutionSeconds);
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().direction).toBe("right");
  expect(start.readObservation().goalTarget.z).toBeLessThan(center.z);
  runtime.unload(start.module);
});

test("recycled vertical targets remain inside the existing flight ceiling", () => {
  const worldPosition = new Vector3(0, 49, 0);
  const start = createStartModule({
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    parameters: { ...PARAMETERS, directions: ["up"] },
    maximumGoalYAt: () => 50,
    random: () => 0.5,
  });
  start.module.load();
  start.module.activate();
  start.module.update?.(0);
  start.module.update?.(PARAMETERS.arrivalSeconds);
  start.module.update?.(PARAMETERS.formationSeconds);
  expect(start.readObservation().goalTarget.y).toBe(50);
  worldPosition.set(8, 50, -8);
  start.module.update?.(0.1);
  expect(start.readObservation().phase).toBe("missed");
  start.module.update?.(PARAMETERS.dissolutionSeconds);
  expect(start.readObservation().goalTarget.y).toBe(50);
  expect(start.readObservation().crossingCount).toBe(0);
  start.module.unload();
});
