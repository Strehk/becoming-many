import type {
  ExercisePose,
  ExerciseRoute,
  PlacedRoute,
} from "../start-contract";

// 1. One bounded route owner; connection geometry is injected by the local star.
type ConnectRoute = (
  previous: PlacedRoute,
  next: ExerciseRoute,
) => ExercisePose;

/** Append-only placement within a course; only an explicit begin starts elsewhere. */
export function createFlightCourse(connect: ConnectRoute) {
  let tail: PlacedRoute | undefined;
  return {
    begin(entry: PlacedRoute): void {
      tail = entry;
    },
    append(route: ExerciseRoute): PlacedRoute {
      if (!tail) throw new Error("Begin the flight course before appending");
      const section = { route, pose: connect(tail, route) };
      tail = section;
      return section;
    },
    clear(): void {
      tail = undefined;
    },
  };
}
