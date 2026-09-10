import { Line3, Vector3 } from "three";
import type {
  ExerciseOutcome,
  ExercisePose,
  ProgressParameters,
} from "../start-contract";
import type { FlightRoute } from "./particle-contract";

// 1. Progress construction
const UP = new Vector3(0, 1, 0);
const MAXIMUM_CHECKPOINTS = 256;

/** Observe ordered swept passage, using actual rig position rather than gaze. */
export function createFlightProgress(
  route: FlightRoute,
  pose: ExercisePose,
  parameters: ProgressParameters,
) {
  return new FlightProgress(
    createCheckpoints(route, pose, parameters.checkpointSpacingMeters),
    pose,
    parameters,
  );
}

function createCheckpoints(
  route: FlightRoute,
  pose: ExercisePose,
  spacing: number,
): Vector3[] {
  const checkpoints: Vector3[] = [];
  const count = Math.ceil(route.lengthMeters / spacing);
  if (!Number.isFinite(count) || count < 1 || count >= MAXIMUM_CHECKPOINTS) {
    throw new RangeError("Invalid or excessive progress checkpoints");
  }
  for (let index = 0; index <= count; index++) {
    const point = new Vector3();
    route.sample(Math.min(index * spacing, route.lengthMeters), point);
    point.applyAxisAngle(UP, pose.yawRadians).add(pose.position);
    checkpoints.push(point);
  }
  return checkpoints;
}

// 2. Movement history and bounded attempt state
class FlightProgress {
  private readonly previous = new Vector3();
  private readonly movement = new Line3();
  private readonly closest = new Vector3();
  private checkpoint = 0;
  private travelMeters = 0;
  private budgetMeters = 0;
  private outcome: ExerciseOutcome = "pending";

  constructor(
    private readonly checkpoints: readonly Vector3[],
    pose: ExercisePose,
    private readonly parameters: ProgressParameters,
  ) {
    this.previous.copy(pose.position);
    this.resetBudget(pose.position);
  }

  // 3. Swept passage and miss detection
  readonly update = (position: Readonly<Vector3>): ExerciseOutcome => {
    if (this.outcome !== "pending") return this.outcome;
    const distance = this.previous.distanceTo(position);
    this.movement.set(this.previous, position);
    this.previous.copy(position);
    if (distance === 0) return this.outcome;
    if (distance > this.parameters.maximumStepMeters) {
      this.checkpoint = 0;
      this.resetBudget(position);
      return this.outcome;
    }
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
      this.movement.closestPointToPoint(target, true, this.closest);
      if (this.closest.distanceTo(target) > this.parameters.toleranceMeters)
        return;
      this.checkpoint++;
      this.resetBudget(position);
    }
  }

  private resetBudget(position: Readonly<Vector3>): void {
    this.travelMeters = 0;
    const target = this.checkpoints[this.checkpoint];
    this.budgetMeters =
      (target?.distanceTo(position) ?? 0) + this.parameters.extraTravelMeters;
  }
}
