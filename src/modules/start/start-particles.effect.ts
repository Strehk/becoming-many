import {
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Points,
  PointsMaterial,
  Quaternion,
  type Scene,
  Vector3,
} from "three";
import appearanceShader from "./start-particles.frag.glsl?raw";
import motionShader from "./start-particles.vert.glsl?raw";

export interface StartParticleParameters {
  /** Fixed GPU capacity, shared by the ring and assistance arrow. */
  readonly count: number;
  readonly sizeMeters: number;
  readonly color: number;
  readonly cloudRadiusMeters: number;
  readonly cloudDepthMeters: number;
  readonly driftAmplitudeMeters: number;
  readonly driftSpeed: number;
  /** Restrained brightness and point-edge accents in [0, 1]; zero disables each. */
  readonly sparkle: number;
  readonly glow: number;
  readonly wakeRadiusMeters: number;
  readonly wakeDurationSeconds: number;
  readonly wakeDistanceMeters: number;
}

/** One crossing's world-space trajectory; direction is unit length, age is seconds. */
export interface StartParticleWake {
  readonly position: Readonly<Vector3>;
  readonly direction: Readonly<Vector3>;
  readonly strength: number;
  readonly ageSeconds: number;
}

/** Borrowed only during update; the effect copies inputs and never changes learning. */
export interface StartParticleFrame {
  readonly elapsedSeconds: number;
  readonly goalPosition: Readonly<Vector3>;
  /** Unit-length goal-plane normal. */
  readonly goalNormal: Readonly<Vector3>;
  readonly arrowPosition: Readonly<Vector3>;
  readonly arrowNormal: Readonly<Vector3>;
  readonly ringRadiusMeters: number;
  /** Counterclockwise in the arrow plane; zero points right. */
  readonly arrowAngleRadians: number;
  /** Zero is drifting cloud, one is the fully gathered shape. */
  readonly formationProgress: number;
  readonly completionProgress: number;
  readonly wake?: StartParticleWake;
}

export interface StartParticleEffect {
  readonly load: () => void;
  readonly setVisible: (visible: boolean) => void;
  /** Externally supplied time only; invisible/unloaded effects perform no work. */
  readonly update: (frame: StartParticleFrame) => void;
  readonly unload: () => void;
}

const RING_PARTICLE_FRACTION = 0.75;
const MINIMUM_PARTICLE_COUNT = 32;
const MAXIMUM_PARTICLE_COUNT = 16_384;
const RANDOM_RANGE = 0x1_0000_0000;
const LOCAL_NORMAL = new Vector3(0, 0, 1);
const LOCAL_ORIGIN = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);
const UNIT_SCALE = new Vector3(1, 1, 1);
const ARROW_OUTLINE = [
  [-0.55, -0.1],
  [0.12, -0.1],
  [0.12, -0.3],
  [0.55, 0],
  [0.12, 0.3],
  [0.12, 0.1],
  [-0.55, 0.1],
] as const;

/** Own one fixed Points draw; Start supplies its pose, transition and crossing facts. */
export function createStartParticleEffect({
  scene,
  parameters,
}: {
  readonly scene: Scene;
  readonly parameters: StartParticleParameters;
}): StartParticleEffect {
  validateParameters(parameters);
  const goalRotation = new Quaternion();
  const uniforms = {
    startTime: { value: 0 },
    startGoalPose: { value: new Matrix4() },
    startArrowPose: { value: new Matrix4() },
    startRadius: { value: 1 },
    startArrowAngle: { value: 0 },
    startFormation: { value: 0 },
    startCompletion: { value: 0 },
    startDriftAmplitude: { value: parameters.driftAmplitudeMeters },
    startDriftSpeed: { value: parameters.driftSpeed },
    startSparkle: { value: parameters.sparkle },
    startGlow: { value: parameters.glow },
    startWakePosition: { value: new Vector3() },
    startWakeDirection: { value: new Vector3() },
    startWakeStrength: { value: 0 },
    startWakeAge: { value: 0 },
    startWakeRadius: { value: parameters.wakeRadiusMeters },
    startWakeDuration: { value: parameters.wakeDurationSeconds },
    startWakeDistance: { value: parameters.wakeDistanceMeters },
  };
  let points: Points<BufferGeometry, PointsMaterial> | undefined;

  return {
    load,
    setVisible: (visible): void => {
      if (points) points.visible = visible;
    },
    update,
    unload,
  };

  function load(): void {
    if (points) return;
    const geometry = new BufferGeometry();
    let material: PointsMaterial | undefined;
    try {
      writeParticleAttributes(geometry, parameters);
      material = new PointsMaterial({
        color: parameters.color,
        size: parameters.sizeMeters,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      material.onBeforeCompile = (shader): void => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${motionShader}`)
          .replace(
            "#include <begin_vertex>",
            "vec3 transformed = animateStartParticle(position);",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            `#include <common>\n${appearanceShader}`,
          )
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\napplyStartParticleAppearance(diffuseColor);",
          );
      };
      material.customProgramCacheKey = () => "start-particles-v1";
      points = new Points(geometry, material);
      points.name = "StartTrainingParticles";
      points.visible = false;
      // The ring and heading arrow move independently in the shader. This small,
      // fixed draw avoids invalid CPU bounds without rebuilding buffers per eye.
      points.frustumCulled = false;
      scene.add(points);
    } catch (error) {
      if (points) scene.remove(points);
      points = undefined;
      geometry.dispose();
      material?.dispose();
      throw error;
    }
  }

  function update(frame: StartParticleFrame): void {
    if (!points?.visible) return;
    goalRotation.setFromUnitVectors(LOCAL_NORMAL, frame.goalNormal);
    uniforms.startGoalPose.value.compose(
      frame.goalPosition,
      goalRotation,
      UNIT_SCALE,
    );
    // The heading guide has no roll. Preserving world-up keeps its directional
    // angle readable after turning around, including the opposite hemisphere.
    uniforms.startArrowPose.value
      .lookAt(frame.arrowNormal, LOCAL_ORIGIN, WORLD_UP)
      .setPosition(frame.arrowPosition);
    uniforms.startTime.value = frame.elapsedSeconds;
    uniforms.startRadius.value = frame.ringRadiusMeters;
    uniforms.startArrowAngle.value = frame.arrowAngleRadians;
    uniforms.startFormation.value = frame.formationProgress;
    uniforms.startCompletion.value = frame.completionProgress;
    const wake = frame.wake;
    uniforms.startWakeStrength.value = wake?.strength ?? 0;
    if (!wake) return;
    uniforms.startWakePosition.value.copy(wake.position);
    uniforms.startWakeDirection.value.copy(wake.direction);
    uniforms.startWakeAge.value = wake.ageSeconds;
  }

  function unload(): void {
    if (!points) return;
    const releasedPoints = points;
    points = undefined;
    scene.remove(releasedPoints);
    releasedPoints.geometry.dispose();
    releasedPoints.material.dispose();
  }
}

function writeParticleAttributes(
  geometry: BufferGeometry,
  parameters: StartParticleParameters,
): void {
  const positions = new Float32Array(parameters.count * 3);
  const targets = new Float32Array(parameters.count * 3);
  const arrowParticles = new Float32Array(parameters.count);
  const phases = new Float32Array(parameters.count);
  const ringCount = Math.floor(parameters.count * RING_PARTICLE_FRACTION);
  for (let index = 0; index < parameters.count; index += 1) {
    const offset = index * 3;
    positions[offset] =
      (random(index, 0) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 1] =
      (random(index, 1) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 2] =
      (random(index, 2) * 2 - 1) * parameters.cloudDepthMeters;
    phases[index] = random(index, 3) * Math.PI * 2;
    if (index < ringCount) {
      const angle = (index / ringCount) * Math.PI * 2;
      const radius = 1 + (random(index, 4) - 0.5) * 0.07;
      targets[offset] = Math.cos(angle) * radius;
      targets[offset + 1] = Math.sin(angle) * radius;
    } else {
      arrowParticles[index] = 1;
      const segment =
        ((index - ringCount) / (parameters.count - ringCount)) *
        ARROW_OUTLINE.length;
      const segmentIndex = Math.floor(segment);
      const from = ARROW_OUTLINE[segmentIndex];
      const to = ARROW_OUTLINE[(segmentIndex + 1) % ARROW_OUTLINE.length];
      if (!from || !to) throw new Error("Start arrow segment is missing");
      const progress = segment - segmentIndex;
      targets[offset] = from[0] + (to[0] - from[0]) * progress;
      targets[offset + 1] = from[1] + (to[1] - from[1]) * progress;
    }
    targets[offset + 2] = (random(index, 5) - 0.5) * 0.035;
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("startTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute(
    "startArrowParticle",
    new BufferAttribute(arrowParticles, 1),
  );
  geometry.setAttribute("startPhase", new BufferAttribute(phases, 1));
}

function random(index: number, channel: number): number {
  let hash =
    Math.imul(index + 1, 83_492_791) ^ Math.imul(channel + 1, 1_103_515_245);
  hash = Math.imul(hash ^ (hash >>> 16), 2_246_822_519);
  hash = Math.imul(hash ^ (hash >>> 13), 3_266_489_917);
  return (hash >>> 0) / RANDOM_RANGE;
}

function validateParameters(parameters: StartParticleParameters): void {
  if (
    !Number.isInteger(parameters.count) ||
    parameters.count < MINIMUM_PARTICLE_COUNT ||
    parameters.count > MAXIMUM_PARTICLE_COUNT
  )
    throw new Error(
      `Start particle count must be an integer in [${MINIMUM_PARTICLE_COUNT}, ${MAXIMUM_PARTICLE_COUNT}]`,
    );
  for (const key of [
    "sizeMeters",
    "cloudRadiusMeters",
    "cloudDepthMeters",
    "wakeRadiusMeters",
    "wakeDurationSeconds",
  ] as const) {
    if (!Number.isFinite(parameters[key]) || parameters[key] <= 0)
      throw new Error(`Start particle ${key} must be positive and finite`);
  }
  for (const key of [
    "driftAmplitudeMeters",
    "driftSpeed",
    "wakeDistanceMeters",
  ] as const) {
    if (!Number.isFinite(parameters[key]) || parameters[key] < 0)
      throw new Error(`Start particle ${key} must be non-negative and finite`);
  }
  for (const key of ["sparkle", "glow"] as const) {
    if (
      !Number.isFinite(parameters[key]) ||
      parameters[key] < 0 ||
      parameters[key] > 1
    )
      throw new Error(`Start particle ${key} must be in [0, 1]`);
  }
}
