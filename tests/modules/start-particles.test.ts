import { expect, spyOn, test } from "bun:test";
import {
  BufferAttribute,
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
};

function createFrame(): StartParticleFrame {
  return {
    elapsedSeconds: 0,
    goalPosition: new Vector3(2, 3, -8),
    arrowPosition: new Vector3(2, 3, -4),
    goalNormal: new Vector3(0, 0, 1),
    goalUp: new Vector3(0, 1, 0),
    ringRadiusMeters: 1.5,
    arrowAngleRadians: 0,
    formationProgress: 0,
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
  const arrowParticles = points.geometry.getAttribute("startRole").array;
  const arrowCount = Array.from(arrowParticles).filter(
    (role) => role === 1,
  ).length;
  expect(arrowCount).toBe(PARAMETERS.count * 0.2);
  expect(Array.from(arrowParticles).filter((role) => role === 5)).toHaveLength(
    arrowCount,
  );
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

test("copies the shared world pose and one wake without retaining borrowed frame vectors", () => {
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
  expect(shader.uniforms.startWakeDirection?.value).toEqual(
    new Vector3(0, 0, -1),
  );
  expect(shader.uniforms.startWakeAge?.value).toBe(0.2);
  expect(shader.uniforms.startWakeStrength?.value).toBe(0.8);
  expect(shader.uniforms.startGoalPose?.value).toEqual(
    new Matrix4().makeTranslation(2, 3, -8),
  );
  effect.update(createFrame());
  expect(shader.uniforms.startWakeStrength?.value).toBe(0);
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
  for (const count of [0, 31, 1.5, 65_537, Infinity, Number.NaN]) {
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
      parameters: { ...PARAMETERS, cloudRadiusMeters: 0 },
    }),
  ).toThrow("cloudRadiusMeters");
});

test("object anchors share the formed geometry pose and disappear with their owner", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  expect(effect.readObjectAnchors()).toBeUndefined();
  effect.load();
  effect.setVisible(true);
  expect(effect.readObjectAnchors()).toBeUndefined();
  const frame = { ...createFrame(), formationProgress: 1 };
  effect.update(frame);
  const objects = effect.readObjectAnchors();
  expect(objects?.ringLeft.x).toBeCloseTo(0.14);
  expect(objects?.ringRight).toEqual(new Vector3(3.86, 3, -8));
  expect(objects?.arrow.x).toBeCloseTo(2);
  expect(objects?.arrow.y).toBe(3);

  // A differently oriented goal transforms all bodies with the same world pose.
  effect.update({
    ...frame,
    goalNormal: new Vector3(1, 0, 0),
    arrowAngleRadians: Math.PI / 2,
  });
  expect(effect.readObjectAnchors()).toBe(objects);
  expect(objects?.ringLeft.x).toBeCloseTo(2);
  expect(objects?.ringLeft.z).toBeCloseTo(-6.14);
  expect(objects?.ringRight.z).toBeCloseTo(-9.86);
  expect(objects?.arrow.x).toBeCloseTo(2);
  expect(objects?.arrow.y).toBeCloseTo(3);
  expect(objects?.arrow.z).toBeCloseTo(-4);
  effect.setVisible(false);
  expect(effect.readObjectAnchors()).toBeUndefined();
  effect.unload();
  effect.load();
  effect.setVisible(true);
  expect(effect.readObjectAnchors()).toBeUndefined();
  effect.unload();
});

test("body anchors gather with formation and follow finite crossing wake", () => {
  const effect = createStartParticleEffect({
    scene: new Scene(),
    parameters: PARAMETERS,
  });
  effect.load();
  effect.setVisible(true);
  const frame = createFrame();
  effect.update(frame);
  expect(effect.readObjectAnchors()?.arrow).toEqual(frame.arrowPosition);
  expect(effect.readObjectAnchors()?.ringLeft).toEqual(frame.goalPosition);
  effect.update({ ...frame, formationProgress: 0.5 });
  expect(effect.readObjectAnchors()?.ringLeft.x).toBeCloseTo(
    2 - 1.86 * ((1 - 5 * Math.exp(-4)) / (1 - 9 * Math.exp(-8))),
  );
  const wake = {
    position: frame.goalPosition,
    direction: new Vector3(0, 0, -1),
    strength: 1,
    ageSeconds: 1.2,
  };
  effect.update({ ...frame, wake });
  expect(effect.readObjectAnchors()?.ringLeft.z).toBeCloseTo(
    -8 - (1.5 * (1 - Math.exp(-1.2 * 1.8))) / 1.8,
  );
  effect.update({
    ...frame,
    wake: { ...wake, ageSeconds: 2.4 },
  });
  expect(effect.readObjectAnchors()?.ringLeft.z).toBeCloseTo(
    -8 - (1.5 * (1 - Math.exp(-2.4 * 1.8))) / 1.8,
  );
  effect.update({
    ...frame,
    wake: { ...wake, direction: new Vector3(0.6, 0, -0.8) },
  });
  const travel = (1 - Math.exp(-1.2 * 1.8)) / 1.8;
  expect(effect.readObjectAnchors()?.ringLeft.x).toBeCloseTo(
    2 + 0.6 * 1.5 * travel,
  );
  expect(effect.readObjectAnchors()?.ringLeft.z).toBeCloseTo(
    -8 - 0.8 * 1.5 * travel,
  );
  effect.unload();
});

test("filled clouds retain depth, a dense core and bounded haze within fixed capacity", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({
    scene,
    parameters: { ...PARAMETERS, count: 32_000 },
  });
  effect.load();
  const geometry = readPoints(scene).geometry;
  const targets = geometry.getAttribute("startTarget");
  const roles = geometry.getAttribute("startRole");
  const depth = geometry.getAttribute("startDepth");
  const haze = geometry.getAttribute("startHaze");
  let arrowInterior = 0;
  let thickRing = 0;
  let ringCore = 0;
  let hazeCount = 0;
  let bytes = 0;
  for (const attribute of Object.values(geometry.attributes)) {
    if (!(attribute instanceof BufferAttribute))
      throw new Error("Expected a fixed particle attribute");
    bytes += attribute.array.byteLength;
  }
  for (let index = 0; index < targets.count; index += 1) {
    if (
      roles.getX(index) === 1 &&
      Math.abs(targets.getZ(index)) > 0.03 &&
      Math.abs(targets.getY(index)) < 0.08
    )
      arrowInterior += 1;
    if (roles.getX(index) === 0) {
      const crossRadius = Math.hypot(targets.getZ(index), depth.getX(index));
      if (Math.abs(depth.getX(index)) > 0.25) thickRing += 1;
      if (crossRadius < 0.5) ringCore += 1;
      expect(crossRadius).toBeLessThanOrEqual(1.000001);
    }
    hazeCount += haze.getX(index);
  }
  expect(arrowInterior).toBeGreaterThan(1600);
  expect(thickRing).toBeGreaterThan(2000);
  expect(ringCore).toBeGreaterThan(5000);
  expect(hazeCount).toBeGreaterThan(3000);
  expect(hazeCount).toBeLessThan(4500);
  expect(bytes).toBe(32_000 * 44);
  effect.unload();
});

test("three preview poses are copied, culled conservatively and never upload particle arrays", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const points = readPoints(scene);
  const shader = compileMaterial(points.material);
  const positions = [
    new Vector3(0, 0, -30),
    new Vector3(15, 8, -50),
    new Vector3(30, 12, -65),
    new Vector3(999, 999, 999),
  ];
  const previews = positions.map((goalPosition) => ({
    goalPosition,
    goalNormal: new Vector3(0, 0, 1),
    goalUp: new Vector3(0, 1, 0),
    ringRadiusMeters: 4,
  }));
  const attributes = Object.values(points.geometry.attributes).map(
    (attribute) => {
      if (!(attribute instanceof BufferAttribute))
        throw new Error("Expected a fixed particle attribute");
      return attribute;
    },
  );
  const arrays = attributes.map((attribute) => attribute.array);
  for (let index = 0; index < 200; index += 1)
    effect.update({ ...createFrame(), previews, elapsedSeconds: index / 90 });
  expect(shader.uniforms.startPreviewCount?.value).toBe(3);
  const poses = shader.uniforms.startPreviewPoses?.value as Matrix4[];
  expect(poses).toHaveLength(3);
  expect(poses[1]).toEqual(new Matrix4().makeTranslation(15, 8, -50));
  expect(points.frustumCulled).toBe(true);
  for (const position of positions.slice(0, 3))
    expect(points.geometry.boundingSphere?.containsPoint(position)).toBe(true);
  expect(
    points.geometry.boundingSphere?.containsPoint(positions[3] as Vector3),
  ).toBe(false);
  positions[1]?.set(500, 500, 500);
  expect(poses[1]).toEqual(new Matrix4().makeTranslation(15, 8, -50));
  for (let index = 0; index < attributes.length; index += 1) {
    expect(attributes[index]?.array).toBe(arrays[index]);
    expect(attributes[index]?.version).toBe(0);
  }
  effect.update(createFrame());
  expect(shader.uniforms.startPreviewCount?.value).toBe(0);
  expect(shader.uniforms.startPreviewPoses?.value).toBe(poses);
  effect.unload();
});

test("immediate local expansion and drag transport keep sound anchored to the ring", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const frame = { ...createFrame(), formationProgress: 1, elapsedSeconds: 1 };
  const wake = {
    position: frame.goalPosition,
    direction: new Vector3(0, 0, -1),
    ageSeconds: 0.45,
    strength: 1,
  };
  effect.update({ ...frame, wake });
  expect(effect.readObjectAnchors()?.ringLeft.x).toBeCloseTo(
    2 - 1.5 * 1.24 * (1 + 0.065 * Math.exp(-0.45 * 2.5)),
  );
  expect(effect.readObjectAnchors()?.arrow.z).toBeCloseTo(
    -4 + Math.sin(0.35) * 0.12,
  );
  effect.update({ ...frame, wake: { ...wake, ageSeconds: 10 } });
  expect(effect.readObjectAnchors()?.ringLeft.x).toBeCloseTo(0.14);
  expect(effect.readObjectAnchors()?.ringLeft.z).toBeCloseTo(-8 - 1.5 / 1.8);
  effect.unload();
});

test("arrow pose and presence stay independent as tunnel rings form and cross", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const points = readPoints(scene);
  const shader = compileMaterial(points.material);
  const arrowNormal = new Vector3(0, 0, 1);
  const frame = {
    ...createFrame(),
    arrowNormal,
    arrowUp: new Vector3(0, 1, 0),
    arrowFormation: 1,
    arrowPresence: 1,
    ringPresence: 0,
  };
  effect.update(frame);
  const borrowedArrowPose = shader.uniforms.startArrowPose?.value;
  if (!(borrowedArrowPose instanceof Matrix4))
    throw new Error("Expected the captured arrow pose");
  const arrowPose = borrowedArrowPose.clone();
  expect(shader.uniforms.startRingPresence?.value).toBe(0);
  expect(shader.uniforms.startArrowPresence?.value).toBe(1);
  effect.update({
    ...frame,
    goalNormal: new Vector3(1, 0, 0),
    ringPresence: 1,
    arrowPresence: 0.5,
    previews: [
      {
        goalPosition: new Vector3(2, 0, -7),
        goalNormal: new Vector3(1, 0, 0),
        ringRadiusMeters: 2,
        crossingAgeSeconds: 0,
      },
    ],
  });
  expect(shader.uniforms.startArrowPose?.value).toEqual(arrowPose);
  const ages = shader.uniforms.startPreviewCrossingAges?.value as Float32Array;
  expect(ages[0]).toBe(0);
  expect(ages).toHaveLength(3);
  effect.update({
    ...frame,
    previews: [
      {
        goalPosition: new Vector3(2, 0, -7),
        goalNormal: new Vector3(1, 0, 0),
        ringRadiusMeters: 2,
      },
    ],
  });
  expect(ages[0]).toBe(-1);
  expect(shader.uniforms.startPreviewCrossingAges?.value).toBe(ages);
  effect.unload();
});

test("retiring arrows keep matching samples and independent fixed poses through recycling", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const points = readPoints(scene);
  const shader = compileMaterial(points.material);
  const attributes = Object.values(
    points.geometry.attributes,
  ) as BufferAttribute[];
  const roles = points.geometry.getAttribute("startRole");
  const currentIndex = Array.from(roles.array).indexOf(1);
  const retiringIndex = Array.from(roles.array).indexOf(5);
  for (const attribute of attributes) {
    if (attribute === roles) continue;
    const first = currentIndex * attribute.itemSize;
    const second = retiringIndex * attribute.itemSize;
    expect(
      Array.from(attribute.array.slice(first, first + attribute.itemSize)),
    ).toEqual(
      Array.from(attribute.array.slice(second, second + attribute.itemSize)),
    );
  }
  const retiredPosition = new Vector3(-20, 4, 3);
  const retired = {
    position: retiredPosition,
    normal: new Vector3(0, 0, 1),
    up: new Vector3(0, 1, 0),
    angleRadians: Math.PI / 2,
    formation: 1,
    presence: 1,
  };
  for (let cycle = 0; cycle < 50; cycle += 1) {
    effect.update({ ...createFrame(), arrowFormation: 1 });
    effect.update({
      ...createFrame(),
      retiringArrow: retired,
      arrowFormation: 0,
    });
    for (let step = 1; step <= 30; step += 1) {
      effect.update({
        ...createFrame(),
        arrowPosition: new Vector3(step, 3, -4),
        arrowFormation: step / 30,
        retiringArrow: {
          ...retired,
          formation: 1 - step / 30,
          presence: 1 - step / 30,
        },
      });
      expect(shader.uniforms.startRetiringArrowPose?.value).toEqual(
        new Matrix4().makeTranslation(-20, 4, 3),
      );
      if (step < 30)
        expect(
          points.geometry.boundingSphere?.containsPoint(retiredPosition),
        ).toBe(true);
    }
  }
  retiredPosition.set(999, 999, 999);
  expect(shader.uniforms.startRetiringArrowPose?.value).toEqual(
    new Matrix4().makeTranslation(-20, 4, 3),
  );
  effect.update(createFrame());
  expect(shader.uniforms.startRetiringArrowPresence?.value).toBe(0);
  expect(shader.uniforms.startArrowFormation?.value).toBe(0);
  for (const attribute of attributes) expect(attribute.version).toBe(0);
  expect(scene.children).toHaveLength(1);
  effect.unload();
});

test("preview orientation uses its transported up vector", () => {
  const scene = new Scene();
  const effect = createStartParticleEffect({ scene, parameters: PARAMETERS });
  effect.load();
  effect.setVisible(true);
  const shader = compileMaterial(readPoints(scene).material);
  effect.update({
    ...createFrame(),
    previews: [
      {
        goalPosition: new Vector3(),
        goalNormal: new Vector3(0, 0, 1),
        goalUp: new Vector3(1, 0, 0),
        ringRadiusMeters: 2,
      },
    ],
  });
  const poses = shader.uniforms.startPreviewPoses?.value as Matrix4[];
  expect(
    new Vector3(0, 1, 0)
      .transformDirection(poses[0] as Matrix4)
      .distanceTo(new Vector3(1, 0, 0)),
  ).toBeLessThan(1e-12);
  effect.unload();
});
