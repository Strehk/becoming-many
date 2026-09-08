/**
 * Purpose: Verify route sampling and that the authored passages agree with the schedule.
 * Context: A passage's length in the schedule must be the length its flight actually takes.
 * Responsibility: Cover distance-spaced sampling and the definition-to-schedule contract.
 * Boundary: Loading a route file needs a browser and is exercised in the running app.
 */

import { describe, expect, test } from "bun:test";
import { Vector3 } from "three";
import { PIECE_PASSAGES } from "../../src/dramaturgy/piece-schedule";
import {
  BIRD_PASSAGE,
  MOSQUITO_PASSAGE,
  PASSAGE_FLIGHTS,
  type PassageFlightDefinition,
} from "../../src/modules/animal-passages/passage-definitions";
import {
  type PassageRoute,
  samplePassageRoute,
} from "../../src/modules/animal-passages/passage-route";

/** A straight ten-metre run over four seconds, spaced evenly by distance. */
const ROUTE: PassageRoute = {
  points: [new Vector3(0, 0, 0), new Vector3(5, 0, 0), new Vector3(10, 0, 0)],
  times: [0, 2, 4],
  durationSeconds: 4,
  distanceMeters: 10,
  endDirection: new Vector3(1, 0, 0),
};

describe("samplePassageRoute", () => {
  test("holds the ends outside the route's own window", () => {
    const target = new Vector3();
    expect(samplePassageRoute(ROUTE, -10, target).x).toBe(0);
    expect(samplePassageRoute(ROUTE, 0, target).x).toBe(0);
    expect(samplePassageRoute(ROUTE, 4, target).x).toBe(10);
    expect(samplePassageRoute(ROUTE, 99, target).x).toBe(10);
  });

  test("walks between the surrounding samples", () => {
    const target = new Vector3();
    expect(samplePassageRoute(ROUTE, 1, target).x).toBeCloseTo(2.5, 10);
    expect(samplePassageRoute(ROUTE, 2, target).x).toBeCloseTo(5, 10);
    expect(samplePassageRoute(ROUTE, 3, target).x).toBeCloseTo(7.5, 10);
  });

  test("reuses the target rather than allocating per sample", () => {
    const target = new Vector3();
    expect(samplePassageRoute(ROUTE, 1, target)).toBe(target);
  });
});

/** What a crossing actually takes: its entry, its route, and its departure. */
function flightSeconds(definition: PassageFlightDefinition): number {
  if (definition.routeDurationSeconds === undefined) {
    throw new Error(
      `Passage "${definition.passageId}" leaves its route length to the file, so the schedule cannot state it`,
    );
  }
  return (
    definition.approachDurationSeconds +
    definition.routeDurationSeconds +
    definition.exitDurationSeconds
  );
}

/** How long a scheduled passage actually takes, flown or swarming. */
function stagedSeconds(passageId: string): number {
  const flight = PASSAGE_FLIGHTS.find(
    (candidate) => candidate.passageId === passageId,
  );
  if (flight) return flightSeconds(flight);
  if (passageId === MOSQUITO_PASSAGE.passageId) {
    return MOSQUITO_PASSAGE.durationSeconds;
  }
  throw new Error(`Scheduled passage is staged by nothing: ${passageId}`);
}

describe("the authored passages", () => {
  /*
   * Every scheduled animal must be staged by something. One that is not would
   * leave the moment announcing a sense empty, with nothing at runtime saying
   * so — the mosquitoes were exactly that until their swarm existed.
   */
  test("are each staged, as a flight or as a swarm", () => {
    for (const passage of PIECE_PASSAGES.passages) {
      expect(() => stagedSeconds(passage.passageId)).not.toThrow();
    }
  });

  /*
   * The schedule states how long an animal is in the air, and the flight
   * spends exactly that long crossing. If the two drift apart the animal is
   * either cut off mid-departure or left hanging after it has gone.
   */
  test("are scheduled for exactly as long as they take to cross", () => {
    for (const passage of PIECE_PASSAGES.passages) {
      expect(passage.durationSeconds).toBeCloseTo(
        stagedSeconds(passage.passageId),
        5,
      );
    }
  });

  /*
   * The swarm has no body, so it needs a cloud instead of a model: points to
   * print, and a volume for them to move inside.
   */
  test("give the swarm a cloud to print instead of a model", () => {
    expect(MOSQUITO_PASSAGE.pointCount).toBeGreaterThan(0);
    expect(MOSQUITO_PASSAGE.cloudRadiusMeters).toBeGreaterThan(0);
    expect(MOSQUITO_PASSAGE.cloudHeightMeters).toBeGreaterThan(0);
    expect(MOSQUITO_PASSAGE.routeUrl).toStartWith("/passages/");
  });

  test("carry a model, a route, and a wingspan to scale it to", () => {
    for (const definition of PASSAGE_FLIGHTS) {
      expect(definition.modelUrl).toStartWith("/passages/");
      expect(definition.routeUrl).toStartWith("/passages/");
      expect(definition.wingspanMeters).toBeGreaterThan(0);
      expect(definition.exitDurationSeconds).toBeGreaterThan(0);
      expect(definition.modelForward.length()).toBeCloseTo(1, 10);
    }
  });

  /*
   * The bird announces the sense migratory birds navigate by, so its departure
   * has to mean something: it leaves due north. North is +Z with no
   * declination, as the Magnetic Sense field axis has it, and the route frame
   * holds world axes — so the authored bearing is read straight as a compass
   * direction. Its sweep around the visitor is deliberately left alone.
   */
  test("send the bird away due north without turning its sweep", () => {
    expect(BIRD_PASSAGE.departureBearingRadians).toBe(0);
    expect(BIRD_PASSAGE.frameYaw).toEqual({ kind: "world", radians: 0 });

    const north = new Vector3(
      Math.sin(BIRD_PASSAGE.departureBearingRadians ?? 0),
      0,
      Math.cos(BIRD_PASSAGE.departureBearingRadians ?? 0),
    );
    expect(north.z).toBeCloseTo(1, 10);
    expect(north.x).toBeCloseTo(0, 10);
  });

  /*
   * Only the bird carries a compass meaning. The bat crosses low and leaves on
   * whatever heading its route ends with, which is what an animal without one
   * does — giving it a bearing would be inventing dramaturgy.
   */
  test("leave every other passage on its own closing heading", () => {
    for (const definition of PASSAGE_FLIGHTS) {
      if (definition.passageId === "bird") continue;
      expect(definition.departureBearingRadians).toBeUndefined();
    }
  });

  /*
   * Only a passage with authored entry points flies an approach; without them
   * the entry duration would be time the animal spends nowhere.
   */
  test("give an approach duration only where entry points exist", () => {
    for (const definition of PASSAGE_FLIGHTS) {
      expect(definition.approachDurationSeconds > 0).toBe(
        definition.approachPoints.length > 0,
      );
    }
  });
});
