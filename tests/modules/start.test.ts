import { expect, spyOn, test } from "bun:test";
import { Group, Mesh, MeshBasicMaterial, Scene, Vector3 } from "three";
import {
  createStartModule,
  type StartInput,
} from "../../src/modules/start/start.module";
import { ModuleRuntime } from "../../src/world/module-runtime";

const NEUTRAL: StartInput = { turnRight: 0, climb: 0 };
const RIGHT: StartInput = { turnRight: 1, climb: 0 };
const LEFT: StartInput = { turnRight: -1, climb: 0 };
const UP: StartInput = { turnRight: 0, climb: 1 };
const DOWN: StartInput = { turnRight: 0, climb: -1 };

function createStart() {
  const scene = new Scene();
  const worldPosition = new Vector3(0, 2, 0);
  const start = createStartModule({
    scene,
    viewpoint: { worldPosition, viewDistanceMeters: 100 },
    viewerRig: new Group(),
    viewPitchDegrees: 0,
    parameters: { guideDistanceMeters: 3 },
  });
  const runtime = new ModuleRuntime();
  runtime.load(start.module);
  runtime.activate(start.module);

  function input(intention: StartInput | undefined, frames = 1): void {
    start.setInput(intention);
    for (let frame = 0; frame < frames; frame += 1) runtime.update(0.1);
  }

  return { scene, worldPosition, start, runtime, input };
}

test("requires neutral arrival and a continuous matching gesture for each direction", () => {
  const { start, input } = createStart();
  input(undefined, 20);
  input(RIGHT, 20);
  expect(start.readPhase()).toBe("arrival");

  input(NEUTRAL);
  expect(start.readPhase()).toBe("right");
  input(LEFT, 20);
  input({ turnRight: 0.4, climb: 0 }, 20);
  expect(start.readPhase()).toBe("right");
  input(RIGHT, 4);
  expect(start.readPhase()).toBe("right");
  input(RIGHT);
  expect(start.readPhase()).toBe("left");

  for (const [direction, phase] of [
    [LEFT, "up"],
    [UP, "down"],
    [DOWN, "complete"],
  ] as const) {
    input(NEUTRAL);
    input(direction, 5);
    expect(start.readPhase()).toBe(phase);
  }
  input(undefined, 20);
  input(NEUTRAL, 20);
  input(RIGHT, 20);
  expect(start.readPhase()).toBe("complete");
});

test("interruptions discard held progress and invalid input requires a new neutral", () => {
  const { start, input } = createStart();
  input(NEUTRAL);
  input(RIGHT, 4);
  input(LEFT);
  input(RIGHT, 4);
  expect(start.readPhase()).toBe("right");

  input(undefined);
  input(RIGHT, 20);
  expect(start.readPhase()).toBe("right");
  input(NEUTRAL);
  input(RIGHT, 4);
  expect(start.readPhase()).toBe("right");
  input(RIGHT);
  expect(start.readPhase()).toBe("left");
});

test("a held diagonal cannot advance the following direction before neutral", () => {
  const { start, input } = createStart();
  input(NEUTRAL);
  input(RIGHT, 5);
  input(NEUTRAL);
  const leftAndUp = { turnRight: -1, climb: 1 };
  input(leftAndUp, 5);
  expect(start.readPhase()).toBe("up");
  input(leftAndUp, 20);
  expect(start.readPhase()).toBe("up");
  input(undefined);
  input(UP, 20);
  expect(start.readPhase()).toBe("up");
  input(NEUTRAL);
  input(UP, 5);
  expect(start.readPhase()).toBe("down");
});

test("copies input and does not turn a delayed frame into a completed gesture", () => {
  const { start, runtime, input } = createStart();
  input(NEUTRAL);
  const borrowedInput = { turnRight: 1, climb: 0 };
  start.setInput(borrowedInput);
  borrowedInput.turnRight = -1;
  runtime.update(10);
  expect(start.readPhase()).toBe("right");
  for (let frame = 0; frame < 4; frame += 1) runtime.update(0.1);
  expect(start.readPhase()).toBe("left");
});

test("deactivation hides and stops the guide without resetting learning", () => {
  const { scene, worldPosition, start, runtime, input } = createStart();
  const anchor = scene.children[0];
  if (!anchor) throw new Error("Start guide is missing");
  const guide = anchor.children[0];
  if (
    !(guide instanceof Mesh) ||
    !(guide.material instanceof MeshBasicMaterial)
  )
    throw new Error("Start guide mesh is missing");
  expect(guide.material.transparent).toBe(false);

  input(NEUTRAL);
  input(RIGHT, 5);
  expect(start.readPhase()).toBe("left");
  input(NEUTRAL);
  const previousPosition = anchor.position.clone();
  const previousScale = guide.scale.clone();
  runtime.deactivate(start.module);
  worldPosition.x = 10;
  input(LEFT, 20);
  expect(anchor.visible).toBe(false);
  expect(anchor.position).toEqual(previousPosition);
  expect(guide.scale).toEqual(previousScale);
  expect(start.readPhase()).toBe("left");

  runtime.activate(start.module);
  input(LEFT, 5);
  expect(anchor.visible).toBe(true);
  expect(anchor.position.x).toBe(10);
  expect(start.readPhase()).toBe("up");

  const disposeGeometry = spyOn(guide.geometry, "dispose");
  const disposeMaterial = spyOn(guide.material, "dispose");
  runtime.unload(start.module);
  start.module.unload();
  expect(scene.children).toHaveLength(0);
  expect(disposeGeometry).toHaveBeenCalledTimes(1);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);

  runtime.load(start.module);
  runtime.activate(start.module);
  expect(start.readPhase()).toBe("arrival");
  runtime.unload(start.module);
});

test("completion remains visible and still follows the visitor without pulsing", () => {
  const { scene, worldPosition, start, input } = createStart();
  for (const direction of [RIGHT, LEFT, UP, DOWN]) {
    input(NEUTRAL);
    input(direction, 5);
  }
  const anchor = scene.children[0];
  const guide = anchor?.children[0];
  if (!anchor || !(guide instanceof Mesh))
    throw new Error("Start guide is missing");
  const completedScale = guide.scale.clone();
  worldPosition.x = 4;
  input(RIGHT, 20);
  expect(start.readPhase()).toBe("complete");
  expect(anchor.visible).toBe(true);
  expect(anchor.position.x).toBe(4);
  expect(guide.scale).toEqual(completedScale);
});

test("rejects an unusable guide distance before creating resources", () => {
  for (const guideDistanceMeters of [0, -1, Number.NaN, Infinity]) {
    const scene = new Scene();
    expect(() =>
      createStartModule({
        scene,
        viewpoint: { worldPosition: new Vector3(), viewDistanceMeters: 100 },
        viewerRig: new Group(),
        viewPitchDegrees: 0,
        parameters: { guideDistanceMeters },
      }),
    ).toThrow("guideDistanceMeters");
    expect(scene.children).toHaveLength(0);
  }
});

test("failed scene attachment releases the created resources", () => {
  const scene = new Scene();
  const attachmentError = new Error("Scene attachment failed");
  let disposedGeometry = 0;
  let disposedMaterial = 0;
  spyOn(scene, "add").mockImplementation((...objects) => {
    const guide = objects[0]?.children[0];
    if (
      !(guide instanceof Mesh) ||
      !(guide.material instanceof MeshBasicMaterial)
    )
      throw new Error("Start guide mesh is missing");
    guide.geometry.addEventListener("dispose", () => {
      disposedGeometry += 1;
    });
    guide.material.addEventListener("dispose", () => {
      disposedMaterial += 1;
    });
    throw attachmentError;
  });
  const start = createStartModule({
    scene,
    viewpoint: { worldPosition: new Vector3(), viewDistanceMeters: 100 },
    viewerRig: new Group(),
    viewPitchDegrees: 0,
    parameters: { guideDistanceMeters: 3 },
  });
  expect(start.module.load).toThrow(attachmentError);
  start.module.unload();
  expect(scene.children).toHaveLength(0);
  expect(disposedGeometry).toBe(1);
  expect(disposedMaterial).toBe(1);
});
