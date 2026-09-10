import { Vector3 } from "three";
import type { Viewpoint } from "../../world/viewer-rig";
import type { StartArrowFrame } from "./start-particle-frame";
import { START_SETTINGS } from "./start-settings";

/** Own two reusable cue lifetimes. Course writes the current pose; the retired pose stays fixed. */
export function createStartArrows(
  viewpoint: Viewpoint,
  lengthMeters: number,
  pose: Pick<StartArrowFrame, "position" | "normal" | "up">,
) {
  const current = { ...pose, ...createLifetime() };
  const retiring = {
    position: new Vector3(),
    normal: new Vector3(),
    up: new Vector3(),
    ...createLifetime(),
  };
  const arrows = [current, retiring];
  const offset = new Vector3();
  return { current, retiring, replace, update, resetArrows };

  /** Preserve the old cue before Course overwrites the current pose. */
  function replace(): void {
    if (current.presence > 0) {
      retiring.position.copy(current.position);
      retiring.normal.copy(current.normal);
      retiring.up.copy(current.up);
      retiring.presence = current.presence;
      retiring.formation = current.formation;
      retiring.outsideSeconds = current.outsideSeconds;
      retiring.fadeSeconds = current.fadeSeconds;
      retiring.releaseFormation =
        current.fadeSeconds >= 0 ? current.releaseFormation : current.formation;
    }
    Object.assign(current, createLifetime(), { presence: 1 });
  }

  /** Advance spatial retirement in playing seconds; a freshly placed cue gets its first frame intact. */
  function update(elapsedSeconds: number, justPlaced: boolean): void {
    if (elapsedSeconds <= 0) return;
    for (const arrow of arrows) {
      if (arrow.presence <= 0 || (arrow === current && justPlaced)) continue;
      offset.copy(arrow.position).sub(viewpoint.worldPosition);
      if (arrow.fadeSeconds < 0) {
        const inView =
          offset.angleTo(viewpoint.worldDirection) <
          viewpoint.viewHalfAngleRadians +
            Math.atan2(lengthMeters / 2, offset.length());
        arrow.outsideSeconds = inView
          ? 0
          : arrow.outsideSeconds + elapsedSeconds;
        if (arrow.outsideSeconds < START_SETTINGS.arrowOutOfViewSeconds)
          continue;
        arrow.fadeSeconds = 0;
        arrow.releaseFormation = arrow.formation;
      } else arrow.fadeSeconds += elapsedSeconds;
      arrow.presence = Math.max(
        0,
        1 - arrow.fadeSeconds / START_SETTINGS.arrowFadeSeconds,
      );
      arrow.formation = arrow.releaseFormation * arrow.presence;
    }
  }

  /** Clear both cue lifetimes without replacing their borrowed pose vectors. */
  function resetArrows(): void {
    for (const arrow of arrows) Object.assign(arrow, createLifetime());
  }
}

function createLifetime() {
  return {
    formation: 0,
    presence: 0,
    outsideSeconds: 0,
    fadeSeconds: -1,
    releaseFormation: 0,
  };
}
