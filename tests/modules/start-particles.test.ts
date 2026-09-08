import { expect, spyOn, test } from "bun:test";
import {
  Matrix4,
  Points,
  PointsMaterial,
  Scene,
  ShaderLib,
  Vector3,
} from "three";
import {
  createStartParticleEffect,
  type StartParticleFrame,
  type StartParticleParameters,
} from "../../src/modules/start/start-particles.effect";

const PARAMETERS: StartParticleParameters = {
  count: 1400,
  sizeMeters: 0.065,
  color: 0x425563,
  cloudRadiusMeters: 5,
  cloudDepthMeters: 5,
  driftAmplitudeMeters: 0.18,
  driftSpeed: 0.65,
  sparkle: 0.08,
  glow: 0.12,
  wakeRadiusMeters: 3,
  wakeDurationSeconds: 2.4,
  wakeDistanceMeters: 2.5,
};

function createFrame(): StartParticleFrame {
  return {
    elapsedSeconds: 0,
    goalPosition: new Vector3(2, 3, -8),
    goalNormal: new Vector3(0, 0, 1),
    arrowPosition: new Vector3(2, 5, -8),
    arrowNormal: new Vector3(0, 0, 1),
    ringRadiusMeters: 1.5,
    arrowAngleRadians: 0,
    formationProgress: 0,
    completionProgress: 0,
  };
}

function readPoints(scene: Scene) {
  const points = scene.children[0];
  if (
    !(points instanceof Points) ||
    !(points.material instanceof PointsMaterial)
  )
    throw new Error("Start particle draw is missing");
  return points;
}

function compileMaterial(material: PointsMaterial) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: ShaderLib.points.vertexShader,
    fragmentShader: ShaderLib.points.fragmentShader,
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

test("one fixed cloud forms both targets without reallocating or uploading frame buffers", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.load();
  const points = readPoints(scene);
  const positionAttribute = points.geometry.getAttribute("position");
  const positions = positionAttribute.array;
  const targets = points.geometry.getAttribute("startTarget").array;
  expect(scene.children).toHaveLength(1);
  expect(positionAttribute.count).toBe(PARAMETERS.count);
  expect(
    Array.from(positions).some(
      (position, index) => position !== targets[index],
    ),
  ).toBe(true);
  const arrowParticles =
    points.geometry.getAttribute("startArrowParticle").array;
  expect(Array.from(arrowParticles).filter(Boolean)).toHaveLength(350);
  const shader = compileMaterial(points.material);
  expect(shader.vertexShader).toContain(
    "vec3 transformed = animateStartParticle(position);",
  );
  expect(shader.fragmentShader).toContain(
    "applyStartParticleAppearance(diffuseColor);",
  );
  effect.setVisible(true);
  const frame = createFrame();
  for (let index = 0; index <= 100; index += 1) {
    effect.update({
      ...frame,
      elapsedSeconds: index / 10,
      formationProgress: index / 100,
    });
  }
  expect(points.geometry.getAttribute("position")).toBe(positionAttribute);
  expect(positionAttribute.array).toBe(positions);
  expect(positionAttribute.version).toBe(0);
  expect(shader.uniforms.startFormation?.value).toBe(1);
  expect(points.material.depthWrite).toBe(false);
  effect.unload();
});

test("copies independent poses and one wake without retaining borrowed frame vectors", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const shader = compileMaterial(readPoints(scene).material);
  const wakePosition = new Vector3(1, 2, 3);
  const wakeDirection = new Vector3(0, 0, -1);
  effect.update({
    ...createFrame(),
    wake: {
      position: wakePosition,
      direction: wakeDirection,
      strength: 0.8,
      ageSeconds: 0.2,
    },
  });
  wakePosition.set(20, 20, 20);
  wakeDirection.set(1, 0, 0);
  expect(shader.uniforms.startWakePosition?.value).toEqual(
    new Vector3(1, 2, 3),
  );
  expect(shader.uniforms.startWakeDirection?.value).toEqual(
    new Vector3(0, 0, -1),
  );
  expect(shader.uniforms.startWakeAge?.value).toBe(0.2);
  expect(shader.uniforms.startWakeStrength?.value).toBe(0.8);
  expect(shader.uniforms.startGoalPose?.value).toEqual(
    new Matrix4().makeTranslation(2, 3, -8),
  );
  expect(shader.uniforms.startArrowPose?.value).toEqual(
    new Matrix4().makeTranslation(2, 5, -8),
  );
  effect.update(createFrame());
  expect(shader.uniforms.startWakeStrength?.value).toBe(0);
  effect.unload();
});

test("the assistance arrow preserves heading right and up after turning around", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const shader = compileMaterial(readPoints(scene).material);
  const pitchRadians = Math.PI / 6;
  for (const headingRadians of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const arrowNormal = new Vector3(
      Math.sin(headingRadians) * Math.cos(pitchRadians),
      Math.sin(pitchRadians),
      Math.cos(headingRadians) * Math.cos(pitchRadians),
    );
    effect.update({ ...createFrame(), arrowNormal });
    const pose = shader.uniforms.startArrowPose?.value;
    if (!(pose instanceof Matrix4)) throw new Error("Arrow pose is missing");
    const right = new Vector3().setFromMatrixColumn(pose, 0);
    const up = new Vector3().setFromMatrixColumn(pose, 1);
    const expectedRight = new Vector3(
      Math.cos(headingRadians),
      0,
      -Math.sin(headingRadians),
    );
    expect(right.dot(expectedRight)).toBeCloseTo(1);
    expect(up.y).toBeGreaterThan(0);
    expect(up.dot(arrowNormal)).toBeCloseTo(0);
  }
  effect.unload();
});

test("hidden effects do no frame work and unload releases each GPU resource once", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({
    scene,
    parameters: { ...PARAMETERS, sparkle: 0, glow: 0 },
  });
  effect.load();
  const points = readPoints(scene);
  const shader = compileMaterial(points.material);
  expect(points.visible).toBe(false);
  effect.update({ ...createFrame(), elapsedSeconds: 10 });
  expect(shader.uniforms.startTime?.value).toBe(0);
  effect.setVisible(true);
  effect.update({ ...createFrame(), elapsedSeconds: 20 });
  effect.setVisible(false);
  effect.update({ ...createFrame(), elapsedSeconds: 30 });
  expect(shader.uniforms.startTime?.value).toBe(20);
  expect(shader.uniforms.startSparkle?.value).toBe(0);
  expect(shader.uniforms.startGlow?.value).toBe(0);
  const disposeGeometry = spyOn(points.geometry, "dispose");
  const disposeMaterial = spyOn(points.material, "dispose");
  effect.unload();
  effect.unload();
  effect.update({ ...createFrame(), elapsedSeconds: 40 });
  expect(shader.uniforms.startTime?.value).toBe(20);
  expect(scene.children).toHaveLength(0);
  expect(disposeGeometry).toHaveBeenCalledTimes(1);
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  effect.load();
  expect(readPoints(scene)).not.toBe(points);
  effect.unload();
});

test("failed scene attachment removes partial resources and permits a fresh load", () => {
  const scene = new Scene();
  const failure = new Error("Start scene attachment failed");
  let disposedGeometry = 0;
  let disposedMaterial = 0;
  const originalAdd = scene.add;
  const add = spyOn(scene, "add").mockImplementation((...objects) => {
    originalAdd.call(scene, ...objects);
    const points = readPoints(scene);
    points.geometry.addEventListener("dispose", () => {
      disposedGeometry += 1;
    });
    points.material.addEventListener("dispose", () => {
      disposedMaterial += 1;
    });
    throw failure;
  });
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  expect(effect.load).toThrow(failure);
  effect.unload();
  expect(scene.children).toHaveLength(0);
  expect(disposedGeometry).toBe(1);
  expect(disposedMaterial).toBe(1);
  add.mockRestore();
  effect.load();
  expect(scene.children).toHaveLength(1);
  effect.unload();
});

test("invalid particle capacities and physical extents fail before resource creation", () => {
  for (const count of [0, 31, 1.5, 16_385, Infinity, Number.NaN]) {
    expect(() =>
      createStartParticleEffect({
        scene: new Scene(),
        parameters: { ...PARAMETERS, count },
      }),
    ).toThrow("count");
  }
  expect(() =>
    createStartParticleEffect({
      scene: new Scene(),
      parameters: { ...PARAMETERS, wakeDurationSeconds: 0 },
    }),
  ).toThrow("wakeDurationSeconds");
});
