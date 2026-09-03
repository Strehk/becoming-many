/**
 * Purpose: Verify the raptor holds a place, and opens its next ring ahead.
 * Context: A soaring bird circles a thermal, not the visitor who happens to pass.
 * Responsibility: Cover the ring, its height, the hand-over, and the printed points.
 * Boundary: How a soaring bird reads from below is a visual acceptance.
 */

import { describe, expect, test } from "bun:test";
import { RAPTOR_DEFINITION } from "../../src/modules/motion-sense/raptor-definition";
import { createRaptorFlight } from "../../src/modules/motion-sense/raptor-flight";

const GROUND_Y = 6;

const createFlight = () =>
  createRaptorFlight({
    groundYAt: () => GROUND_Y,
    initialPlayerX: 0,
    initialPlayerZ: 0,
  });

describe("the raptor's ring", () => {
  test("stays behind while a visitor flies away from it", () => {
    const flight = createFlight();
    let playerZ = 0;
    let away = 0;
    for (let step = 0; step < 1800; step += 1) {
      playerZ += 5 / 60;
      flight.update(1 / 60, 0, playerZ);
      const body = readBody(flight);
      away = Math.hypot(body.x, body.z - playerZ);
    }

    // Two and a half minutes of flight at five metres a second. A ring that
    // followed would still be one radius away; a ring that is a place in the
    // world is left behind.
    expect(away).toBeGreaterThan(RAPTOR_DEFINITION.ringRadiusMeters * 2);
    expect(readBody(flight).y - GROUND_Y).toBeGreaterThan(
      RAPTOR_DEFINITION.heightAboveGroundMeters -
        RAPTOR_DEFINITION.ringRiseMeters -
        0.001,
    );
  });

  test("opens the next ring ahead of the way the visitor is going", () => {
    const flight = createFlight();
    let playerZ = 0;
    let previous = readBody(flight);
    let opened: { x: number; z: number } | undefined;

    for (let step = 0; step < 24000 && !opened; step += 1) {
      playerZ += 5 / 60;
      flight.update(1 / 60, 0, playerZ);
      const body = readBody(flight);
      // The hand-over is the one step a bird ever jumps: every other step it
      // moves a few centimetres along its ring.
      if (Math.hypot(body.x - previous.x, body.z - previous.z) > 20) {
        opened = { x: body.x, z: body.z - playerZ };
      }
      previous = body;
    }
    if (!opened) throw new Error("The ring never opened again");

    // Ahead, off to one side: a ring behind the traveller is one nobody flies
    // toward, and a bird nobody flies toward is a bird nobody meets.
    expect(opened.z).toBeGreaterThan(0);
    const spread =
      RAPTOR_DEFINITION.reopenSpreadRadians / 2 +
      Math.atan2(
        RAPTOR_DEFINITION.ringRadiusMeters,
        RAPTOR_DEFINITION.reopenReachMeters.minimum,
      );
    expect(Math.abs(Math.atan2(opened.x, opened.z))).toBeLessThanOrEqual(
      spread,
    );
  });

  test("prints a body and two wingtips, spread across the flight", () => {
    const flight = createFlight();
    for (let step = 0; step < 120; step += 1) flight.update(1 / 60, 0, 0);

    const points = flight.getWorldPositions();
    expect(points).toHaveLength(9);
    const span = Math.hypot(
      (points[3] ?? 0) - (points[6] ?? 0),
      (points[5] ?? 0) - (points[8] ?? 0),
    );
    expect(span).toBeCloseTo(RAPTOR_DEFINITION.wingSpanMeters, 5);

    const body = readBody(flight);
    expect(points[0]).toBe(body.x);
    expect(points[2]).toBe(body.z);
  });
});

function readBody(flight: ReturnType<typeof createRaptorFlight>) {
  const stream = flight.getBodyStream();
  return { x: stream[0] ?? 0, y: stream[1] ?? 0, z: stream[2] ?? 0 };
}
