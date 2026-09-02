/**
 * Purpose: Carry the visitor through the world under a transform the headset
 *   does not own, and publish where they actually are.
 * Context: While an immersive session presents, Three.js overwrites the
 *   camera's local transform from the head pose every frame, so locomotion
 *   written onto the camera is silently discarded.
 * Responsibility: Own the rig group, the camera under it, and the one
 *   per-frame refresh that turns both into world-space viewer facts.
 * Boundary: What moves the rig lives in `../control`; what reads the viewpoint
 *   lives in `../modules`. Neither may write the camera's own transform.
 */

import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

/** World-space viewer facts, refreshed once per frame before modules update. */
export interface Viewpoint {
  /**
   * The visitor's eye in world space. Never the camera's local position: under
   * the rig those differ by the rig transform and, in a `local-floor` session,
   * by the visitor's own standing height.
   */
  readonly worldPosition: Readonly<Vector3>;

  /** Metres the level streams and draws to; follows the camera's far plane. */
  readonly viewDistanceMeters: number;
}

export interface ViewerRig {
  /**
   * The transform locomotion moves. The runtime adds it to the scene: a camera
   * with a parent is skipped by the renderer's own matrix update, so a rig
   * outside the scene graph freezes the view without raising anything.
   */
  readonly group: Group;

  /**
   * The rendering camera. Its local transform belongs to the head — mouse look
   * on desktop, the headset pose while presenting. Locomotion never writes it.
   */
  readonly camera: PerspectiveCamera;

  readonly viewpoint: Viewpoint;

  /** Refresh the rig's world matrices and the published viewpoint. */
  readonly publish: () => void;
}

export function createViewerRig(viewPitchAssistDegrees = 0): ViewerRig {
  const group = new Group();
  group.name = "ViewerRig";
  // WebXR composes the headset pose with the camera's parent. Keeping the
  // comfort pitch on that parent makes it survive every headset pose update,
  // while the outer rig remains yaw-only locomotion.
  const viewAssist = new Group();
  viewAssist.name = "ViewPitchAssist";
  viewAssist.rotation.x = MathUtils.degToRad(viewPitchAssistDegrees);
  const camera = new PerspectiveCamera();
  viewAssist.add(camera);
  group.add(viewAssist);

  const worldPosition = new Vector3();

  return {
    group,
    camera,

    viewpoint: {
      worldPosition,

      // A show retunes the view distance mid-run, so this reads the far plane
      // every time rather than a value captured once during setup.
      get viewDistanceMeters(): number {
        return camera.far;
      },
    },

    publish: (): void => {
      // Locomotion has just moved the rig and nothing else refreshes world
      // matrices until the render call. Force the update so the camera child
      // is recomposed too — `getWorldPosition` reads `matrixWorld`.
      group.updateMatrixWorld(true);
      camera.getWorldPosition(worldPosition);
    },
  };
}
