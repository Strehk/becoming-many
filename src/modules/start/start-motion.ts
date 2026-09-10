import { Vector3 } from "three";
import type { Viewpoint } from "../../world/viewer-rig";
import { START_SETTINGS, type StartMotionLimits } from "./start-settings";

interface MotionOptions {
  readonly viewpoint: Viewpoint;
  readonly limits: StartMotionLimits;
  readonly maximumGoalYAt?: (x: number, z: number) => number;
}

/** Sample eye/rig travel and predict flight from bounded rig history, never eye rotation. */
export class StartMotion {
  readonly previousEye = new Vector3();
  readonly eyeTravel = new Vector3();
  readonly flightTravel = new Vector3();
  readonly direction = new Vector3();
  readonly curvature = new Vector3();
  speed = 0;
  private readonly eyePosition = new Vector3();
  private readonly flightPosition = new Vector3();
  private readonly previousTravelDirection = new Vector3();
  private readonly sampledCurvature = new Vector3();
  private initialized = false;
  private hasMotionHistory = false;

  constructor(private readonly options: MotionOptions) {}

  /** Discard hidden travel; a new practice also skips the next segment. */
  resetHistory(reason: "resume" | "restart" = "resume"): void {
    if (reason === "restart") this.initialized = false;
    this.capturePosition();
    this.speed = 0;
    this.clearTrend();
  }

  /** Borrowed vectors remain valid until the next update or reset. */
  update(elapsed: number): void {
    if (!this.initialized) {
      this.resetHistory();
      this.initialized = true;
    }
    const { viewpoint } = this.options;
    this.previousEye.copy(this.eyePosition);
    this.eyeTravel.subVectors(viewpoint.worldPosition, this.eyePosition);
    this.flightTravel.subVectors(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
      this.flightPosition,
    );
    this.capturePosition();
    if (elapsed <= 0) return;
    const distance = this.flightTravel.length();
    if (
      this.flightTravel.lengthSq() <= START_SETTINGS.minimumTravelSquared ||
      distance / elapsed > START_SETTINGS.maximumObservedSpeedMetersPerSecond
    ) {
      this.clearTrend();
      return;
    }
    this.sampleTrend(elapsed, distance);
  }

  /** Mutate the supplied position and tangent with a decaying flight-trend prediction. */
  predictPosition(
    origin: Readonly<Vector3>,
    distance: number,
    prediction: { position: Vector3; tangent: Vector3 },
  ): void {
    const { position, tangent } = prediction;
    const decay = Math.exp(-distance / START_SETTINGS.curvatureDecayMeters);
    position
      .copy(origin)
      .addScaledVector(this.direction, distance)
      .addScaledVector(
        this.curvature,
        START_SETTINGS.curvatureDecayMeters * distance -
          START_SETTINGS.curvatureDecayMeters ** 2 * (1 - decay),
      );
    tangent
      .copy(this.direction)
      .addScaledVector(
        this.curvature,
        START_SETTINGS.curvatureDecayMeters * (1 - decay),
      );
    const ceiling = this.options.maximumGoalYAt?.(position.x, position.z);
    if (ceiling !== undefined && position.y > ceiling) {
      position.y = ceiling;
      tangent.y = 0;
    }
    tangent.normalize();
  }

  private capturePosition(): void {
    const { viewpoint } = this.options;
    this.eyePosition.copy(viewpoint.worldPosition);
    this.flightPosition.copy(
      viewpoint.worldFlightPosition ?? viewpoint.worldPosition,
    );
  }

  private clearTrend(): void {
    this.hasMotionHistory = false;
    this.curvature.set(0, 0, 0);
    this.direction.copy(
      this.options.viewpoint.worldFlightDirection ??
        this.options.viewpoint.worldDirection,
    );
  }

  private sampleTrend(elapsed: number, distance: number): void {
    this.direction.copy(this.flightTravel).normalize();
    const smoothing =
      1 - Math.exp(-elapsed / START_SETTINGS.motionHistorySeconds);
    const speed = distance / elapsed;
    this.speed = this.hasMotionHistory
      ? this.speed + (speed - this.speed) * smoothing
      : speed;
    if (this.hasMotionHistory && elapsed <= START_SETTINGS.motionHistorySeconds)
      this.sampleCurvature(distance, smoothing);
    else this.curvature.set(0, 0, 0);
    this.previousTravelDirection.copy(this.direction);
    this.hasMotionHistory = true;
  }

  private sampleCurvature(distance: number, smoothing: number): void {
    this.sampledCurvature
      .copy(this.direction)
      .sub(this.previousTravelDirection)
      .multiplyScalar(1 / distance);
    // Only sideways change bends the prediction; speed remains Run-owned.
    this.sampledCurvature.addScaledVector(
      this.direction,
      -this.sampledCurvature.dot(this.direction),
    );
    const limit = Math.min(
      START_SETTINGS.maximumCurvaturePerMeter,
      this.options.limits.yawRateRadiansPerSecond / Math.max(this.speed, 0.1),
    );
    const magnitude = this.sampledCurvature.length();
    if (magnitude > limit)
      this.sampledCurvature.multiplyScalar(limit / magnitude);
    this.curvature.lerp(this.sampledCurvature, smoothing);
    this.curvature.addScaledVector(
      this.direction,
      -this.curvature.dot(this.direction),
    );
  }
}
