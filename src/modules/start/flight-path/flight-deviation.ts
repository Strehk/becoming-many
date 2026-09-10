import { Line3, Vector3 } from "three";
import type { DeviationParameters, PlacedRoute } from "../start-contract";

// 1. Bounded proximity sampling
const SETTINGS = { spacingMeters: 2, maximumSegments: 256 };
const UP = new Vector3(0, 1, 0);

/** Observe off-route travel; the initial approach corridor is included. */
export function createFlightDeviation(
  section: PlacedRoute,
  entryPosition: Readonly<Vector3>,
  parameters: DeviationParameters,
) {
  const points = sampleRoute(section);
  points.unshift(new Vector3().copy(entryPosition));
  return new FlightDeviation(points, entryPosition, parameters);
}

function sampleRoute(section: PlacedRoute): Vector3[] {
  const count = Math.ceil(section.route.lengthMeters / SETTINGS.spacingMeters);
  if (count > SETTINGS.maximumSegments)
    throw new RangeError("Deviation route exceeds capacity");
  const points: Vector3[] = [];
  for (let index = 0; index <= count; index++) {
    const point = new Vector3();
    section.route.sample(
      Math.min(index * SETTINGS.spacingMeters, section.route.lengthMeters),
      point,
    );
    point
      .applyAxisAngle(UP, section.pose.yawRadians)
      .add(section.pose.position);
    points.push(point);
  }
  return points;
}

// 2. Movement-based tolerance; gaze and elapsed time cannot trigger recovery
class FlightDeviation {
  private readonly previous = new Vector3();
  private readonly segment = new Line3();
  private readonly closest = new Vector3();
  private outsideMeters = 0;

  constructor(
    private readonly points: readonly Vector3[],
    entry: Readonly<Vector3>,
    private readonly parameters: DeviationParameters,
  ) {
    this.previous.copy(entry);
  }

  readonly update = (position: Readonly<Vector3>): boolean => {
    const moved = this.previous.distanceTo(position);
    this.previous.copy(position);
    if (moved === 0) return false;
    const outside =
      this.distanceToRoute(position) > this.parameters.distanceMeters;
    if (moved > this.parameters.maximumStepMeters) return outside;
    this.outsideMeters = outside ? this.outsideMeters + moved : 0;
    return this.outsideMeters >= this.parameters.outsideTravelMeters;
  };

  private distanceToRoute(position: Readonly<Vector3>): number {
    let distance = Infinity;
    for (let index = 1; index < this.points.length; index++) {
      const start = this.points[index - 1],
        end = this.points[index];
      if (!start || !end) continue;
      this.segment
        .set(start, end)
        .closestPointToPoint(position, true, this.closest);
      distance = Math.min(distance, this.closest.distanceTo(position));
    }
    return distance;
  }
}
