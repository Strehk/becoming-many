/**
 * Purpose: Verify where the closing credits panel is placed each frame.
 * Context: The panel rides ahead of the flight heading, not ahead of the gaze.
 * Responsibility: Cover the heading, the raised view axis, and degenerate rigs.
 * Boundary: The drawn texture needs a browser canvas and is accepted visually.
 */

import { expect, test } from "bun:test";
import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import {
  createEndCreditsPose,
  type EndCreditsPoseOptions,
} from "../../src/modules/end-credits/end-credits-pose";

const DISTANCE_METERS = 3.2;
const VIEW_PITCH_DEGREES = 30;

const LEVEL_VIEW: EndCreditsPoseOptions = {
  distanceMeters: DISTANCE_METERS,
  viewPitchDegrees: 0,
};

const RAISED_VIEW: EndCreditsPoseOptions = {
  distanceMeters: DISTANCE_METERS,
  viewPitchDegrees: VIEW_PITCH_DEGREES,
};

function quaternionFrom(pitchDegrees: number, yawDegrees: number): Quaternion {
  return new Quaternion().setFromEuler(
    new Euler(
      MathUtils.degToRad(pitchDegrees),
      MathUtils.degToRad(yawDegrees),
      0,
      "YXZ",
    ),
  );
}

test("places the panel ahead of an unrotated rig at eye height", () => {
  const pose = createEndCreditsPose(LEVEL_VIEW);
  const eye = new Vector3(4, 12, -7);

  pose.place(eye, new Quaternion());

  expect(pose.position.x).toBeCloseTo(4, 6);
  expect(pose.position.y).toBeCloseTo(12, 6);
  expect(pose.position.z).toBeCloseTo(-7 - DISTANCE_METERS, 6);
  expect(pose.lookTarget).toEqual(eye);
});

test("follows the rig heading around the yaw", () => {
  const pose = createEndCreditsPose(LEVEL_VIEW);
  const eye = new Vector3(0, 5, 0);

  pose.place(eye, quaternionFrom(0, 90));

  expect(pose.position.x).toBeCloseTo(-DISTANCE_METERS, 6);
  expect(pose.position.z).toBeCloseTo(0, 6);
});

// The rendered view is raised above the rig's horizontal forward, so a panel
// left at true eye level would sit below everything the visitor looks at.
test("raises the panel onto the rendered view axis", () => {
  const pose = createEndCreditsPose(RAISED_VIEW);
  const eye = new Vector3(0, 5, 0);

  pose.place(eye, new Quaternion());

  const pitchRadians = MathUtils.degToRad(VIEW_PITCH_DEGREES);
  expect(pose.position.y - eye.y).toBeCloseTo(
    DISTANCE_METERS * Math.sin(pitchRadians),
    6,
  );
  expect(pose.position.z).toBeCloseTo(
    -DISTANCE_METERS * Math.cos(pitchRadians),
    6,
  );
});

test("keeps the panel a constant distance from the eye", () => {
  const eye = new Vector3(0, 9, 0);

  for (const options of [LEVEL_VIEW, RAISED_VIEW]) {
    const pose = createEndCreditsPose(options);
    pose.place(eye, quaternionFrom(-40, 25));

    // Flattened: a rig aimed downward moves the panel around the heading, not
    // off the view axis the panel is meant to sit on.
    expect(pose.position.distanceTo(eye)).toBeCloseTo(DISTANCE_METERS, 6);
  }
});

test("holds the last heading when the rig points straight down", () => {
  const pose = createEndCreditsPose(LEVEL_VIEW);
  const eye = new Vector3(0, 5, 0);

  pose.place(eye, quaternionFrom(0, 90));
  pose.place(eye, quaternionFrom(-90, 90));

  expect(pose.position.x).toBeCloseTo(-DISTANCE_METERS, 6);
  expect(pose.position.y).toBeCloseTo(5, 6);
  expect(pose.position.z).toBeCloseTo(0, 6);
});

test("opens facing forward before any heading has been read", () => {
  const pose = createEndCreditsPose(LEVEL_VIEW);
  const eye = new Vector3(0, 0, 0);

  pose.place(eye, quaternionFrom(-90, 0));

  expect(pose.position.z).toBeCloseTo(-DISTANCE_METERS, 6);
});

test("allocates nothing after the first placement", () => {
  const pose = createEndCreditsPose(RAISED_VIEW);
  const eye = new Vector3(1, 2, 3);
  const firstPosition = pose.position;

  pose.place(eye, new Quaternion());
  pose.place(eye, quaternionFrom(0, 45));

  expect(pose.position).toBe(firstPosition);
});
