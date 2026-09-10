import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

/** Borrowed world facts, refreshed before modules; consumers never mutate vectors. */
export interface Viewpoint {
  readonly worldPosition: Readonly<Vector3>;
  /** Rig motion excludes the local head pose and pitch assistance. */
  readonly worldFlightPosition?: Readonly<Vector3>;
  readonly worldFlightDirection?: Readonly<Vector3>;
  readonly worldDirection: Readonly<Vector3>;
  readonly worldUp: Readonly<Vector3>;
  readonly viewHalfAngleRadians: number;
  readonly viewDistanceMeters: number;
}

export type ViewerRig = Pick<
  OwnedViewerRig,
  "group" | "camera" | "viewpoint" | "publish"
>;

/** Parent-only assistance survives the head pose written by WebXR. */
export const VIEW_PITCH_ASSIST_DEGREES = 30;

/** World adds the rig to its scene and owns frame dispatch and renderer lifetime. */
export function createViewerRig(viewPitchAssistDegrees = 0): ViewerRig {
  return new OwnedViewerRig(viewPitchAssistDegrees);
}

class OwnedViewerRig {
  readonly group = new Group();
  readonly camera = new PerspectiveCamera();
  readonly viewpoint = createViewpoint(this.camera);

  constructor(viewPitchAssistDegrees: number) {
    this.group.name = "ViewerRig";
    const viewAssist = new Group();
    viewAssist.name = "ViewPitchAssist";
    viewAssist.rotation.x = MathUtils.degToRad(viewPitchAssistDegrees);
    viewAssist.add(this.camera);
    this.group.add(viewAssist);
  }

  /** Refresh once; matrix reads avoid getWorldPosition's repeated tree updates. */
  readonly publish = (): void => {
    this.group.updateMatrixWorld(true);
    const { viewpoint, camera, group } = this;
    viewpoint.worldFlightPosition.setFromMatrixPosition(group.matrixWorld);
    viewpoint.worldFlightDirection
      .setFromMatrixColumn(group.matrixWorld, 2)
      .negate()
      .normalize();
    viewpoint.worldPosition.setFromMatrixPosition(camera.matrixWorld);
    viewpoint.worldDirection
      .setFromMatrixColumn(camera.matrixWorld, 2)
      .negate()
      .normalize();
    viewpoint.worldUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    viewpoint.viewHalfAngleRadians = viewHalfAngle(camera);
  };
}

function createViewpoint(camera: PerspectiveCamera) {
  return {
    worldPosition: new Vector3(),
    worldFlightPosition: new Vector3(),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldDirection: new Vector3(0, 0, -1),
    worldUp: new Vector3(0, 1, 0),
    viewHalfAngleRadians: MathUtils.degToRad(camera.getEffectiveFOV()) / 2,
    get viewDistanceMeters(): number {
      return camera.far;
    },
  };
}

/** XR may replace an asymmetric projection without changing camera.aspect. */
function viewHalfAngle(camera: PerspectiveCamera): number {
  const projection = camera.projectionMatrix.elements;
  return Math.atan(
    Math.max(
      0,
      Math.min(
        (1 - Math.abs(projection[8])) / projection[0],
        (1 - Math.abs(projection[9])) / projection[5],
      ),
    ),
  );
}
