import { expect, mock, test } from "bun:test";
import { Vector3 } from "three";
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
  const worldDirection = new Vector3(0, 0, -1);
  const start = createStartModule({
    viewpoint: {
      worldPosition,
      worldUp: new Vector3(0, 1, 0),
      worldDirection,
      viewHalfAngleRadians: Math.PI / 2,
      viewDistanceMeters: 100,
    },
    parameters,
    random,
    particles,
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);

  function formGoal(): Vector3 {
    moveTo(
      worldPosition.clone().addScaledVector(worldDirection, 0.1),
      parameters.arrivalSeconds,
    );
    beginTurn();
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

  function beginTurn(): void {
    runtime.update(parameters.formationSeconds);
    const direction = start.readObservation().direction;
    const side =
      direction === "up" || direction === "down"
        ? new Vector3(0, 1, 0)
        : new Vector3()
            .crossVectors(worldDirection, new Vector3(0, 1, 0))
            .normalize();
    if (direction === "left" || direction === "down") side.negate();
    const movement = worldDirection
      .clone()
      .addScaledVector(side, 0.5)
      .normalize()
      .multiplyScalar(0.2);
    for (let frame = 0; frame < 2; frame += 1)
      moveTo(worldPosition.clone().add(movement));
    expect(start.readObservation().phase).toBe("forming");
  }

  return {
    start,
    runtime,
    worldPosition,
    worldDirection,
    formGoal,
    beginTurn,
    moveTo,
  };
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
  const { start, runtime, worldPosition, formGoal, beginTurn, moveTo } =
    createPractice();
  runtime.update(PARAMETERS.arrivalSeconds);
  beginTurn();
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
  expect(center.z).toBeLessThan(30);
  expect(center.x).toBeGreaterThan(20);
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
    viewpoint: {
      worldPosition,
      worldUp: new Vector3(0, 1, 0),
      worldDirection: new Vector3(0, 0, -1),
      viewHalfAngleRadians: Math.PI / 2,
      viewDistanceMeters: 100,
    },
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
  let frame: StartParticleFrame | undefined;
  const { start, runtime, worldPosition, worldDirection, formGoal, moveTo } =
    createPractice(PARAMETERS, () => 0.5, {
      load() {},
      setVisible() {},
      unload() {},
      readObjectAnchors: () => undefined,
      update(next) {
        frame = next;
      },
    });
  const center = formGoal();
  const snapshotPreviews = () =>
    frame?.previews?.map((preview) => ({
      position: preview.goalPosition.clone(),
      normal: preview.goalNormal.clone(),
      radius: preview.ringRadiusMeters,
    }));
  const previews = snapshotPreviews();
  expect(previews).toHaveLength(3);
  for (const preview of previews ?? []) {
    expect(preview.position.z).toBeLessThan(0);
    expect(preview.position.z).toBeGreaterThan(center.z);
  }
  const preview = previews?.[0];
  if (!preview) throw new Error("Missing decorative preview");
  moveTo(preview.position.clone().addScaledVector(preview.normal, 0.2));
  moveTo(preview.position.clone().addScaledVector(preview.normal, -0.2));
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().phase).toBe("flying");
  expect(frame?.previews?.[0]?.crossingAgeSeconds).toBe(0);
  runtime.update(0.1);
  expect(frame?.previews?.[0]?.crossingAgeSeconds).toBeCloseTo(0.1);
  worldDirection.set(-1, 0, 0);
  runtime.update(0.1);
  expect(snapshotPreviews()).toEqual(previews);
  expect(start.readObservation().goalTarget).toEqual(center);

  moveTo(center.clone().add(new Vector3(0, 0, 2)));
  moveTo(center.clone().add(new Vector3(0, 0, -2)));
  expect(start.readObservation().crossingCount).toBe(1);
  runtime.update(PARAMETERS.dissolutionSeconds);
  const nextOrigin = worldPosition.clone();
  const nextCenter = formGoal();
  expect(
    nextCenter.clone().sub(nextOrigin).dot(worldDirection),
  ).toBeGreaterThan(0);
  expect(snapshotPreviews()).not.toEqual(previews);
  runtime.unload(start.module);
});

test("an outside passage fades out and retries the same lesson ahead of the current heading", () => {
  const { start, runtime, worldPosition, worldDirection, formGoal, moveTo } =
    createPractice();
  const center = formGoal();
  moveTo(center.clone().add(new Vector3(3, 0, 2)));
  moveTo(center.clone().add(new Vector3(3, 0, -2)));
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().missCount).toBe(1);
  expect(start.readObservation().wake).toBeUndefined();
  expect(start.readObservation().goalTarget).toEqual(center);

  worldDirection.set(-1, 0, 0);
  runtime.update(PARAMETERS.dissolutionSeconds);
  const nextOrigin = worldPosition.clone();
  expect(start.readObservation().phase).toBe("arrival");
  expect(start.readObservation().attempt).toBe(1);
  expect(start.readObservation().direction).toBe("right");
  expect(start.readObservation().goalIndex).toBe(0);
  const nextTarget = formGoal();
  expect(
    nextTarget.clone().sub(nextOrigin).dot(worldDirection),
  ).toBeGreaterThan(0);
  const normal = worldDirection.clone().negate();
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
  let slots: StartParticleFrame["previews"] | undefined;
  for (let attempt = 1; attempt <= 100; attempt += 1) {
    const center = formGoal();
    slots ??= frame?.previews?.slice();
    expect(slots).toHaveLength(3);
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

test("overtaking an unfinished formation retires it without awarding a passage", () => {
  const { start, runtime, beginTurn, moveTo } = createPractice();
  runtime.update(PARAMETERS.arrivalSeconds);
  beginTurn();
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
  runtime.update(PARAMETERS.arrivalSeconds);
  beginTurn();
  expect(start.readObservation().goalTarget.z).toBeLessThan(center.z);
  runtime.unload(start.module);
});

function captureParticles(
  onFrame: (frame: StartParticleFrame) => void,
): StartParticleEffect {
  return {
    load() {},
    unload() {},
    setVisible() {},
    readObjectAnchors: () => undefined,
    update: onFrame,
  };
}

test("the spoken cue reveals only a world-fixed arrow; gaze and wrong-way travel cannot form rings", () => {
  let frame: StartParticleFrame | undefined;
  const { start, runtime, worldPosition, worldDirection, moveTo, beginTurn } =
    createPractice(
      PARAMETERS,
      () => 0.5,
      captureParticles((next) => {
        frame = next;
      }),
    );
  start.setFormationAllowed(false);
  runtime.update(30);
  expect(start.readObservation().phase).toBe("arrival");
  expect(frame?.arrowPresence).toBe(0);
  worldPosition.set(30, 10, -40);
  runtime.update(0);
  start.setFormationAllowed(true);
  runtime.update(0);
  expect(start.readObservation().phase).toBe("turning");
  if (!frame) throw new Error("Missing arrow frame");
  const arrow = frame.arrowPosition.clone();
  const origin = worldPosition.clone();
  expect(arrow.clone().sub(origin).angleTo(worldDirection)).toBeCloseTo(0);
  expect(arrow.distanceTo(origin)).toBeGreaterThanOrEqual(12);
  expect(frame.ringPresence).toBe(0);
  expect(frame.previews).toHaveLength(0);
  for (let index = 0; index < 2; index += 1)
    moveTo(worldPosition.clone().add(new Vector3(0.1, 0, -0.2)), 0.1);
  expect(frame.ringPresence).toBe(0);
  expect(start.readObservation().phase).toBe("turning");

  worldDirection.set(0.5, 0, -1).normalize();
  runtime.update(0.3);
  expect(start.readObservation().phase).toBe("turning");
  expect(frame.arrowPosition).toEqual(arrow);
  worldDirection.set(0, 0, -1);
  for (let index = 0; index < 3; index += 1)
    moveTo(worldPosition.clone().add(new Vector3(-0.1, 0, -0.2)));
  expect(start.readObservation().phase).toBe("turning");
  expect(frame.ringPresence).toBe(0);
  expect(frame.arrowPosition).toEqual(arrow);

  beginTurn();
  expect(frame.ringPresence).toBe(1);
  expect(frame.previews).toHaveLength(3);
  expect(frame.arrowPosition).toEqual(arrow);
  expect(start.readObservation().crossingCount).toBe(0);
  const ring = frame.goalPosition.clone();
  start.setPlaying(false);
  worldDirection.set(1, 0, 0);
  worldPosition.add(new Vector3(5, 2, 1));
  runtime.update(10);
  expect(frame.arrowPosition).toEqual(arrow);
  expect(frame.goalPosition).toEqual(ring);
  runtime.unload(start.module);
});

test("all four commands require their matching movement and reveal reachable rings", () => {
  for (const direction of PARAMETERS.directions) {
    let frame: StartParticleFrame | undefined;
    const { start, runtime, worldPosition, worldDirection, formGoal } =
      createPractice(
        { ...PARAMETERS, directions: [direction] },
        () => 0.5,
        captureParticles((next) => {
          frame = next;
        }),
      );
    const center = formGoal();
    expect(frame?.ringPresence).toBe(1);
    expect(
      center.clone().sub(worldPosition).dot(worldDirection),
    ).toBeGreaterThan(0);
    expect(start.readObservation().crossingCount).toBe(0);
    runtime.unload(start.module);
  }
});

test("an out-of-view arrow dissolves and retries without awarding a goal", () => {
  let frame: StartParticleFrame | undefined;
  const { start, runtime, worldPosition, worldDirection } = createPractice(
    PARAMETERS,
    () => 0.5,
    captureParticles((next) => {
      frame = next;
    }),
  );
  runtime.update(PARAMETERS.arrivalSeconds);
  const oldArrow = frame?.arrowPosition.clone();
  worldDirection.set(0, 0, 1);
  runtime.update(0.4);
  expect(start.readObservation().phase).toBe("turning");
  runtime.update(0.4);
  expect(start.readObservation().phase).toBe("missed");
  runtime.update(PARAMETERS.dissolutionSeconds / 2);
  expect(frame?.arrowPresence).toBeCloseTo(0.5);
  expect(frame?.ringPresence).toBe(0);
  runtime.update(PARAMETERS.dissolutionSeconds / 2);
  expect(start.readObservation().attempt).toBe(1);
  runtime.update(PARAMETERS.arrivalSeconds);
  expect(start.readObservation().phase).toBe("turning");
  expect(frame?.arrowPosition).not.toEqual(oldArrow);
  expect(
    frame?.arrowPosition.clone().sub(worldPosition).angleTo(worldDirection),
  ).toBeCloseTo(0);
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().direction).toBe("right");
  runtime.unload(start.module);
});

test("an upward lesson keeps its rings hidden until the gaze permits a reachable course below the ceiling", () => {
  const worldPosition = new Vector3(0, 49, 0);
  const worldDirection = new Vector3(0, 0.9, -0.3).normalize();
  let frame: StartParticleFrame | undefined;
  const start = createStartModule({
    viewpoint: {
      worldPosition,
      worldDirection,
      worldUp: new Vector3(0, 1, 0),
      viewHalfAngleRadians: 0.35,
      viewDistanceMeters: 100,
    },
    parameters: { ...PARAMETERS, directions: ["up"] },
    maximumGoalYAt: () => 50,
    random: () => 0.5,
    particles: captureParticles((next) => {
      frame = next;
    }),
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);
  worldPosition.z -= 0.1;
  runtime.update(PARAMETERS.arrivalSeconds);
  runtime.update(PARAMETERS.formationSeconds);
  for (let index = 0; index < 2; index += 1) {
    worldPosition.add(new Vector3(0, 0.05, -0.1));
    runtime.update(0.1);
  }
  expect(start.readObservation().phase).toBe("turning");
  expect(frame?.ringPresence).toBe(0);
  expect(start.readObservation().crossingCount).toBe(0);
  worldDirection.set(0, 0, -1);
  worldPosition.add(new Vector3(0, 0.05, -0.1));
  runtime.update(0.1);
  expect(start.readObservation().phase).toBe("forming");
  if (!frame) throw new Error("Missing reachable formation");
  expect(frame.ringPresence).toBe(1);
  expect(frame.goalPosition.y).toBeLessThanOrEqual(50);
  const offset = frame.goalPosition.clone().sub(worldPosition);
  expect(
    offset.angleTo(worldDirection) +
      Math.asin(frame.ringRadiusMeters / offset.length()),
  ).toBeLessThan(0.35);
  runtime.unload(start.module);
});
