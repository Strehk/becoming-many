import {
  Group,
  MathUtils,
  type Object3D,
  PerspectiveCamera,
  Quaternion,
  Vector3,
} from "three";

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

/**
 * A headset at home is worn standing or sitting, not lying on the ICAROS: the
 * parent pitch assistance would tilt the horizon, and every turn of the flight
 * would turn the world around the visitor's head. Rigs that present after this
 * call keep the view level and still in the world instead: the view pose
 * cancels the flight's rotation, so the visitor looks around as they would in
 * a room, and the flight turns toward where they look without them seeing it
 * turn. The installation never calls it.
 */
let steadyXrView = false;
export function preferSteadyXrView(steady = true): void {
  steadyXrView = steady;
}

const UP = new Vector3(0, 1, 0);

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
  /** The level heading the steady view keeps; taken from the flight on entry. */
  private readonly steadyHeading = new Quaternion();
  private hasSteadyHeading = false;
  private readonly rigRotation = new Quaternion();
  private readonly forward = new Vector3();

  constructor(xrViewPitchAssistDegrees: number) {
    this.group.name = "ViewerRig";
    this.xrPitchRadians = MathUtils.degToRad(xrViewPitchAssistDegrees);
    this.viewPose.name = "ViewPose";
    this.viewPose.add(this.camera);
    this.group.add(this.viewPose);
  }

  /** Preserve mouse look before WebXR starts writing the local camera pose. */
  readonly enterXr = (): void => {
    this.hasSteadyHeading = false;
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
    const steady = isPresentingXr && steadyXrView;
    if (steady) this.holdViewSteady();
    else
      this.viewPose.rotation.set(
        isPresentingXr ? this.xrPitchRadians : 0,
        0,
        0,
      );
    this.viewPose.updateMatrixWorld(true);
    // A steady view no longer turns with the body, so the body is the flight.
    viewpoint.worldBodyDirection
      .setFromMatrixColumn((steady ? group : this.viewPose).matrixWorld, 2)
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

  /** Cancel the flight's rotation under the head: the view pose stays level on one heading. */
  private holdViewSteady(): void {
    this.group.getWorldQuaternion(this.rigRotation);
    if (!this.hasSteadyHeading) {
      this.forward.set(0, 0, -1).applyQuaternion(this.rigRotation);
      this.steadyHeading.setFromAxisAngle(
        UP,
        Math.atan2(-this.forward.x, -this.forward.z),
      );
      this.hasSteadyHeading = true;
    }
    this.viewPose.quaternion
      .copy(this.rigRotation)
      .invert()
      .multiply(this.steadyHeading);
  }

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

/**
 * Read the compass yaw the rig is travelling on, in radians. The rig is what
 * locomotion turns; the camera under it is head pose and would swing the
 * answer with a glance, so a route turned against the visitor reads this and
 * not the camera.
 *
 * Deliberately not a `Viewpoint` field: the viewpoint is published after the
 * level update that consumes this, so a stored value would be one frame old.
 * The reader owns one scratch vector and never allocates.
 */
export function createRigHeadingReader(rig: Object3D): () => number {
  const heading = new Vector3();

  return (): number => {
    rig.updateWorldMatrix(true, false);
    heading.set(0, 0, -1).applyQuaternion(rig.quaternion);
    // The yaw that turns −Z onto this heading. Both components are negated
    // because forward is −Z: reading the raw components instead answers a
    // half turn away, which sends a route authored to cross in front of the
    // visitor out behind them.
    return Math.atan2(-heading.x, -heading.z);
  };
}
