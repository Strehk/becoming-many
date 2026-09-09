import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Matrix4,
  Points,
  PointsMaterial,
  Quaternion,
  type Scene,
  Sphere,
  Vector3,
} from "three";
import appearanceShader from "./start-particles.frag.glsl?raw";
import motionShader from "./start-particles.vert.glsl?raw";

export interface StartParticleParameters {
  /** Fixed GPU capacity shared by the current ring, two arrow slots and three previews. */
  readonly count: number;
  readonly sizeMeters: number;
  readonly arrowLengthMeters?: number;
  readonly ringThicknessRatio?: number;
  readonly hazeFraction?: number;
  readonly maximumPointSizePixels?: number;
  readonly color: number;
  readonly arrowAccentColor?: number;
  readonly crossingAccentColor?: number;
  readonly cloudRadiusMeters: number;
  readonly cloudDepthMeters: number;
  readonly driftAmplitudeMeters: number;
  readonly driftSpeed: number;
  /** Restrained brightness and point-edge accents in [0, 1]; zero disables each. */
  readonly sparkle: number;
  readonly glow: number;
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
  /** Age of the current decorative section on the existing Show timebase. */
  readonly previewElapsedSeconds?: number;
  readonly goalPosition: Readonly<Vector3>;
  /** Captured eye-forward cue center, independent of the ring center. */
  readonly arrowPosition: Readonly<Vector3>;
  /** Unit-length goal-plane normal. */
  readonly goalNormal: Readonly<Vector3>;
  /** Captured eye up vector keeps direction arrows readable under head roll. */
  readonly goalUp: Readonly<Vector3>;
  readonly ringRadiusMeters: number;
  /** Counterclockwise in the arrow plane; zero points right. */
  readonly arrowAngleRadians: number;
  /** Zero is drifting cloud, one is the fully gathered shape. */
  readonly formationProgress: number;
  readonly sectionPresence?: number;
  readonly arrowPresence?: number;
  readonly arrowFormation?: number;
  readonly ringPresence?: number;
  readonly arrowNormal?: Readonly<Vector3>;
  readonly arrowUp?: Readonly<Vector3>;
  /** One previous cue may finish dissolving while the next cue forms. */
  readonly retiringArrow?: {
    readonly position: Readonly<Vector3>;
    readonly normal: Readonly<Vector3>;
    readonly up: Readonly<Vector3>;
    readonly angleRadians: number;
    readonly formation: number;
    readonly presence: number;
  };
  readonly wake?: StartParticleWake;
  /** Presentation-only guide rings; at most three are rendered. */
  readonly previews?: readonly StartParticlePreview[];
}

export interface StartParticlePreview {
  readonly goalUp?: Readonly<Vector3>;
  /** First swept passage, supplied by Start; undefined means not crossed. */
  readonly crossingAgeSeconds?: number;
  readonly goalPosition: Readonly<Vector3>;
  readonly goalNormal: Readonly<Vector3>;
  readonly ringRadiusMeters: number;
}

/** Borrowed world-space centers of the visible particle bodies, not listener offsets. */
export interface StartParticleObjects {
  readonly ringLeft: Readonly<Vector3>;
  readonly ringRight: Readonly<Vector3>;
  readonly arrow: Readonly<Vector3>;
}

export interface StartParticleEffect {
  readonly load: () => void;
  readonly setVisible: (visible: boolean) => void;
  /** Externally supplied time only; invisible/unloaded effects perform no work. */
  readonly update: (frame: StartParticleFrame) => void;
  readonly readObjectAnchors: () => StartParticleObjects | undefined;
  readonly unload: () => void;
}

const MINIMUM_PARTICLE_COUNT = 32;
const MAXIMUM_PARTICLE_COUNT = 65_536;
const MAXIMUM_PREVIEWS = 3;
const RANDOM_RANGE = 0x1_0000_0000;
const ORIGIN = new Vector3();
const UNIT_SCALE = new Vector3(1, 1, 1);
const ARROW_SOURCE_WIDTH = 1.1;
const CROSSING_EXPANSION = 0.065;
const MAXIMUM_DISPERSAL_MARGIN_METERS = 2.5;
const CROSSING_PULSE_DECAY = 2.5;

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
  const orientation = new Matrix4();
  const bounds = new Box3();
  const arrowLength = parameters.arrowLengthMeters ?? 7.2;
  const thickness = parameters.ringThicknessRatio ?? 0.24;
  const previewPoses = Array.from(
    { length: MAXIMUM_PREVIEWS },
    () => new Matrix4(),
  );
  const previewRadii = new Float32Array(MAXIMUM_PREVIEWS);
  const previewCrossingAges = new Float32Array(MAXIMUM_PREVIEWS).fill(-1);
  let previousFormation = 0;
  let previousArrowFormation = 0;
  let previousRetiringFormation = 0;
  const previewRotation = new Quaternion();
  const objects = {
    ringLeft: new Vector3(),
    ringRight: new Vector3(),
    arrow: new Vector3(),
  };
  let anchorsReady = false;
  const uniforms = {
    startTime: { value: 0 },
    startPreviewTime: { value: 0 },
    startGoalPose: { value: new Matrix4() },
    startRadius: { value: 1 },
    startArrowAngle: { value: 0 },
    startArrowPose: { value: new Matrix4() },
    startRetiringArrowPose: { value: new Matrix4() },
    startRetiringArrowAngle: { value: 0 },
    startRetiringArrowFormation: { value: 0 },
    startRetiringArrowPresence: { value: 0 },
    startRetiringArrowDissolving: { value: 0 },
    startRetiringArrowReleaseOrigin: { value: new Float32Array([1, 1]) },
    startArrowAccent: {
      value: new Color(parameters.arrowAccentColor ?? parameters.color),
    },
    startCrossingAccent: {
      value: new Color(parameters.crossingAccentColor ?? 0xdddddd),
    },
    startArrowScale: { value: arrowLength / ARROW_SOURCE_WIDTH },
    startThickness: { value: thickness },
    startPreviewPoses: { value: previewPoses },
    startPreviewRadii: { value: previewRadii },
    startPreviewCrossingAges: { value: previewCrossingAges },
    startPreviewCount: { value: 0 },
    startMaximumPointSize: { value: parameters.maximumPointSizePixels ?? 24 },
    startFormation: { value: 0 },
    startDissolving: { value: 0 },
    startReleaseOrigin: { value: new Float32Array([1, 1]) },
    startArrowFormation: { value: 0 },
    startArrowDissolving: { value: 0 },
    startArrowReleaseOrigin: { value: new Float32Array([1, 1]) },
    startArrowPresence: { value: 0 },
    startRingPresence: { value: 0 },
    startDriftAmplitude: { value: parameters.driftAmplitudeMeters },
    startDriftSpeed: { value: parameters.driftSpeed },
    startSparkle: { value: parameters.sparkle },
    startGlow: { value: parameters.glow },
    startWakeDirection: { value: new Vector3() },
    startWakeStrength: { value: 0 },
    startWakeAge: { value: 0 },
  };
  let points: Points<BufferGeometry, PointsMaterial> | undefined;

  return {
    load,
    setVisible: (visible): void => {
      if (points) points.visible = visible;
    },
    update,
    readObjectAnchors: () =>
      points?.visible && anchorsReady ? objects : undefined,
    unload,
  };

  function load(): void {
    if (points) return;
    const geometry = new BufferGeometry();
    let material: PointsMaterial | undefined;
    try {
      writeParticleAttributes(geometry, parameters);
      geometry.boundingSphere = new Sphere();
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
          )
          .replace(
            "#include <logdepthbuf_vertex>",
            "gl_PointSize = min(gl_PointSize * startParticleSize, startMaximumPointSize);\nstartDistanceFade = smoothstep(0.5, 2.5, -mvPosition.z);\n#include <logdepthbuf_vertex>",
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
      material.customProgramCacheKey = () => "start-cloud-particles-v4";
      points = new Points(geometry, material);
      points.name = "StartTrainingParticles";
      points.visible = false;
      // Bounds include shader displacement, every preview and the full arrow body.
      points.frustumCulled = true;
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
    goalRotation.setFromRotationMatrix(
      orientation.lookAt(frame.goalNormal, ORIGIN, frame.goalUp),
    );
    uniforms.startGoalPose.value.compose(
      frame.goalPosition,
      goalRotation,
      UNIT_SCALE,
    );
    uniforms.startTime.value = frame.elapsedSeconds;
    uniforms.startPreviewTime.value =
      frame.previewElapsedSeconds ?? frame.elapsedSeconds;
    uniforms.startRadius.value = frame.ringRadiusMeters;
    uniforms.startArrowAngle.value = frame.arrowAngleRadians;
    goalRotation.setFromRotationMatrix(
      orientation.lookAt(
        frame.arrowNormal ?? frame.goalNormal,
        ORIGIN,
        frame.arrowUp ?? frame.goalUp,
      ),
    );
    uniforms.startArrowPose.value.compose(
      frame.arrowPosition,
      goalRotation,
      UNIT_SCALE,
    );
    const retiring = frame.retiringArrow;
    if (retiring) {
      const previousPose = uniforms.startRetiringArrowPose.value.elements;
      const replaced =
        uniforms.startRetiringArrowPresence.value === 0 ||
        previousPose[12] !== retiring.position.x ||
        previousPose[13] !== retiring.position.y ||
        previousPose[14] !== retiring.position.z;
      goalRotation.setFromRotationMatrix(
        orientation.lookAt(retiring.normal, ORIGIN, retiring.up),
      );
      uniforms.startRetiringArrowPose.value.compose(
        retiring.position,
        goalRotation,
        UNIT_SCALE,
      );
      uniforms.startRetiringArrowAngle.value = retiring.angleRadians;
      if (replaced) {
        uniforms.startRetiringArrowDissolving.value =
          uniforms.startArrowDissolving.value;
        uniforms.startRetiringArrowReleaseOrigin.value.set(
          uniforms.startArrowReleaseOrigin.value,
        );
        previousRetiringFormation = previousArrowFormation;
      }
      if (
        retiring.formation < previousRetiringFormation &&
        !uniforms.startRetiringArrowDissolving.value
      ) {
        uniforms.startRetiringArrowReleaseOrigin.value[0] =
          previousRetiringFormation;
        uniforms.startRetiringArrowReleaseOrigin.value[1] = springGather(
          previousRetiringFormation,
          false,
        );
        uniforms.startRetiringArrowDissolving.value = 1;
      }
      previousRetiringFormation = retiring.formation;
      uniforms.startRetiringArrowFormation.value = retiring.formation;
    }
    uniforms.startRetiringArrowPresence.value = retiring?.presence ?? 0;
    const arrowFormation = frame.arrowFormation ?? frame.formationProgress;
    if (
      frame.formationProgress < previousFormation &&
      !uniforms.startDissolving.value
    ) {
      uniforms.startReleaseOrigin.value[0] = previousFormation;
      uniforms.startReleaseOrigin.value[1] = springGather(
        previousFormation,
        false,
      );
    }
    if (
      arrowFormation < previousArrowFormation &&
      !uniforms.startArrowDissolving.value
    ) {
      uniforms.startArrowReleaseOrigin.value[0] = previousArrowFormation;
      uniforms.startArrowReleaseOrigin.value[1] = springGather(
        previousArrowFormation,
        false,
      );
    }
    if (frame.formationProgress !== previousFormation)
      uniforms.startDissolving.value = Number(
        frame.formationProgress < previousFormation,
      );
    if (arrowFormation !== previousArrowFormation)
      uniforms.startArrowDissolving.value = Number(
        arrowFormation < previousArrowFormation,
      );
    previousFormation = frame.formationProgress;
    previousArrowFormation = arrowFormation;
    uniforms.startFormation.value = frame.formationProgress;
    uniforms.startArrowFormation.value = arrowFormation;
    uniforms.startArrowPresence.value =
      frame.arrowPresence ?? frame.sectionPresence ?? 1;
    uniforms.startRingPresence.value =
      frame.ringPresence ?? frame.sectionPresence ?? 1;
    const wake = frame.wake;
    uniforms.startWakeStrength.value = wake?.strength ?? 0;
    const pulse = wake
      ? Math.exp(-Math.max(0, wake.ageSeconds) * CROSSING_PULSE_DECAY) *
        wake.strength
      : 0;
    const expandedRadius =
      frame.ringRadiusMeters *
      (1 + thickness) *
      (1 + CROSSING_EXPANSION * pulse);
    objects.ringLeft.set(-expandedRadius, 0, 0);
    objects.ringRight.set(expandedRadius, 0, 0);
    objects.arrow
      .set(
        0,
        0,
        Math.sin(frame.elapsedSeconds * 0.35) *
          0.12 *
          smoothstep(arrowFormation),
      )
      .applyMatrix4(uniforms.startArrowPose.value);
    updateObjectAnchor(objects.ringLeft, frame);
    updateObjectAnchor(objects.ringRight, frame);
    const previewCount = Math.min(
      MAXIMUM_PREVIEWS,
      frame.previews?.length ?? 0,
    );
    uniforms.startPreviewCount.value = previewCount;
    bounds
      .makeEmpty()
      .expandByPoint(frame.goalPosition)
      .expandByPoint(frame.arrowPosition);
    if (retiring && retiring.presence > 0)
      bounds.expandByPoint(retiring.position);
    let largestRadius = frame.ringRadiusMeters;
    for (let index = 0; index < previewCount; index += 1) {
      const preview = frame.previews?.[index];
      const pose = previewPoses[index];
      if (!preview || !pose) continue;
      previewRotation.setFromRotationMatrix(
        orientation.lookAt(
          preview.goalNormal,
          ORIGIN,
          preview.goalUp ?? frame.goalUp,
        ),
      );
      pose.compose(preview.goalPosition, previewRotation, UNIT_SCALE);
      previewRadii[index] = preview.ringRadiusMeters;
      previewCrossingAges[index] = preview.crossingAgeSeconds ?? -1;
      largestRadius = Math.max(largestRadius, preview.ringRadiusMeters);
      bounds.expandByPoint(preview.goalPosition);
    }
    bounds.expandByScalar(
      Math.max(
        parameters.cloudRadiusMeters,
        parameters.cloudDepthMeters,
        largestRadius * (1 + thickness * 2) * (1 + CROSSING_EXPANSION),
        arrowLength,
      ) +
        parameters.driftAmplitudeMeters * 3 +
        MAXIMUM_DISPERSAL_MARGIN_METERS +
        1,
    );
    if (points.geometry.boundingSphere)
      bounds.getBoundingSphere(points.geometry.boundingSphere);
    anchorsReady =
      Math.max(
        uniforms.startArrowPresence.value,
        uniforms.startRingPresence.value,
      ) > 0;
    if (!wake) return;
    uniforms.startWakeDirection.value.copy(wake.direction);
    uniforms.startWakeAge.value = wake.ageSeconds;
  }

  function updateObjectAnchor(
    anchor: Vector3,
    frame: StartParticleFrame,
  ): void {
    const formation = springGather(
      frame.formationProgress,
      uniforms.startDissolving.value > 0,
      uniforms.startReleaseOrigin.value,
    );
    anchor.multiplyScalar(formation).applyMatrix4(uniforms.startGoalPose.value);
    const wake = frame.wake;
    if (!wake) return;
    const travel = (1 - Math.exp(-Math.max(0, wake.ageSeconds) * 1.8)) / 1.8;
    anchor.addScaledVector(wake.direction, 1.5 * travel);
  }

  function unload(): void {
    if (!points) return;
    const releasedPoints = points;
    points = undefined;
    anchorsReady = false;
    previousFormation = 0;
    previousArrowFormation = 0;
    previousRetiringFormation = 0;
    uniforms.startRetiringArrowPresence.value = 0;
    scene.remove(releasedPoints);
    releasedPoints.geometry.dispose();
    releasedPoints.material.dispose();
  }
}

function springGather(
  progress: number,
  dissolving: boolean,
  releaseOrigin?: Float32Array,
): number {
  const originProgress = releaseOrigin?.[0] ?? 1;
  const originFormation = releaseOrigin?.[1] ?? 1;
  const age = Math.min(
    1,
    Math.max(
      0,
      dissolving ? 1 - progress / Math.max(0.0001, originProgress) : progress,
    ),
  );
  const response =
    (1 - (1 + 8 * age) * Math.exp(-8 * age)) / (1 - 9 * Math.exp(-8));
  return dissolving ? originFormation * (1 - response) : response;
}

function smoothstep(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

function writeParticleAttributes(
  geometry: BufferGeometry,
  parameters: StartParticleParameters,
): void {
  const positions = new Float32Array(parameters.count * 3);
  const targets = new Float32Array(parameters.count * 3);
  const roles = new Float32Array(parameters.count);
  const phases = new Float32Array(parameters.count);
  const sizes = new Float32Array(parameters.count);
  const haze = new Float32Array(parameters.count);
  const depths = new Float32Array(parameters.count);
  const ringCount = Math.floor(parameters.count * 0.3);
  const arrowCount = Math.floor(parameters.count * 0.2);
  const arrowEnd = ringCount + arrowCount * 2;
  const previewCapacity = parameters.count - arrowEnd;
  for (let index = 0; index < parameters.count; index += 1) {
    const offset = index * 3;
    // Matching samples make transfer into the retiring slot visually continuous.
    const seed =
      index >= ringCount + arrowCount && index < arrowEnd
        ? index - arrowCount
        : index;
    positions[offset] =
      (random(seed, 0) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 1] =
      (random(seed, 1) * 2 - 1) * parameters.cloudRadiusMeters;
    positions[offset + 2] =
      (random(seed, 2) * 2 - 1) * parameters.cloudDepthMeters;
    phases[index] = random(seed, 3) * Math.PI * 2;
    const isHaze = random(seed, 8) < (parameters.hazeFraction ?? 0.12);
    haze[index] = isHaze ? 1 : 0;
    sizes[index] = isHaze
      ? 5 + random(seed, 9) * 4
      : 0.45 + random(seed, 9) * 1.15;
    if (index >= ringCount && index < arrowEnd) {
      roles[index] = index < ringCount + arrowCount ? 1 : 5;
      // Sample a filled shaft or triangular head, including an elliptical depth.
      const head = random(seed, 4) > 0.55;
      const x = head
        ? 0.05 + (1 - Math.sqrt(random(seed, 5))) * 0.5
        : -0.55 + random(seed, 5) * 0.65;
      const width = head ? (0.55 - x) * 0.72 : 0.11;
      const angle = random(seed, 6) * Math.PI * 2;
      const radial = Math.sqrt(random(seed, 7));
      targets[offset] = x;
      targets[offset + 1] = Math.cos(angle) * radial * width;
      targets[offset + 2] = Math.sin(angle) * radial * 0.13;
    } else {
      roles[index] =
        index < ringCount
          ? 0
          : 2 +
            Math.min(2, Math.floor(((index - arrowEnd) / previewCapacity) * 3));
      const angle = random(seed, 4) * Math.PI * 2;
      const crossAngle = random(seed, 5) * Math.PI * 2;
      // A dense core with a sparse shell; low frequency lobes soften the torus.
      const radial = random(seed, 6) ** (isHaze ? 0.45 : 0.85);
      const lobe = 0.82 + 0.18 * Math.sin(angle * 5 + Math.sin(angle * 3));
      const crossRadius = radial * lobe;
      targets[offset] = Math.cos(angle);
      targets[offset + 1] = Math.sin(angle);
      targets[offset + 2] = Math.cos(crossAngle) * crossRadius;
      depths[index] = Math.sin(crossAngle) * crossRadius;
    }
  }
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("startTarget", new BufferAttribute(targets, 3));
  geometry.setAttribute("startRole", new BufferAttribute(roles, 1));
  geometry.setAttribute("startPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("startParticleSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("startHaze", new BufferAttribute(haze, 1));
  geometry.setAttribute("startDepth", new BufferAttribute(depths, 1));
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
  for (const [key, defaultValue, maximum] of [
    ["arrowLengthMeters", 7.2, 16],
    ["ringThicknessRatio", 0.24, 0.6],
    ["maximumPointSizePixels", 24, 48],
  ] as const) {
    const value = parameters[key] ?? defaultValue;
    if (!Number.isFinite(value) || value <= 0 || value > maximum)
      throw new Error(
        `Start particle ${key} must be positive and at most ${maximum}`,
      );
  }
  const hazeFraction = parameters.hazeFraction ?? 0.12;
  if (!Number.isFinite(hazeFraction) || hazeFraction < 0 || hazeFraction > 0.25)
    throw new Error("Start particle hazeFraction must be in [0, 0.25]");
  for (const key of [
    "sizeMeters",
    "cloudRadiusMeters",
    "cloudDepthMeters",
  ] as const) {
    if (!Number.isFinite(parameters[key]) || parameters[key] <= 0)
      throw new Error(`Start particle ${key} must be positive and finite`);
  }
  for (const key of ["driftAmplitudeMeters", "driftSpeed"] as const) {
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
