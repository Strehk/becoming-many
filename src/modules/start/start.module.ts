import {
  Group,
  Mesh,
  MeshBasicMaterial,
  type Scene,
  Shape,
  ShapeGeometry,
} from "three";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import { createHeadingPanelPose } from "../heading-panel-pose";

export interface StartParameters {
  /** Distance of the guide from the eye along the assisted view axis, in metres. */
  readonly guideDistanceMeters: number;
}

/** Validated control intention in [-1, 1]; positive means right or climbing. */
export interface StartInput {
  readonly turnRight: number;
  readonly climb: number;
}

export type StartPhase =
  | "arrival"
  | "right"
  | "left"
  | "up"
  | "down"
  | "complete";

export interface StartModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly viewerRig: Group;
  readonly viewPitchDegrees: number;
  readonly parameters: StartParameters;
}

export interface StartModuleHandle {
  readonly module: WorldModule;
  /** Copies this frame's intention; undefined interrupts any held direction. */
  readonly setInput: (input: StartInput | undefined) => void;
  /** Completion stays stable until the loaded lifetime ends. */
  readonly readPhase: () => StartPhase;
}

const NEUTRAL_THRESHOLD = 0.15;
const DIRECTION_THRESHOLD = 0.45;
const CONFIRMATION_SECONDS = 0.5;
// A delayed frame must not count as a held gesture the visitor never performed.
const MAXIMUM_FRAME_SECONDS = 0.1;
const GUIDE_COLOR = 0x425563;
const CONFIRMED_COLOR = 0x28745f;
const GUIDE_WIDTH_METERS = 0.8;
const FEEDBACK_SCALE_GROWTH = 0.2;

interface StartResources {
  readonly anchor: Group;
  readonly guide: Mesh<ShapeGeometry, MeshBasicMaterial>;
}

/** Own one opaque guide and its local learning sequence within the World loop. */
export function createStartModule(
  options: StartModuleOptions,
): StartModuleHandle {
  const { guideDistanceMeters } = options.parameters;
  if (!Number.isFinite(guideDistanceMeters) || guideDistanceMeters <= 0)
    throw new Error(
      "Start guideDistanceMeters must be a positive finite number",
    );

  const pose = createHeadingPanelPose({
    distanceMeters: guideDistanceMeters,
    viewPitchDegrees: options.viewPitchDegrees,
  });
  let resources: StartResources | undefined;
  let phase: StartPhase = "arrival";
  let armed = false;
  let heldSeconds = 0;
  let turnRight: number | undefined;
  let climb = 0;

  return {
    setInput: (input): void => {
      turnRight = input?.turnRight;
      climb = input?.climb ?? 0;
      if (input) return;

      armed = false;
      heldSeconds = 0;
    },
    readPhase: () => phase,
    module: {
      load,
      activate: (): void => {
        if (resources) resources.anchor.visible = true;
      },
      update: (deltaSeconds): void => {
        if (!resources?.anchor.visible) return;

        if (phase !== "complete") {
          advancePhase(
            Math.min(Math.max(deltaSeconds, 0), MAXIMUM_FRAME_SECONDS),
          );
          updateGuideAppearance();
        }
        placeGuide();
      },
      deactivate: (): void => {
        if (resources) resources.anchor.visible = false;
      },
      unload,
    },
  };

  function load(): void {
    phase = "arrival";
    armed = false;
    heldSeconds = 0;
    turnRight = undefined;
    climb = 0;

    const shape = new Shape();
    shape.moveTo(-0.5, -0.12);
    shape.lineTo(0.1, -0.12);
    shape.lineTo(0.1, -0.32);
    shape.lineTo(0.5, 0);
    shape.lineTo(0.1, 0.32);
    shape.lineTo(0.1, 0.12);
    shape.lineTo(-0.5, 0.12);
    shape.closePath();
    const geometry = new ShapeGeometry(shape);
    let material: MeshBasicMaterial | undefined;
    try {
      material = new MeshBasicMaterial({
        color: GUIDE_COLOR,
        toneMapped: false,
      });
      const guide = new Mesh(geometry, material);
      guide.name = "StartGuide";
      const anchor = new Group();
      anchor.name = "StartGuideAnchor";
      anchor.visible = false;
      anchor.add(guide);
      resources = { anchor, guide };
      updateGuideAppearance();
      placeGuide();
      options.scene.add(anchor);
    } catch (error) {
      if (resources) options.scene.remove(resources.anchor);
      resources = undefined;
      geometry.dispose();
      material?.dispose();
      throw error;
    }
  }

  function advancePhase(deltaSeconds: number): void {
    if (phase === "complete" || turnRight === undefined) return;

    const neutral =
      Math.abs(turnRight) <= NEUTRAL_THRESHOLD &&
      Math.abs(climb) <= NEUTRAL_THRESHOLD;
    if (neutral) {
      if (phase === "arrival") phase = "right";
      armed = true;
      heldSeconds = 0;
      return;
    }
    if (!armed || phase === "arrival") return;

    const intention =
      phase === "right"
        ? turnRight
        : phase === "left"
          ? -turnRight
          : phase === "up"
            ? climb
            : -climb;
    if (intention < DIRECTION_THRESHOLD) {
      heldSeconds = 0;
      return;
    }

    heldSeconds += deltaSeconds;
    if (heldSeconds < CONFIRMATION_SECONDS) return;

    phase =
      phase === "right"
        ? "left"
        : phase === "left"
          ? "up"
          : phase === "up"
            ? "down"
            : "complete";
    // A held diagonal must not also complete the next direction automatically.
    armed = false;
    heldSeconds = 0;
  }

  function placeGuide(): void {
    if (!resources) return;

    const { anchor } = resources;
    pose.place(options.viewpoint.worldPosition, options.viewerRig.quaternion);
    anchor.position.copy(pose.position);
    anchor.lookAt(pose.lookTarget);
  }

  function updateGuideAppearance(): void {
    if (!resources) return;

    const { guide } = resources;
    guide.rotation.z =
      phase === "left"
        ? Math.PI
        : phase === "up"
          ? Math.PI / 2
          : phase === "down"
            ? -Math.PI / 2
            : 0;
    const progress = heldSeconds / CONFIRMATION_SECONDS;
    const scale =
      phase === "arrival" || phase === "complete"
        ? 0.5
        : 1 + progress * FEEDBACK_SCALE_GROWTH;
    guide.scale.setScalar(GUIDE_WIDTH_METERS * scale);
    guide.material.color.setHex(
      phase === "complete" ? CONFIRMED_COLOR : GUIDE_COLOR,
    );
  }

  function unload(): void {
    if (!resources) return;

    const { anchor, guide } = resources;
    resources = undefined;
    options.scene.remove(anchor);
    guide.geometry.dispose();
    guide.material.dispose();
  }
}
