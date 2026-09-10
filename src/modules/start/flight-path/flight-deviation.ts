import { Line3, Vector3 } from "three";
import type {
  DeviationParameters,
  PlacedRoute,
  RecoveryView,
} from "../start-contract";

// 1. Bounded world-space corridor and conservative ring visibility samples.
const SETTINGS = { spacingMeters: 2, maximumSegments: 256 };
const UP = new Vector3(0, 1, 0);

/** Recovery requires sustained outside travel, a divergent heading and no visible ring area. */
export function createFlightDeviation(
  section: PlacedRoute,
  entryPosition: Readonly<Vector3>,
  parameters: DeviationParameters,
) {
  const samples = sampleRoute(section);
  samples.points.unshift(new Vector3().copy(entryPosition));
  return new FlightDeviation(samples, entryPosition, parameters);
}

function sampleRoute(section: PlacedRoute) {
  const count = Math.ceil(section.route.lengthMeters / SETTINGS.spacingMeters);
  if (count > SETTINGS.maximumSegments)
    throw new RangeError("Deviation route exceeds capacity");
  const points: Vector3[] = [];
  const ringArea: Vector3[] = [];
  for (let index = 0; index <= count; index++) {
    const distance = Math.min(
      index * SETTINGS.spacingMeters,
      section.route.lengthMeters,
    );
    const point = new Vector3();
    section.route.sample(distance, point);
    point
      .applyAxisAngle(UP, section.pose.yawRadians)
      .add(section.pose.position);
    points.push(point);
    if (
      distance >= section.route.exerciseStartMeters &&
      distance <= section.route.exerciseEndMeters
    )
      ringArea.push(point);
  }
  return { points, ringArea };
}

// 2. Actual movement owns persistence; resets and gaze cannot count as travel.
class FlightDeviation {
  private readonly previous = new Vector3();
  private readonly segment = new Line3();
  private readonly closest = new Vector3();
  private readonly relative = new Vector3();
  private outsideMeters = 0;
  private nearestIndex = 0;

  constructor(
    private readonly samples: {
      points: readonly Vector3[];
      ringArea: readonly Vector3[];
    },
    entry: Readonly<Vector3>,
    private readonly parameters: DeviationParameters,
  ) {
    this.previous.copy(entry);
  }

  readonly update = (
    position: Readonly<Vector3>,
    view: RecoveryView,
  ): boolean => {
    const moved = this.previous.distanceTo(position);
    this.previous.copy(position);
    if (moved === 0) return false;
    const outside =
      this.distanceToRoute(position) > this.parameters.distanceMeters;
    const departing =
      outside && this.isDeparting(position, view) && !this.isVisible(view);
    this.outsideMeters =
      departing && moved <= this.parameters.maximumStepMeters
        ? this.outsideMeters + moved
        : 0;
    return this.outsideMeters >= this.parameters.outsideTravelMeters;
  };

  private distanceToRoute(position: Readonly<Vector3>): number {
    let distance = Infinity;
    for (let index = 1; index < this.samples.points.length; index++) {
      const start = this.samples.points[index - 1],
        end = this.samples.points[index];
      if (!start || !end) continue;
      this.segment
        .set(start, end)
        .closestPointToPoint(position, true, this.closest);
      const candidate = this.closest.distanceTo(position);
      if (candidate >= distance) continue;
      distance = candidate;
      this.nearestIndex = index;
    }
    return distance;
  }

  // 3. A forward route target allows parallel offsets and returning toward the corridor.
  private isDeparting(
    position: Readonly<Vector3>,
    view: RecoveryView,
  ): boolean {
    const travel = view.worldFlightDirection;
    if (!travel || travel.lengthSq() === 0) return false;
    const lookAhead = Math.ceil(
      this.parameters.lookAheadMeters / SETTINGS.spacingMeters,
    );
    const target =
      this.samples.points[
        Math.min(this.nearestIndex + lookAhead, this.samples.points.length - 1)
      ];
    if (!target) return false;
    this.relative.subVectors(target, position).normalize();
    const alignment = this.relative.dot(travel) / travel.length();
    return alignment < Math.cos(this.parameters.directionDifferenceRadians);
  }

  private isVisible(view: RecoveryView): boolean {
    const padding = this.parameters.visibilityPaddingMeters;
    return this.samples.ringArea.some((point) => {
      this.relative.subVectors(point, view.worldPosition);
      const distance = this.relative.length();
      if (distance <= padding) return true;
      if (distance - padding > view.viewDistanceMeters) return false;
      const halfAngle =
        view.viewHalfAngleRadians + Math.asin(padding / distance);
      const alignment = this.relative.dot(view.worldDirection) / distance;
      return alignment >= Math.cos(Math.min(Math.PI, halfAngle));
    });
  }
}
