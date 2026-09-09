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
  let frame: StartParticleFrame | undefined;
  const { start, runtime, formGoal, moveTo } = createPractice(
    PARAMETERS,
    () => 0.5,
    captureParticles((next) => {
      frame = next;
    }),
  );
  const center = formGoal();
  if (!frame) throw new Error("Missing ring frame");
  const beforeOffset = new Vector3(-1.6, 0.3, 5);
  const afterOffset = new Vector3(2.4, 0.3, -5);
  const before = beforeOffset.dot(frame.goalNormal);
  const after = afterOffset.dot(frame.goalNormal);
  const intersection = center
    .clone()
    .add(beforeOffset.clone().lerp(afterOffset, before / (before - after)));
  moveTo(center.clone().add(beforeOffset));
  moveTo(center.clone().add(new Vector3(2.4, 0.3, -5)));
  const wake = start.readObservation().wake;
  expect(wake).toBeDefined();
  expect(wake?.position.x).toBeCloseTo(intersection.x);
  expect(wake?.position.y).toBeCloseTo(intersection.y);
  expect(wake?.position.z).toBeCloseTo(intersection.z);
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
  const previewPassages = start.readObservation().passageCount;
  expect(previewPassages).toBeGreaterThan(0);
  const borrowedPassagePosition = start.readObservation().passagePosition;
  expect(borrowedPassagePosition).toEqual(preview.position);
  runtime.update(0.1);
  expect(frame?.previews?.[0]?.crossingAgeSeconds).toBeCloseTo(0.1);
  moveTo(preview.position.clone().addScaledVector(preview.normal, 0.2));
  moveTo(preview.position.clone().addScaledVector(preview.normal, -0.2));
  expect(start.readObservation().passageCount).toBe(previewPassages);
  expect(start.readObservation().passagePosition).toBe(borrowedPassagePosition);
  worldDirection.set(-1, 0, 0);
  runtime.update(0.1);
  expect(snapshotPreviews()).toEqual(previews);
  expect(start.readObservation().goalTarget).toEqual(center);

  moveTo(center.clone().add(new Vector3(0, 0, 2)));
  moveTo(center.clone().add(new Vector3(0, 0, -2)));
  expect(start.readObservation().crossingCount).toBe(1);
  expect(start.readObservation().passagePosition).toBe(borrowedPassagePosition);
  expect(start.readObservation().passagePosition).toEqual(center);
  const completedPassages = start.readObservation().passageCount;
  expect(completedPassages).toBeGreaterThan(previewPassages);
  runtime.update(PARAMETERS.dissolutionSeconds);
  expect(start.readObservation().passageCount).toBe(completedPassages);
  const nextOrigin = worldPosition.clone();
  const nextCenter = formGoal();
  expect(
    nextCenter.clone().sub(nextOrigin).dot(worldDirection),
  ).toBeGreaterThan(0);
  expect(snapshotPreviews()).not.toEqual(previews);
  start.reset();
  expect(start.readObservation().passageCount).toBe(0);
  expect(start.readObservation().passagePosition).toBe(borrowedPassagePosition);
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
  const passagesBeforeMiss = start.readObservation().passageCount;
  // This remains in front of the goal plane, but leaves its relevance volume.
  moveTo(center.clone().add(new Vector3(120, 0, 10)));
  expect(start.readObservation().phase).toBe("missed");
  expect(start.readObservation().missCount).toBe(1);
  expect(start.readObservation().crossingCount).toBe(0);
  expect(start.readObservation().passageCount).toBe(passagesBeforeMiss);
  runtime.unload(start.module);
});

test("pause holds miss feedback and cannot advance recycling", () => {
  let frame: StartParticleFrame | undefined;
  const { start, runtime, formGoal, moveTo } = createPractice(
    PARAMETERS,
    () => 0.5,
    captureParticles((next) => {
      frame = next;
    }),
  );
  const center = formGoal();
  if (!frame) throw new Error("Missing goal plane");
  flyOutsideRing(frame, center, moveTo);
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
    if (!frame) throw new Error("Missing goal plane");
    flyOutsideRing(frame, center, moveTo);
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

/** Cross the actual plane at a fixed lateral clearance, even for a tilted ring. */
function flyOutsideRing(
  frame: StartParticleFrame,
  center: Vector3,
  moveTo: (position: Vector3) => void,
): void {
  const normal = frame.goalNormal.clone();
  const outside = new Vector3()
    .crossVectors(normal, new Vector3(0, 1, 0))
    .normalize()
    .multiplyScalar(frame.ringRadiusMeters + 2)
    .add(center);
  moveTo(outside.clone().addScaledVector(normal, 2));
  moveTo(outside.clone().addScaledVector(normal, -2));
}

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
  expect(arrow.distanceTo(origin)).toBeGreaterThanOrEqual(8);
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
  runtime.update(1.6);
  expect(start.readObservation().phase).toBe("missed");
  runtime.update(1.5);
  expect(frame?.arrowPresence).toBeCloseTo(0.5);
  expect(frame?.ringPresence).toBe(0);
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

test("an unreachable reserved upward entrance stays hidden instead of moving after a gaze change", () => {
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
  expect(start.readObservation().phase).toBe("turning");
  expect(frame?.ringPresence).toBe(0);
  expect(start.readObservation().crossingCount).toBe(0);
  runtime.unload(start.module);
});

test("tunnel centers and normals continue the measured turn independently of head yaw", () => {
  function predict(gazeX: number) {
    let frame: StartParticleFrame | undefined;
    const practice = createPractice(
      PARAMETERS,
      () => 0.5,
      captureParticles((next) => {
        frame = next;
      }),
    );
    practice.runtime.update(PARAMETERS.arrivalSeconds);
    practice.runtime.update(PARAMETERS.formationSeconds);
    practice.worldDirection.set(gazeX, 0, -1).normalize();
    for (const angle of [0.06, 0.12, 0.18, 0.24]) {
      practice.moveTo(
        practice.worldPosition
          .clone()
          .add(
            new Vector3(Math.sin(angle), 0, -Math.cos(angle)).multiplyScalar(
              0.2,
            ),
          ),
      );
    }
    expect(practice.start.readObservation().phase).toBe("forming");
    if (!frame) throw new Error("Missing predicted tunnel");
    const origin = practice.worldPosition.clone();
    const center = frame.goalPosition.clone();
    const normal = frame.goalNormal.clone();
    const previews = frame.previews?.map((preview) => ({
      position: preview.goalPosition.clone(),
      normal: preview.goalNormal.clone(),
    }));
    expect(
      center.clone().sub(origin).x / -center.clone().sub(origin).z,
    ).toBeGreaterThan(Math.tan(0.24));
    expect(normal.x).toBeLessThan(-Math.sin(0.24));
    practice.worldDirection.set(-1, 0, 0);
    practice.moveTo(
      practice.worldPosition.clone().add(new Vector3(0.1, 0, -0.1)),
    );
    expect(frame.goalPosition).toEqual(center);
    expect(frame.goalNormal).toEqual(normal);
    practice.runtime.unload(practice.start.module);
    return { center, normal, previews };
  }
  expect(predict(0.3)).toEqual(predict(-0.3));
});

test("new arrows use travel prediction while pause and reset discard stale curvature", () => {
  let frame: StartParticleFrame | undefined;
  const { start, runtime, worldPosition, worldDirection, moveTo } =
    createPractice(
      PARAMETERS,
      () => 0.5,
      captureParticles((next) => {
        frame = next;
      }),
    );
  start.setFormationAllowed(false);
  for (const angle of [0, 0.05, 0.1, 0.15])
    moveTo(
      worldPosition
        .clone()
        .add(
          new Vector3(Math.sin(angle), 0, -Math.cos(angle)).multiplyScalar(0.2),
        ),
    );
  start.setFormationAllowed(true);
  runtime.update(0);
  if (!frame) throw new Error("Missing arrow");
  expect(frame.arrowPosition.x).toBeGreaterThan(worldPosition.x);
  const arrow = frame.arrowPosition.clone();
  worldDirection.set(-0.2, 0, -1).normalize();
  runtime.update(0);
  expect(frame.arrowPosition).toEqual(arrow);
  start.setPlaying(false);
  worldPosition.set(100, 4, 100);
  runtime.update(10);
  start.setPlaying(true);
  start.reset();
  worldDirection.set(0, 0, -1);
  runtime.update(PARAMETERS.arrivalSeconds);
  expect(frame.arrowPosition.x).toBeCloseTo(100);
  expect(frame.arrowPosition.z).toBeLessThan(100);
  runtime.unload(start.module);
});

test("head translation cannot confirm a turn while rig motion can", () => {
  const eye = new Vector3(0, 4, 0);
  const rig = new Vector3(0, 3, 0);
  const start = createStartModule({
    viewpoint: {
      worldPosition: eye,
      worldFlightPosition: rig,
      worldDirection: new Vector3(0, 0, -1),
      worldFlightDirection: new Vector3(0, 0, -1),
      worldUp: new Vector3(0, 1, 0),
      viewHalfAngleRadians: Math.PI / 2,
      viewDistanceMeters: 100,
    },
    parameters: PARAMETERS,
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);
  runtime.update(PARAMETERS.arrivalSeconds);
  runtime.update(PARAMETERS.formationSeconds);
  for (let index = 0; index < 4; index += 1) {
    eye.add(new Vector3(0.1, 0, -0.2));
    runtime.update(0.1);
  }
  expect(start.readObservation().phase).toBe("turning");
  expect(start.readObservation().crossingCount).toBe(0);
  for (let index = 0; index < 2; index += 1) {
    const movement = new Vector3(0.1, 0, -0.2);
    eye.add(movement);
    rig.add(movement);
    runtime.update(0.1);
  }
  expect(start.readObservation().phase).toBe("forming");
  runtime.unload(start.module);
});

test("every tunnel begins beyond its fixed arrow, including an early confirmed turn", () => {
  for (const direction of ["right", "left", "up", "down"] as const) {
    let frame: StartParticleFrame | undefined;
    const practice = createPractice(
      { ...PARAMETERS, directions: [direction] },
      () => 0.5,
      captureParticles((next) => {
        frame = next;
      }),
    );
    practice.moveTo(
      practice.worldPosition
        .clone()
        .addScaledVector(practice.worldDirection, 0.1),
      PARAMETERS.arrivalSeconds,
    );
    if (!frame?.arrowNormal || !frame.arrowUp) throw new Error("Missing cue");
    const arrow = frame.arrowPosition.clone();
    const arrowDirection = new Vector3()
      .crossVectors(frame.arrowUp, frame.arrowNormal)
      .normalize();
    expect(frame.ringPresence).toBe(0);
    expect(frame.previews).toHaveLength(0);
    const beforeTurn = practice.worldPosition.clone();
    practice.beginTurn();
    const travelDirection = practice.worldPosition
      .clone()
      .sub(beforeTurn)
      .normalize();
    const cueFront =
      arrow.clone().sub(practice.worldPosition).dot(travelDirection) +
      3 * Math.abs(arrowDirection.dot(travelDirection));
    expect(frame.arrowPosition).toEqual(arrow);
    expect(frame.arrowPresence).toBe(1);
    expect(frame.previews).toHaveLength(3);
    const entry = frame.previews?.[0];
    if (!entry) throw new Error("Missing entrance");
    expect(
      entry.goalPosition.clone().sub(arrow).normalize().dot(arrowDirection),
    ).toBeCloseTo(1);
    expect(entry.goalNormal.dot(arrowDirection)).toBeCloseTo(-1);
    expect(entry.goalPosition.distanceTo(arrow)).toBeGreaterThan(3);
    expect(frame.goalNormal.angleTo(entry.goalNormal)).toBeGreaterThan(0.01);
    let previousDepth = cueFront;
    for (const center of [
      ...(frame.previews ?? []).map((ring) => ring.goalPosition),
      frame.goalPosition,
    ]) {
      const depth = center
        .clone()
        .sub(practice.worldPosition)
        .dot(travelDirection);
      expect(depth).toBeGreaterThan(previousDepth);

      previousDepth = depth;
    }
    practice.runtime.unload(practice.start.module);
  }
});

test("arc-spaced rings transport orthogonal up vectors and the arrow outlives tunnel formation", () => {
  let frame: StartParticleFrame | undefined;
  const { start, runtime, formGoal, worldDirection } = createPractice(
    PARAMETERS,
    () => 0.5,
    captureParticles((next) => {
      frame = next;
    }),
  );
  const center = formGoal();
  if (!frame?.previews) throw new Error("Missing course");
  const positions = [
    ...frame.previews.map((preview) => preview.goalPosition.clone()),
    center,
  ];
  const gaps = positions
    .slice(1)
    .map((position, index) =>
      position.distanceTo(positions[index] ?? position),
    );
  expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.03);
  for (const preview of frame.previews) {
    expect(preview.goalUp?.length()).toBeCloseTo(1);
    expect(preview.goalUp?.dot(preview.goalNormal)).toBeCloseTo(0);
  }
  expect(start.readObservation().predictionSeconds).toBeGreaterThan(0);
  expect(start.readObservation().predictionSpreadMeters).toBeGreaterThan(0);
  runtime.update(1.5);
  expect(frame.arrowPresence).toBe(1);
  worldDirection.set(0, 0, 1);
  runtime.update(1.9);
  expect(frame.arrowPresence).toBe(1);
  worldDirection.set(0, 0, -1);
  runtime.update(0.1);
  worldDirection.set(0, 0, 1);
  runtime.update(2);
  expect(frame.arrowPresence).toBe(1);
  runtime.update(1.5);
  expect(frame.arrowPresence).toBeCloseTo(0.5);
  expect(start.readObservation().phase).toBe("flying");
  runtime.update(1.5);
  expect(frame.arrowPresence).toBe(0);
  runtime.unload(start.module);
});

test("each cue points forward into its lesson direction and preserves both arrow poses", () => {
  for (const direction of ["right", "left", "up", "down"] as const) {
    let frame: StartParticleFrame | undefined;
    const practice = createPractice(
      { ...PARAMETERS, directions: [direction, direction] },
      () => 0.5,
      captureParticles((next) => {
        frame = next;
      }),
    );
    practice.runtime.update(PARAMETERS.arrivalSeconds);
    if (!frame?.arrowNormal || !frame.arrowUp)
      throw new Error("Missing spatial cue");
    const position = frame.arrowPosition.clone();
    const normal = frame.arrowNormal.clone();
    const up = frame.arrowUp.clone();
    const heading = new Vector3().crossVectors(up, normal).normalize();
    const lesson =
      direction === "right"
        ? new Vector3(1, 0, 0)
        : direction === "left"
          ? new Vector3(-1, 0, 0)
          : direction === "up"
            ? new Vector3(0, 1, 0)
            : new Vector3(0, -1, 0);
    expect(heading.dot(new Vector3(0, 0, -1))).toBeCloseTo(0.8);
    expect(heading.dot(lesson)).toBeCloseTo(0.6);
    const eyeRay = practice.worldPosition.clone().sub(position).normalize();
    // The broad face maximizes visibility without changing the promised axis.
    const facing = eyeRay.clone().projectOnPlane(heading).normalize();
    expect(normal.dot(facing)).toBeCloseTo(1);
    expect(normal.dot(eyeRay)).toBeGreaterThan(0.5);
    expect(frame.arrowAngleRadians).toBe(0);
    const hint = practice.start
      .readObservation()
      .goalTarget.clone()
      .sub(practice.worldPosition);
    expect(hint.dot(lesson)).toBeGreaterThan(0);
    expect(hint.dot(new Vector3(0, 0, -1))).toBeGreaterThan(0);
    practice.worldDirection.set(0.3, 0, -1).normalize();
    practice.runtime.update(0.1);
    expect(frame.arrowPosition).toEqual(position);
    expect(frame.arrowNormal).toEqual(normal);
    expect(frame.arrowUp).toEqual(up);
    practice.worldDirection.set(0, 0, -1);
    practice.beginTurn();
    practice.runtime.update(PARAMETERS.formationSeconds);
    expect(frame.arrowNormal).toEqual(normal);
    const center = frame.goalPosition.clone();
    const passageNormal = frame.goalNormal.clone();
    practice.moveTo(center.clone().addScaledVector(passageNormal, 2));
    practice.moveTo(center.clone().addScaledVector(passageNormal, -2));
    expect(practice.start.readObservation().phase).toBe("crossed");
    practice.runtime.update(PARAMETERS.dissolutionSeconds);
    practice.runtime.update(PARAMETERS.arrivalSeconds);
    expect(frame.retiringArrow?.presence).toBeGreaterThan(0);
    expect(frame.retiringArrow?.position).toEqual(position);
    expect(frame.retiringArrow?.normal).toEqual(normal);
    expect(frame.retiringArrow?.up).toEqual(up);
    expect(frame.retiringArrow?.angleRadians).toBe(0);
    practice.runtime.unload(practice.start.module);
  }
});

test("head-pitched arrow placement cannot reverse the flight-relative downward instruction", () => {
  const hints: Vector3[] = [];
  for (const pitch of [0, 0.6]) {
    const rig = new Vector3(0, 20, 0);
    const gaze = new Vector3(0, Math.sin(pitch), -Math.cos(pitch));
    let frame: StartParticleFrame | undefined;
    const start = createStartModule({
      viewpoint: {
        worldPosition: rig,
        worldFlightPosition: rig,
        worldFlightDirection: new Vector3(0, 0, -1),
        worldDirection: gaze,
        worldUp: new Vector3(0, 1, 0),
        viewHalfAngleRadians: 0.7,
        viewDistanceMeters: 100,
      },
      parameters: { ...PARAMETERS, directions: ["down"] },
      particles: captureParticles((next) => {
        frame = next;
      }),
    });
    const runtime = new ModuleRuntime();
    runtime.load(start.module);
    runtime.activate(start.module);
    runtime.update(0);
    runtime.update(PARAMETERS.arrivalSeconds);
    if (!frame) throw new Error("Missing downward cue");
    const hint = start.readObservation().goalTarget.clone();
    hints.push(hint);
    expect(hint.y).toBeLessThan(rig.y);
    expect(hint.z).toBeLessThan(rig.z);
    if (pitch > 0) expect(frame.arrowPosition.y).toBeGreaterThan(rig.y);
    runtime.unload(start.module);
  }
  expect(hints[1]?.distanceTo(hints[0] ?? new Vector3())).toBeLessThanOrEqual(
    PARAMETERS.course.radiusMeters[0] * 0.5 + 1e-12,
  );
});

test("the production pitched view can reveal an entrance during a real two-meter-per-second turn", () => {
  const position = new Vector3(0, 10, 0);
  const direction = new Vector3(0, 0.5, -Math.sqrt(0.75));
  const flightDirection = new Vector3(0, 0, -1);
  let frame: StartParticleFrame | undefined;
  const start = createStartModule({
    viewpoint: {
      worldPosition: position,
      worldFlightPosition: position,
      worldFlightDirection: flightDirection,
      worldDirection: direction,
      worldUp: new Vector3(0, Math.sqrt(0.75), 0.5),
      viewHalfAngleRadians: (40 * Math.PI) / 180,
      viewDistanceMeters: 128,
    },
    parameters: {
      ...PARAMETERS,
      formationSeconds: 2,
      course: {
        firstDistanceMeters: [10, 10],
        spacingMeters: [10, 10],
        radiusMeters: [2.5, 2.5],
      },
    },
    random: () => 0.5,
    particles: captureParticles((next) => {
      frame = next;
    }),
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);
  runtime.update(0);
  for (let index = 0; index < 30; index += 1) {
    const yaw = Math.min(0.2, Math.max(0, index - 20) * 0.04);
    flightDirection.set(Math.sin(yaw), 0, -Math.cos(yaw));
    direction.copy(flightDirection).multiplyScalar(Math.sqrt(0.75));
    direction.y = 0.5;
    position.addScaledVector(flightDirection, 0.2);
    runtime.update(0.1);
  }
  expect(start.readObservation().phase).toBe("forming");
  expect(start.readObservation().missCount).toBe(0);
  if (!frame?.arrowUp || !frame.arrowNormal || !frame.previews?.[0])
    throw new Error("Missing pitched-view course");
  const arrowAxis = new Vector3()
    .crossVectors(frame.arrowUp, frame.arrowNormal)
    .normalize();
  expect(arrowAxis.x).toBeCloseTo(0.6);
  expect(arrowAxis.y).toBeCloseTo(0);
  expect(arrowAxis.z).toBeCloseTo(-0.8);
  const entry = frame.previews[0];
  expect(
    entry.goalPosition
      .clone()
      .sub(frame.arrowPosition)
      .normalize()
      .dot(arrowAxis),
  ).toBeCloseTo(1);
  expect(entry.goalNormal.dot(arrowAxis)).toBeCloseTo(-1);
  expect(Math.abs(entry.goalPosition.y - position.y)).toBeLessThanOrEqual(1.25);
  runtime.unload(start.module);
});
