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
  Uniform,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { StartArrowFrame } from "./start-arrows";
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
import { START_SETTINGS } from "./start-settings";

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
  parameters,
  arrowLengthMeters,
}: {
  readonly scene: Scene;
  readonly parameters: StartParticleParameters;
  readonly arrowLengthMeters: number;
}): StartParticleEffect {
  return new ParticleEffect(
    scene,
    readStartParticleSettings(parameters, arrowLengthMeters),
  );
}

class ParticleEffect implements StartParticleEffect {
  private readonly rotation = new Quaternion();
  private readonly orientation = new Matrix4();
  private readonly bounds = new Box3();
  private readonly previewPoses = Array.from(
    { length: START_SETTINGS.previewCount },
    () => new Matrix4(),
  );
  private readonly previewRadii = new Float32Array(START_SETTINGS.previewCount);
  private readonly previewCrossingAges = new Float32Array(
    START_SETTINGS.previewCount,
  ).fill(-1);
  private readonly ringGather = createGatherUniforms();
  private readonly arrowGather = createGatherUniforms();
  private readonly retiringGather = createGatherUniforms();
  private readonly objects = {
    ringLeft: new Vector3(),
    ringRight: new Vector3(),
    arrow: new Vector3(),
  };
  private readonly ringAnchors = [
    this.objects.ringLeft,
    this.objects.ringRight,
  ];
  private points: Points<BufferGeometry, PointsMaterial> | undefined;
  private anchorsReady = false;
  private readonly uniforms = {
    startTime: new Uniform(0),
    startPreviewTime: new Uniform(0),
    startGoalPose: new Uniform(new Matrix4()),
    startRadius: new Uniform(1),
    startArrowPose: new Uniform(new Matrix4()),
    startRetiringArrowPose: new Uniform(new Matrix4()),
    startRetiringArrowFormation: this.retiringGather.formation,
    startRetiringArrowPresence: new Uniform(0),
    startRetiringArrowDissolving: this.retiringGather.dissolving,
    startRetiringArrowReleaseOrigin: this.retiringGather.releaseOrigin,
    startPreviewPoses: new Uniform(this.previewPoses),
    startPreviewRadii: new Uniform(this.previewRadii),
    startPreviewCrossingAges: new Uniform(this.previewCrossingAges),
    startPreviewCount: new Uniform(0),
    startFormation: this.ringGather.formation,
    startDissolving: this.ringGather.dissolving,
    startReleaseOrigin: this.ringGather.releaseOrigin,
    startArrowFormation: this.arrowGather.formation,
    startArrowDissolving: this.arrowGather.dissolving,
    startArrowReleaseOrigin: this.arrowGather.releaseOrigin,
    startArrowPresence: new Uniform(0),
    startRingPresence: new Uniform(0),
    startWakeDirection: new Uniform(new Vector3()),
    startWakeAge: new Uniform(-1),
  };

  constructor(
    private readonly scene: Scene,
    private readonly parameters: Required<StartParticleParameters>,
  ) {}

  readonly load = (): void => {
    if (this.points) return;
    const geometry = new BufferGeometry();
    let material: PointsMaterial | undefined;
    try {
      writeStartParticleAttributes(geometry, this.parameters);
      geometry.boundingSphere = new Sphere();
      material = new PointsMaterial();
      this.configureMaterial(material);
      this.points = new Points(geometry, material);
      this.points.name = "StartTrainingParticles";
      this.points.visible = false;
      // Bounds include shader displacement, every preview and the full arrow body.
      this.points.frustumCulled = true;
      this.scene.add(this.points);
    } catch (error) {
      if (this.points) this.scene.remove(this.points);
      this.points = undefined;
      geometry.dispose();
      material?.dispose();
      throw error;
    }
  };

  private configureMaterial(material: PointsMaterial): void {
    material.setValues({
      color: this.parameters.color,
      size: this.parameters.sizeMeters,
      sizeAttenuation: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    material.defines = {
      START_MAXIMUM_PREVIEWS: START_SETTINGS.previewCount,
      START_CROSSING_EXPANSION: SETTINGS.crossingExpansion,
      START_CROSSING_PULSE_DECAY: SETTINGS.crossingPulseDecay,
      START_WAKE_DRAG: SETTINGS.wakeDrag,
      START_WAKE_SPEED: SETTINGS.wakeSpeed,
      START_ARROW_DRIFT_SPEED: SETTINGS.arrowDriftSpeed,
      START_ARROW_DRIFT_AMPLITUDE: SETTINGS.arrowDriftAmplitude,
    };
    material.onBeforeCompile = (shader): void => this.patchShader(shader);
    material.customProgramCacheKey = () => "start-cloud-particles-v6";
  }

  private patchShader(shader: WebGLProgramParametersWithUniforms): void {
    validateShaderAnchors(shader.vertexShader, [
      "common",
      "begin_vertex",
      "logdepthbuf_vertex",
    ]);
    validateShaderAnchors(shader.fragmentShader, ["common", "color_fragment"]);
    Object.assign(
      shader.uniforms,
      this.uniforms,
      readAppearanceUniforms(this.parameters),
    );
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
      .replace("#include <common>", `#include <common>\n${appearanceShader}`)
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\napplyStartParticleAppearance(diffuseColor);",
      );
  }

  readonly setVisible = (visible: boolean): void => {
    if (this.points) this.points.visible = visible;
  };

  readonly readObjectAnchors = (): StartParticleObjects | undefined => {
    return this.points?.visible && this.anchorsReady ? this.objects : undefined;
  };

  readonly update = (frame: StartParticleFrame): void => {
    if (!this.points?.visible) return;
    const uniforms = this.uniforms;
    this.writePose(uniforms.startGoalPose.value, frame);
    this.writePose(uniforms.startArrowPose.value, frame.arrow);
    this.updateRetiringArrow(frame.retiringArrow);
    uniforms.startTime.value = frame.elapsedSeconds;
    uniforms.startPreviewTime.value = frame.previewElapsedSeconds;
    uniforms.startRadius.value = frame.ringRadiusMeters;
    updateGather(this.ringGather, frame.formationProgress);
    updateGather(this.arrowGather, frame.arrow.formation);
    uniforms.startArrowPresence.value = frame.arrow.presence;
    uniforms.startRingPresence.value = frame.ringPresence;
    uniforms.startWakeAge.value = frame.wake?.ageSeconds ?? -1;
    this.updateObjectAnchors(frame);
    this.updateBounds(frame);
    this.anchorsReady = Math.max(frame.arrow.presence, frame.ringPresence) > 0;
    if (frame.wake)
      uniforms.startWakeDirection.value.copy(frame.wake.direction);
  };

  private updateRetiringArrow(retiring: StartArrowFrame): void {
    const uniforms = this.uniforms;
    if (retiring.presence > 0) {
      const previousPose = uniforms.startRetiringArrowPose.value.elements;
      const replaced =
        uniforms.startRetiringArrowPresence.value === 0 ||
        previousPose[12] !== retiring.position.x ||
        previousPose[13] !== retiring.position.y ||
        previousPose[14] !== retiring.position.z;
      this.writePose(uniforms.startRetiringArrowPose.value, retiring);
      if (replaced) {
        this.retiringGather.formation.value = this.arrowGather.formation.value;
        this.retiringGather.dissolving.value =
          this.arrowGather.dissolving.value;
        this.retiringGather.releaseOrigin.value.set(
          this.arrowGather.releaseOrigin.value,
        );
      }
      updateGather(this.retiringGather, retiring.formation);
    }
    uniforms.startRetiringArrowPresence.value = retiring.presence;
  }

  private updateObjectAnchors(frame: StartParticleFrame): void {
    const wakeAge = Math.max(0, frame.wake?.ageSeconds ?? 0);
    const pulse = frame.wake
      ? Math.exp(-wakeAge * SETTINGS.crossingPulseDecay)
      : 0;
    const radius =
      frame.ringRadiusMeters *
      (1 + this.parameters.ringThicknessRatio) *
      (1 + SETTINGS.crossingExpansion * pulse);
    this.updateRingAnchors(frame, radius);
    this.updateArrowAnchor(frame);
  }

  private updateRingAnchors(frame: StartParticleFrame, radius: number): void {
    const { objects, uniforms, ringGather } = this;
    const formation = springGather(
      frame.formationProgress,
      ringGather.dissolving.value > 0,
      ringGather.releaseOrigin.value,
    );
    const wakeAge = Math.max(0, frame.wake?.ageSeconds ?? 0);
    const travel =
      (1 - Math.exp(-wakeAge * SETTINGS.wakeDrag)) / SETTINGS.wakeDrag;
    objects.ringLeft.set(-radius, 0, 0);
    objects.ringRight.set(radius, 0, 0);
    for (const anchor of this.ringAnchors) {
      anchor
        .multiplyScalar(formation)
        .applyMatrix4(uniforms.startGoalPose.value);
      if (frame.wake)
        anchor.addScaledVector(
          frame.wake.direction,
          SETTINGS.wakeSpeed * travel,
        );
    }
  }

  private updateArrowAnchor(frame: StartParticleFrame): void {
    // Preserve the existing sound-anchor easing until the separate presentation correction.
    const drift =
      Math.sin(frame.elapsedSeconds * SETTINGS.arrowDriftSpeed) *
      SETTINGS.arrowDriftAmplitude;
    this.objects.arrow
      .set(0, 0, drift * smoothstep(frame.arrow.formation))
      .applyMatrix4(this.uniforms.startArrowPose.value);
  }

  private updateBounds(frame: StartParticleFrame): void {
    const { bounds, parameters } = this;
    bounds
      .makeEmpty()
      .expandByPoint(frame.goalPosition)
      .expandByPoint(frame.arrow.position);
    if (frame.retiringArrow.presence > 0)
      bounds.expandByPoint(frame.retiringArrow.position);
    const largestRadius = this.updatePreviews(frame);
    bounds.expandByScalar(
      Math.max(
        parameters.cloudRadiusMeters,
        parameters.cloudDepthMeters,
        largestRadius *
          (1 + parameters.ringThicknessRatio * 2) *
          (1 + SETTINGS.crossingExpansion),
        parameters.arrowLengthMeters,
      ) +
        parameters.driftAmplitudeMeters * 3 +
        MAXIMUM_DISPERSAL_MARGIN_METERS +
        1,
    );
    const sphere = this.points?.geometry.boundingSphere;
    if (sphere) bounds.getBoundingSphere(sphere);
  }

  private updatePreviews(frame: StartParticleFrame): number {
    const count = Math.min(START_SETTINGS.previewCount, frame.previews.length);
    this.uniforms.startPreviewCount.value = count;
    let largestRadius = frame.ringRadiusMeters;
    for (let index = 0; index < count; index += 1) {
      const preview = frame.previews[index];
      const pose = this.previewPoses[index];
      if (!preview || !pose) continue;
      this.writePose(pose, preview);
      this.previewRadii[index] = preview.ringRadiusMeters;
      this.previewCrossingAges[index] = preview.crossingAgeSeconds ?? -1;
      largestRadius = Math.max(largestRadius, preview.ringRadiusMeters);
      this.bounds.expandByPoint(preview.goalPosition);
    }
    return largestRadius;
  }

  private writePose(
    pose: Matrix4,
    frame:
      | Pick<StartArrowFrame, "position" | "normal" | "up">
      | Pick<StartParticleFrame, "goalPosition" | "goalNormal" | "goalUp">,
  ): void {
    const position = "position" in frame ? frame.position : frame.goalPosition;
    const normal = "normal" in frame ? frame.normal : frame.goalNormal;
    const up = "up" in frame ? frame.up : frame.goalUp;
    this.rotation.setFromRotationMatrix(
      this.orientation.lookAt(normal, ORIGIN, up),
    );
    pose.compose(position, this.rotation, UNIT_SCALE);
  }

  readonly unload = (): void => {
    if (!this.points) return;
    const released = this.points;
    this.points = undefined;
    this.anchorsReady = false;
    for (const gather of [
      this.ringGather,
      this.arrowGather,
      this.retiringGather,
    ]) {
      gather.formation.value = 0;
      gather.dissolving.value = 0;
    }
    this.uniforms.startRetiringArrowPresence.value = 0;
    this.scene.remove(released);
    released.geometry.dispose();
    released.material.dispose();
  };
}

function validateShaderAnchors(
  source: string,
  anchors: readonly string[],
): void {
  for (const anchor of anchors) {
    if (!source.includes(`#include <${anchor}>`))
      throw new Error(`Start particle shader is missing ${anchor}`);
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
    formation: new Uniform(0),
    dissolving: new Uniform(0),
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

function readAppearanceUniforms(parameters: Required<StartParticleParameters>) {
  return {
    startArrowAccent: new Uniform(new Color(parameters.arrowAccentColor)),
    startCrossingAccent: new Uniform(new Color(parameters.crossingAccentColor)),
    startArrowScale: new Uniform(
      parameters.arrowLengthMeters / ARROW_SOURCE_WIDTH,
    ),
    startThickness: new Uniform(parameters.ringThicknessRatio),
    startMaximumPointSize: new Uniform(parameters.maximumPointSizePixels),
    startMaximumHazePointSize: new Uniform(
      parameters.maximumHazePointSizePixels,
    ),
    startDriftAmplitude: new Uniform(parameters.driftAmplitudeMeters),
    startDriftSpeed: new Uniform(parameters.driftSpeed),
    startSparkle: new Uniform(parameters.sparkle),
    startGlow: new Uniform(parameters.glow),
  };
}
