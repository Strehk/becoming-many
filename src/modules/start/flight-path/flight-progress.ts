import { Line3, Vector3 } from "three";
import type {
  ExerciseOutcome,
  ExercisePose,
  ExerciseRoute,
  PlacedRoute,
  ProgressParameters,
} from "../start-contract";

// 1. Progress construction
const UP = new Vector3(0, 1, 0);
const MAXIMUM_CHECKPOINTS = 256;
const CROSSING_EPSILON = 1e-6;
interface Checkpoint {
  readonly position: Vector3;
  readonly direction: Vector3;
}

/** Observe ordered swept passage, using actual rig position rather than gaze. */
export function createFlightProgress(
  section: PlacedRoute,
  parameters: ProgressParameters,
  entryPosition: Readonly<Vector3> = section.pose.position,
) {
  return new FlightProgress(
    createCheckpoints(
      section.route,
      section.pose,
      parameters.checkpointSpacingMeters,
    ),
    entryPosition,
    parameters,
  );
}

function createCheckpoints(
  route: ExerciseRoute,
  pose: ExercisePose,
  spacing: number,
): Checkpoint[] {
  const checkpoints: Checkpoint[] = [];
  const count = Math.ceil(route.lengthMeters / spacing);
  if (!Number.isFinite(count) || count < 1 || count >= MAXIMUM_CHECKPOINTS) {
    throw new RangeError("Invalid or excessive progress checkpoints");
  }
  for (let index = 0; index <= count; index++) {
    const point = new Vector3();
    const distance = Math.min(index * spacing, route.lengthMeters);
    const direction = new Vector3();
    route.sample(distance, point);
    route.sampleDirection(distance, direction);
    point.applyAxisAngle(UP, pose.yawRadians).add(pose.position);
    direction.applyAxisAngle(UP, pose.yawRadians);
    checkpoints.push({ position: point, direction });
  }
  return checkpoints;
}

// 2. Movement history and bounded attempt state
class FlightProgress {
  private readonly previous = new Vector3();
  private readonly movement = new Line3();
  private readonly closest = new Vector3();
  private readonly relative = new Vector3();
  private checkpoint = 0;
  private travelMeters = 0;
  private budgetMeters = 0;
  private outcome: ExerciseOutcome = "pending";

  constructor(
    private readonly checkpoints: readonly Checkpoint[],
    entryPosition: Readonly<Vector3>,
    private readonly parameters: ProgressParameters,
  ) {
    this.previous.copy(entryPosition);
    this.enterRoute(entryPosition);
    this.resetBudget(entryPosition);
  }

  // Handoff may occur off-center; initialize from the real rig without inventing travel.
  private enterRoute(position: Readonly<Vector3>): void {
    const first = this.checkpoints[0];
    if (!first) return;
    this.relative.subVectors(position, first.position);
    const along = this.relative.dot(first.direction);
    this.relative.addScaledVector(first.direction, -along);
    if (
      Math.abs(along) <= this.parameters.maximumStepMeters &&
      this.relative.length() <= this.parameters.toleranceMeters
    )
      this.checkpoint = 1;
  }

  // 3. Swept passage and miss detection
  readonly update = (position: Readonly<Vector3>): ExerciseOutcome => {
    if (this.outcome === "passed") return this.outcome;
    const distance = this.previous.distanceTo(position);
    this.movement.set(this.previous, position);
    this.previous.copy(position);
    if (distance === 0) return this.outcome;
    if (distance > this.parameters.maximumStepMeters) {
      this.checkpoint = 0;
      this.resetBudget(position);
      return this.outcome;
    }
    this.outcome = "pending";
    this.travelMeters += distance;
    this.consumeCheckpoints(position);
    if (this.checkpoint === this.checkpoints.length) this.outcome = "passed";
    else if (this.travelMeters > this.budgetMeters) this.outcome = "missed";
    return this.outcome;
  };

  private consumeCheckpoints(position: Readonly<Vector3>): void {
    while (this.checkpoint < this.checkpoints.length) {
      const target = this.checkpoints[this.checkpoint];
      if (!target) return;
      if (!this.crossedCheckpoint(target)) return;
      this.checkpoint++;
      this.resetBudget(position);
    }
  }

  // Wide tolerance affects the corridor, never how early an endpoint is reached.
  private crossedCheckpoint(target: Checkpoint): boolean {
    const before = this.relative
      .subVectors(this.movement.start, target.position)
      .dot(target.direction);
    const after = this.relative
      .subVectors(this.movement.end, target.position)
      .dot(target.direction);
    if (
      before > CROSSING_EPSILON ||
      after < -CROSSING_EPSILON ||
      after <= before
    )
      return false;
    const fraction = Math.max(0, Math.min(1, -before / (after - before)));
    this.movement.at(fraction, this.closest);
    return (
      this.closest.distanceTo(target.position) <=
      this.parameters.toleranceMeters
    );
  }

  private resetBudget(position: Readonly<Vector3>): void {
    this.travelMeters = 0;
    const target = this.checkpoints[this.checkpoint];
    this.budgetMeters =
      (target?.position.distanceTo(position) ?? 0) +
      this.parameters.extraTravelMeters;
  }
}
