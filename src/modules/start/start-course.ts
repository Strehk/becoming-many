import { CubicBezierCurve3, Quaternion, Vector3 } from "three";
import type { Viewpoint } from "../../world/viewpoint";
import {
  type DistanceRange,
  START_SETTINGS,
  type StartDirection,
  type StartMotionLimits,
  type StartParameters,
} from "./start-settings";

const WORLD_UP = new Vector3(0, 1, 0);

interface CourseOptions {
  readonly parameters: StartParameters;
  readonly viewpoint: Viewpoint;
  readonly limits: StartMotionLimits;
  readonly arrowLengthMeters: number;
  readonly random: () => number;
  readonly maximumGoalYAt?: (x: number, z: number) => number;
}

interface CourseSample {
  readonly position: Vector3;
  readonly tangent: Vector3;
  readonly up: Vector3;
  distance: number;
}

/** Own fixed tunnel geometry and bounded samples; Start owns phases and passage ages. */
export class StartCourse {
  readonly goalPosition = new Vector3();
  readonly goalNormal = new Vector3();
  readonly goalUp = new Vector3();
  readonly approachDirection = new Vector3();
  readonly turnDirection = new Vector3();
  readonly previews = Array.from(
    { length: START_SETTINGS.previewCount },
    () => ({
      goalPosition: new Vector3(),
      goalNormal: new Vector3(),
      goalUp: new Vector3(),
      ringRadiusMeters: 0,
    }),
  );
  ringRadiusMeters: number;
  private readonly origin = new Vector3();
  private readonly tunnelEntry = new Vector3();
  private readonly arrowDirection = new Vector3();
  private readonly targetOffset = new Vector3();
  private readonly lessonBend = new Vector3();
  private readonly transportRotation = new Quaternion();
  private readonly approachCurve = new CubicBezierCurve3();
  private readonly tunnelCurve = new CubicBezierCurve3();
  private readonly samples: CourseSample[] = Array.from(
    { length: START_SETTINGS.courseSampleCount + 1 },
    () => ({
      position: new Vector3(),
      tangent: new Vector3(),
      up: new Vector3(),
      distance: 0,
    }),
  );

  constructor(private readonly options: CourseOptions) {
    this.ringRadiusMeters = options.parameters.course.radiusMeters[0];
  }

  /** Sample the same lead distance once before Start asks Motion for a prediction. */
  arrowDistance(goalIndex: number): number {
    const { parameters, arrowLengthMeters, viewpoint } = this.options;
    return Math.max(
      START_SETTINGS.minimumArrowLeadMeters,
      this.sample(
        goalIndex === 0
          ? parameters.course.firstDistanceMeters
          : parameters.course.spacingMeters,
      ),
      arrowLengthMeters /
        Math.tan(Math.max(0.1, viewpoint.viewHalfAngleRadians)),
    );
  }

  /** Write the new world-fixed pose into Arrows' borrowed output after preserving its previous cue. */
  placeArrow(
    direction: StartDirection,
    prediction: {
      position: Readonly<Vector3>;
      tangent: Readonly<Vector3>;
      direction: Readonly<Vector3>;
      distance: number;
    },
    pose: { position: Vector3; normal: Vector3; up: Vector3 },
  ): void {
    this.origin.copy(this.options.viewpoint.worldPosition);
    this.approachDirection.copy(prediction.direction);
    this.orientTurn(direction, prediction.tangent);
    pose.position.copy(prediction.position);
    this.tunnelEntry
      .copy(pose.position)
      .addScaledVector(
        this.arrowDirection,
        this.options.arrowLengthMeters / 2 +
          START_SETTINGS.arrowTunnelClearanceMeters,
      );
    this.correctVisibility(pose.position, prediction.distance);
    this.orientArrow(pose);
    this.goalPosition.copy(this.tunnelEntry);
  }

  /** Publish rings only when the reserved entrance is visible and the sampled path is flyable. */
  placeGoal(
    direction: Readonly<Vector3>,
    curvature: Readonly<Vector3>,
    speed: number,
  ): boolean {
    this.origin.copy(this.options.viewpoint.worldPosition);
    const radius = this.sample(this.options.parameters.course.radiusMeters);
    if (!this.entranceVisible()) return false;
    this.shapeApproach(direction);
    this.shapeTunnel(curvature, radius);
    if (!this.buildCourse(speed)) return false;
    const final = this.samples[START_SETTINGS.courseSampleCount];
    const entry = this.samples[START_SETTINGS.courseEntrySample];
    if (!final || !entry) return false;
    this.goalPosition.copy(final.position);
    this.goalNormal.copy(final.tangent).negate();
    this.goalUp.copy(final.up);
    this.ringRadiusMeters = radius;
    for (const [index, preview] of this.previews.entries()) {
      this.sampleCourseAtLength(
        entry.distance +
          ((final.distance - entry.distance) * index) / this.previews.length,
        preview,
      );
      preview.goalNormal.negate();
      preview.ringRadiusMeters = radius;
    }
    return true;
  }

  private orientTurn(
    direction: StartDirection,
    tangent: Readonly<Vector3>,
  ): void {
    const { viewpoint } = this.options;
    const horizontal = direction === "right" || direction === "left";
    this.turnDirection.copy(
      horizontal
        ? this.turnDirection
            .crossVectors(
              viewpoint.worldFlightDirection ?? viewpoint.worldDirection,
              WORLD_UP,
            )
            .normalize()
        : WORLD_UP,
    );
    if (direction === "left" || direction === "down")
      this.turnDirection.negate();
    this.arrowDirection
      .copy(this.turnDirection)
      .addScaledVector(tangent, -this.turnDirection.dot(tangent));
    if (this.arrowDirection.lengthSq() < START_SETTINGS.minimumTravelSquared)
      this.arrowDirection.copy(this.turnDirection);
    this.arrowDirection
      .normalize()
      .multiplyScalar(START_SETTINGS.arrowTurnComponent)
      .addScaledVector(tangent, START_SETTINGS.arrowForwardComponent)
      .normalize();
  }

  /** Move cue and entrance together within the existing half-radius gaze accommodation. */
  private correctVisibility(position: Vector3, distance: number): void {
    const { viewpoint, arrowLengthMeters, parameters } = this.options;
    this.targetOffset.copy(position).sub(this.origin);
    const predictionAngle = this.targetOffset.angleTo(viewpoint.worldDirection);
    const visibleAngle = Math.max(
      0,
      viewpoint.viewHalfAngleRadians * 0.5 -
        Math.atan((arrowLengthMeters * 0.5) / distance),
    );
    if (!(predictionAngle > visibleAngle)) return;
    this.targetOffset
      .normalize()
      .lerp(viewpoint.worldDirection, 1 - visibleAngle / predictionAngle)
      .normalize()
      .multiplyScalar(distance)
      .add(this.origin)
      .sub(position);
    const maximumOffset = parameters.course.radiusMeters[0] * 0.5;
    if (this.targetOffset.length() > maximumOffset)
      this.targetOffset.setLength(maximumOffset);
    position.add(this.targetOffset);
    this.tunnelEntry.add(this.targetOffset);
  }

  /** Roll the broad face toward the eye without changing the reserved entrance axis. */
  private orientArrow(pose: {
    position: Vector3;
    normal: Vector3;
    up: Vector3;
  }): void {
    pose.normal
      .copy(this.origin)
      .sub(pose.position)
      .projectOnPlane(this.arrowDirection);
    if (pose.normal.lengthSq() < START_SETTINGS.minimumTravelSquared)
      pose.normal
        .copy(this.options.viewpoint.worldUp)
        .projectOnPlane(this.arrowDirection);
    if (pose.normal.lengthSq() < START_SETTINGS.minimumTravelSquared)
      pose.normal.set(1, 0, 0).projectOnPlane(this.arrowDirection);
    pose.normal.normalize();
    pose.up.crossVectors(pose.normal, this.arrowDirection).normalize();
  }

  private entranceVisible(): boolean {
    const { viewpoint } = this.options;
    this.targetOffset.copy(this.tunnelEntry).sub(this.origin);
    const depth = this.targetOffset.dot(viewpoint.worldDirection);
    const lateral = Math.sqrt(
      Math.max(0, this.targetOffset.lengthSq() - depth * depth),
    );
    return !(
      depth <= 0 || lateral > depth * Math.tan(viewpoint.viewHalfAngleRadians)
    );
  }

  private shapeApproach(direction: Readonly<Vector3>): void {
    const distance = this.origin.distanceTo(this.tunnelEntry);
    const approach = this.approachCurve;
    approach.v0.copy(this.origin);
    approach.v1.copy(this.origin).addScaledVector(direction, distance / 3);
    approach.v2
      .copy(this.tunnelEntry)
      .addScaledVector(this.arrowDirection, -distance / 3);
    approach.v3.copy(this.tunnelEntry);
  }

  private shapeTunnel(curvature: Readonly<Vector3>, radius: number): void {
    const { tunnelCurve: tunnel, tunnelEntry, arrowDirection } = this;
    const lessonBend = this.lessonBend;
    const span =
      this.previews.length *
      Math.max(START_SETTINGS.minimumRingSpacingMeters, radius * 0.5);
    lessonBend
      .copy(this.turnDirection)
      .addScaledVector(arrowDirection, -this.turnDirection.dot(arrowDirection))
      .multiplyScalar(START_SETTINGS.lessonBendComponent);
    lessonBend.addScaledVector(
      curvature,
      Math.min(span, START_SETTINGS.curvatureDecayMeters) * 0.25,
    );
    tunnel.v0.copy(tunnelEntry);
    tunnel.v1.copy(tunnelEntry).addScaledVector(arrowDirection, span / 3);
    tunnel.v2
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, (span * 2) / 3)
      .addScaledVector(lessonBend, span / 3);
    tunnel.v3
      .copy(tunnelEntry)
      .addScaledVector(arrowDirection, span)
      .addScaledVector(lessonBend, span);
  }

  /** Reuse one fixed table for reachable-path checks and arc-length ring placement. */
  private buildCourse(observedSpeed: number): boolean {
    const speed = Math.max(observedSpeed, 0.5);
    for (const [index, sample] of this.samples.entries()) {
      this.sampleCurve(index, sample);
      const ceiling = this.options.maximumGoalYAt?.(
        sample.position.x,
        sample.position.z,
      );
      if (ceiling !== undefined && sample.position.y > ceiling) return false;
      const previous = this.samples[index - 1];
      if (!previous) {
        this.orientFirstSample(sample);
        continue;
      }
      const segmentLength = sample.position.distanceTo(previous.position);
      sample.distance = previous.distance + segmentLength;
      if (!this.segmentReachable(previous, sample, segmentLength / speed))
        return false;
      this.transportRotation.setFromUnitVectors(
        previous.tangent,
        sample.tangent,
      );
      sample.up
        .copy(previous.up)
        .applyQuaternion(this.transportRotation)
        .normalize();
    }
    return true;
  }

  private sampleCurve(index: number, sample: CourseSample): void {
    const approaching = index <= START_SETTINGS.courseEntrySample;
    const curve = approaching ? this.approachCurve : this.tunnelCurve;
    const t = approaching
      ? index / START_SETTINGS.courseEntrySample
      : (index - START_SETTINGS.courseEntrySample) /
        (START_SETTINGS.courseSampleCount - START_SETTINGS.courseEntrySample);
    curve.getPoint(t, sample.position);
    // Analytic derivative avoids Curve.getTangent's temporary vectors.
    sample.tangent
      .copy(curve.v1)
      .sub(curve.v0)
      .multiplyScalar((1 - t) ** 2)
      .addScaledVector(
        this.targetOffset.copy(curve.v2).sub(curve.v1),
        2 * (1 - t) * t,
      )
      .addScaledVector(this.targetOffset.copy(curve.v3).sub(curve.v2), t * t)
      .normalize();
  }

  private orientFirstSample(sample: CourseSample): void {
    sample.distance = 0;
    sample.up
      .copy(this.options.viewpoint.worldUp)
      .addScaledVector(
        sample.tangent,
        -this.options.viewpoint.worldUp.dot(sample.tangent),
      );
    if (sample.up.lengthSq() < START_SETTINGS.minimumTravelSquared)
      sample.up.set(1, 0, 0);
    sample.up.normalize();
  }

  private segmentReachable(
    previous: CourseSample,
    sample: CourseSample,
    stepSeconds: number,
  ): boolean {
    const { limits } = this.options;
    const verticalSpeed =
      (sample.position.y - previous.position.y) / stepSeconds;
    if (
      verticalSpeed >
        limits.climbRateMetersPerSecond -
          limits.neutralDescentMetersPerSecond ||
      verticalSpeed <
        -limits.climbRateMetersPerSecond - limits.neutralDescentMetersPerSecond
    )
      return false;
    const horizontalTurn = Math.atan2(
      previous.tangent.x * sample.tangent.z -
        previous.tangent.z * sample.tangent.x,
      previous.tangent.x * sample.tangent.x +
        previous.tangent.z * sample.tangent.z,
    );
    return !(
      Math.abs(horizontalTurn) >
      limits.yawRateRadiansPerSecond * stepSeconds
    );
  }

  private sampleCourseAtLength(
    distance: number,
    ring: { goalPosition: Vector3; goalNormal: Vector3; goalUp: Vector3 },
  ): void {
    for (const [index, sample] of this.samples.entries()) {
      const previous = this.samples[index - 1];
      if (!previous || sample.distance < distance) continue;
      const span = sample.distance - previous.distance;
      const fraction = span > 0 ? (distance - previous.distance) / span : 0;
      ring.goalPosition.lerpVectors(
        previous.position,
        sample.position,
        fraction,
      );
      ring.goalNormal
        .lerpVectors(previous.tangent, sample.tangent, fraction)
        .normalize();
      ring.goalUp.lerpVectors(previous.up, sample.up, fraction);
      ring.goalUp
        .addScaledVector(ring.goalNormal, -ring.goalUp.dot(ring.goalNormal))
        .normalize();
      return;
    }
  }

  private sample([minimum, maximum]: DistanceRange): number {
    return minimum + (maximum - minimum) * this.options.random();
  }
}
