import {
  Box3,
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
import type {
  StartParticleFrame,
  StartParticleObjects,
} from "./start-particle-frame";
import { writeStartParticleAttributes } from "./start-particle-geometry";
import {
  readStartParticleSettings,
  START_PARTICLE_SETTINGS as SETTINGS,
  type StartParticleParameters,
} from "./start-particle-settings";
import appearanceShader from "./start-particles.frag.glsl?raw";
import motionShader from "./start-particles.vert.glsl?raw";

export interface StartParticleEffect {
  readonly load: () => void;
  readonly setVisible: (visible: boolean) => void;
  /** Externally supplied time only; invisible/unloaded effects perform no work. */
  readonly update: (frame: StartParticleFrame) => void;
  /** Borrowed until the next update; callers must neither mutate nor retain vectors. */
  readonly readObjectAnchors: () => StartParticleObjects | undefined;
  readonly unload: () => void;
}

const ORIGIN = new Vector3();
const UNIT_SCALE = new Vector3(1, 1, 1);
const ARROW_SOURCE_WIDTH = 1.1;
const MAXIMUM_DISPERSAL_MARGIN_METERS = 2.5;

/** Own one fixed Points draw; Start supplies its pose, transition and crossing facts. */
export function createStartParticleEffect({
  scene,
  parameters: authoredParameters,
}: {
  readonly scene: Scene;
  readonly parameters: StartParticleParameters;
}): StartParticleEffect {
  const parameters = readStartParticleSettings(authoredParameters);
  const goalRotation = new Quaternion();
  const orientation = new Matrix4();
  const bounds = new Box3();
  const arrowLength = parameters.arrowLengthMeters;
  const thickness = parameters.ringThicknessRatio;
  const previewPoses = Array.from(
    { length: SETTINGS.previewCount },
    () => new Matrix4(),
  );
  const previewRadii = new Float32Array(SETTINGS.previewCount);
  const previewCrossingAges = new Float32Array(SETTINGS.previewCount).fill(-1);
  const ringGather = createGatherUniforms();
  const arrowGather = createGatherUniforms();
  const retiringGather = createGatherUniforms();
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
    startArrowPose: { value: new Matrix4() },
    startRetiringArrowPose: { value: new Matrix4() },
    startRetiringArrowFormation: retiringGather.formation,
    startRetiringArrowPresence: { value: 0 },
    startRetiringArrowDissolving: retiringGather.dissolving,
    startRetiringArrowReleaseOrigin: retiringGather.releaseOrigin,
    startArrowAccent: {
      value: new Color(parameters.arrowAccentColor),
    },
    startCrossingAccent: {
      value: new Color(parameters.crossingAccentColor),
    },
    startArrowScale: { value: arrowLength / ARROW_SOURCE_WIDTH },
    startThickness: { value: thickness },
    startPreviewPoses: { value: previewPoses },
    startPreviewRadii: { value: previewRadii },
    startPreviewCrossingAges: { value: previewCrossingAges },
    startPreviewCount: { value: 0 },
    startMaximumPointSize: { value: parameters.maximumPointSizePixels },
    startMaximumHazePointSize: {
      value: parameters.maximumHazePointSizePixels,
    },
    startFormation: ringGather.formation,
    startDissolving: ringGather.dissolving,
    startReleaseOrigin: ringGather.releaseOrigin,
    startArrowFormation: arrowGather.formation,
    startArrowDissolving: arrowGather.dissolving,
    startArrowReleaseOrigin: arrowGather.releaseOrigin,
    startArrowPresence: { value: 0 },
    startRingPresence: { value: 0 },
    startDriftAmplitude: { value: parameters.driftAmplitudeMeters },
    startDriftSpeed: { value: parameters.driftSpeed },
    startSparkle: { value: parameters.sparkle },
    startGlow: { value: parameters.glow },
    startWakeDirection: { value: new Vector3() },
    startWakeAge: { value: -1 },
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
      writeStartParticleAttributes(geometry, parameters);
      geometry.boundingSphere = new Sphere();
      material = new PointsMaterial({
        color: parameters.color,
        size: parameters.sizeMeters,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      material.defines = {
        START_MAXIMUM_PREVIEWS: SETTINGS.previewCount,
        START_CROSSING_EXPANSION: SETTINGS.crossingExpansion,
        START_CROSSING_PULSE_DECAY: SETTINGS.crossingPulseDecay,
        START_WAKE_DRAG: SETTINGS.wakeDrag,
        START_WAKE_SPEED: SETTINGS.wakeSpeed,
        START_ARROW_DRIFT_SPEED: SETTINGS.arrowDriftSpeed,
        START_ARROW_DRIFT_AMPLITUDE: SETTINGS.arrowDriftAmplitude,
      };
      material.onBeforeCompile = (shader): void => {
        for (const [source, anchors] of [
          [
            shader.vertexShader,
            ["common", "begin_vertex", "logdepthbuf_vertex"],
          ],
          [shader.fragmentShader, ["common", "color_fragment"]],
        ] as const) {
          for (const anchor of anchors)
            if (!source.includes(`#include <${anchor}>`))
              throw new Error(`Start particle shader is missing ${anchor}`);
        }
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", `#include <common>\n${motionShader}`)
          .replace(
            "#include <begin_vertex>",
            "vec3 transformed = animateStartParticle(position);",
          )
          .replace(
            "#include <logdepthbuf_vertex>",
            "gl_PointSize = min(gl_PointSize * startParticleSize, mix(startMaximumPointSize, startMaximumHazePointSize, startHaze));\nstartDistanceFade = smoothstep(0.5, 2.5, -mvPosition.z);\n#include <logdepthbuf_vertex>",
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
      material.customProgramCacheKey = () => "start-cloud-particles-v6";
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
    writePose(
      uniforms.startGoalPose.value,
      frame.goalPosition,
      frame.goalNormal,
      frame.goalUp,
    );
    uniforms.startTime.value = frame.elapsedSeconds;
    uniforms.startPreviewTime.value = frame.previewElapsedSeconds;
    uniforms.startRadius.value = frame.ringRadiusMeters;
    writePose(
      uniforms.startArrowPose.value,
      frame.arrow.position,
      frame.arrow.normal,
      frame.arrow.up,
    );
    const retiring = frame.retiringArrow;
    if (retiring.presence > 0) {
      const previousPose = uniforms.startRetiringArrowPose.value.elements;
      const replaced =
        uniforms.startRetiringArrowPresence.value === 0 ||
        previousPose[12] !== retiring.position.x ||
        previousPose[13] !== retiring.position.y ||
        previousPose[14] !== retiring.position.z;
      writePose(
        uniforms.startRetiringArrowPose.value,
        retiring.position,
        retiring.normal,
        retiring.up,
      );
      if (replaced) {
        retiringGather.formation.value = arrowGather.formation.value;
        retiringGather.dissolving.value = arrowGather.dissolving.value;
        retiringGather.releaseOrigin.value.set(arrowGather.releaseOrigin.value);
      }
      updateGather(retiringGather, retiring.formation);
    }
    uniforms.startRetiringArrowPresence.value = retiring.presence;
    updateGather(ringGather, frame.formationProgress);
    updateGather(arrowGather, frame.arrow.formation);
    uniforms.startArrowPresence.value = frame.arrow.presence;
    uniforms.startRingPresence.value = frame.ringPresence;
    const wake = frame.wake;
    uniforms.startWakeAge.value = wake?.ageSeconds ?? -1;
    const pulse = wake
      ? Math.exp(-Math.max(0, wake.ageSeconds) * SETTINGS.crossingPulseDecay)
      : 0;
    const expandedRadius =
      frame.ringRadiusMeters *
      (1 + thickness) *
      (1 + SETTINGS.crossingExpansion * pulse);
    objects.ringLeft.set(-expandedRadius, 0, 0);
    objects.ringRight.set(expandedRadius, 0, 0);
    objects.arrow
      .set(
        0,
        0,
        Math.sin(frame.elapsedSeconds * SETTINGS.arrowDriftSpeed) *
          SETTINGS.arrowDriftAmplitude *
          smoothstep(frame.arrow.formation),
      )
      .applyMatrix4(uniforms.startArrowPose.value);
    updateObjectAnchor(objects.ringLeft, frame);
    updateObjectAnchor(objects.ringRight, frame);
    const previewCount = Math.min(SETTINGS.previewCount, frame.previews.length);
    uniforms.startPreviewCount.value = previewCount;
    bounds
      .makeEmpty()
      .expandByPoint(frame.goalPosition)
      .expandByPoint(frame.arrow.position);
    if (retiring.presence > 0) bounds.expandByPoint(retiring.position);
    let largestRadius = frame.ringRadiusMeters;
    for (let index = 0; index < previewCount; index += 1) {
      const preview = frame.previews[index];
      const pose = previewPoses[index];
      if (!preview || !pose) continue;
      writePose(pose, preview.goalPosition, preview.goalNormal, preview.goalUp);
      previewRadii[index] = preview.ringRadiusMeters;
      previewCrossingAges[index] = preview.crossingAgeSeconds ?? -1;
      largestRadius = Math.max(largestRadius, preview.ringRadiusMeters);
      bounds.expandByPoint(preview.goalPosition);
    }
    bounds.expandByScalar(
      Math.max(
        parameters.cloudRadiusMeters,
        parameters.cloudDepthMeters,
        largestRadius * (1 + thickness * 2) * (1 + SETTINGS.crossingExpansion),
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
  }

  function writePose(
    pose: Matrix4,
    position: Readonly<Vector3>,
    normal: Readonly<Vector3>,
    up: Readonly<Vector3>,
  ): void {
    goalRotation.setFromRotationMatrix(orientation.lookAt(normal, ORIGIN, up));
    pose.compose(position, goalRotation, UNIT_SCALE);
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
    const travel =
      (1 - Math.exp(-Math.max(0, wake.ageSeconds) * SETTINGS.wakeDrag)) /
      SETTINGS.wakeDrag;
    anchor.addScaledVector(wake.direction, SETTINGS.wakeSpeed * travel);
  }

  function unload(): void {
    if (!points) return;
    const releasedPoints = points;
    points = undefined;
    anchorsReady = false;
    for (const gather of [ringGather, arrowGather, retiringGather]) {
      gather.formation.value = 0;
      gather.dissolving.value = 0;
    }
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

function createGatherUniforms() {
  return {
    formation: { value: 0 },
    dissolving: { value: 0 },
    releaseOrigin: { value: new Float32Array([1, 1]) },
  };
}

/** Capture the spring displacement once when gathering changes to release. */
function updateGather(
  gather: ReturnType<typeof createGatherUniforms>,
  progress: number,
): void {
  const previous = gather.formation.value;
  if (progress === previous) return;
  const dissolving = progress < previous;
  if (dissolving && !gather.dissolving.value) {
    gather.releaseOrigin.value[0] = previous;
    gather.releaseOrigin.value[1] = springGather(previous, false);
  }
  gather.dissolving.value = Number(dissolving);
  gather.formation.value = progress;
}
