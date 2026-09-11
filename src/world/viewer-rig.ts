import { Group, MathUtils, PerspectiveCamera, Vector3 } from "three";

export type ViewerRig = Pick<
  OwnedViewerRig,
  | "group"
  | "camera"
  | "viewpoint"
  | "beginFrame"
  | "publish"
  | "enterXr"
  | "leaveXr"
>;

/** Parent-only assistance survives the head pose written by WebXR. */
export const XR_VIEW_PITCH_ASSIST_DEGREES = 30;

/** World adds the rig to its scene and owns frame dispatch and renderer lifetime. */
export function createViewerRig(xrViewPitchAssistDegrees = 0): ViewerRig {
  return new OwnedViewerRig(xrViewPitchAssistDegrees);
}

class OwnedViewerRig {
  readonly group = new Group();
  readonly camera = new PerspectiveCamera();
  readonly viewpoint = createViewpoint(this.camera);
  private readonly frameStartPosition = new Vector3();
  private frameStarted = false;
  private readonly viewPose = new Group();
  private readonly xrPitchRadians: number;
  private readonly desktopPosition = new Vector3();
  private readonly desktopOrientation = this.camera.quaternion.clone();
  private desktopFieldOfViewDegrees = this.camera.fov;

  constructor(xrViewPitchAssistDegrees: number) {
    this.group.name = "ViewerRig";
    this.xrPitchRadians = MathUtils.degToRad(xrViewPitchAssistDegrees);
    this.viewPose.name = "ViewPose";
    this.viewPose.add(this.camera);
    this.group.add(this.viewPose);
  }

  /** Preserve mouse look before WebXR starts writing the local camera pose. */
  readonly enterXr = (): void => {
    this.desktopPosition.copy(this.camera.position);
    this.desktopOrientation.copy(this.camera.quaternion);
    this.desktopFieldOfViewDegrees = this.camera.fov;
  };

  /** Restore desktop look instead of retaining the last physical head pose. */
  readonly leaveXr = (): void => {
    this.camera.position.copy(this.desktopPosition);
    this.camera.quaternion.copy(this.desktopOrientation);
    this.camera.fov = this.desktopFieldOfViewDegrees;
  };

  /** Capture before Run moves or constrains the rig; exclude between-frame resets. */
  readonly beginFrame = (): void => {
    this.group.getWorldPosition(this.frameStartPosition);
    this.frameStarted = true;
  };

  /** Refresh once; matrix reads avoid getWorldPosition's repeated tree updates. */
  readonly publish = (isPresentingXr = false): void => {
    this.group.updateWorldMatrix(true, false);
    const { viewpoint, camera, group } = this;
    viewpoint.worldFlightPosition.setFromMatrixPosition(group.matrixWorld);
    this.publishFlightDirection();
    this.viewPose.rotation.x = isPresentingXr ? this.xrPitchRadians : 0;
    this.viewPose.updateMatrixWorld(true);
    viewpoint.worldBodyDirection
      .setFromMatrixColumn(this.viewPose.matrixWorld, 2)
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

  private publishFlightDirection(): void {
    const { worldFlightPosition, worldFlightDirection } = this.viewpoint;
    if (this.frameStarted) {
      worldFlightDirection.subVectors(
        worldFlightPosition,
        this.frameStartPosition,
      );
    }
    if (!this.frameStarted || worldFlightDirection.lengthSq() === 0) {
      worldFlightDirection
        .setFromMatrixColumn(this.group.matrixWorld, 2)
        .negate();
    }
    worldFlightDirection.normalize();
    this.frameStarted = false;
  }
}

function createViewpoint(camera: PerspectiveCamera) {
  return {
    worldPosition: new Vector3(),
    worldFlightPosition: new Vector3(),
    worldFlightDirection: new Vector3(0, 0, -1),
    worldBodyDirection: new Vector3(0, 0, -1),
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
