/**
 * Purpose: Answer where the credits panel sits and what it faces.
 * Context: The panel rides ahead of the course, not ahead of the gaze.
 * Responsibility: Turn one eye position and one rig heading into a panel pose.
 * Boundary: Meshes, materials, and the frame loop belong to the panel module.
 */

import { MathUtils, type Quaternion, Vector3 } from "three";

export interface EndCreditsPoseOptions {
  /** How far ahead of the eye the panel rides, along the rendered view axis. */
  readonly distanceMeters: number;
  /**
   * The comfort pitch the rendered view is raised by. The panel has to be
   * raised with it: placed at true eye level it would sit below everything
   * the visitor is actually looking at.
   */
  readonly viewPitchDegrees: number;
}

export interface EndCreditsPose {
  /** Where the panel's centre goes, in world space. Rewritten in place. */
  readonly position: Vector3;
  /** What the panel looks at, so it stays square to the viewer. */
  readonly lookTarget: Vector3;

  /**
   * Place the panel a fixed distance ahead along the flight heading, raised
   * onto the rendered view axis and turned to face the eye. The rig only ever
   * yaws, so its forward is the direction of travel: anchoring to that rather
   * than to the head lets the visitor look around the panel in the headset
   * while still flying toward it, instead of through one left standing in the
   * world.
   */
  readonly place: (
    eyeWorldPosition: Vector3,
    rigWorldQuaternion: Quaternion,
  ) => void;
}

/** One pose per panel, holding its own scratch so placement allocates nothing. */
export function createEndCreditsPose(
  options: EndCreditsPoseOptions,
): EndCreditsPose {
  const pitchRadians = MathUtils.degToRad(options.viewPitchDegrees);
  const forwardMeters = options.distanceMeters * Math.cos(pitchRadians);
  const riseMeters = options.distanceMeters * Math.sin(pitchRadians);

  const position = new Vector3();
  const lookTarget = new Vector3();
  const heading = new Vector3();
  // A rig aimed straight up or down flattens to nothing. Keeping the last
  // usable heading stops the panel snapping to an arbitrary axis for those
  // frames; the piece opens facing negative Z, so that is the first one.
  const lastHeading = new Vector3(0, 0, -1);

  return {
    position,
    lookTarget,

    place: (eyeWorldPosition, rigWorldQuaternion): void => {
      heading.set(0, 0, -1).applyQuaternion(rigWorldQuaternion);
      heading.y = 0;
      if (heading.lengthSq() < 1e-6) {
        heading.copy(lastHeading);
      } else {
        heading.normalize();
        lastHeading.copy(heading);
      }

      position.copy(eyeWorldPosition).addScaledVector(heading, forwardMeters);
      position.y = eyeWorldPosition.y + riseMeters;
      // Facing the eye rather than standing upright: the panel then meets the
      // raised view square on, which is what keeps it readable without the
      // visitor lowering their head against the comfort pitch.
      lookTarget.copy(eyeWorldPosition);
    },
  };
}
