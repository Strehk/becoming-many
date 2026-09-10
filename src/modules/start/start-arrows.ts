import { Vector3 } from "three";
import type { Viewpoint } from "../../world/viewpoint";
import { START_SETTINGS } from "./start-settings";

/** Own two reusable cue poses/lifetimes; Start supplies Course's newly calculated pose. */
export class StartArrows {
  readonly current = createArrow();
  readonly retiring = createArrow();
  private readonly arrows = [this.current, this.retiring];
  private readonly offset = new Vector3();

  constructor(
    private readonly viewpoint: Viewpoint,
    private readonly lengthMeters: number,
  ) {}

  /** Preserve the old cue before Start places the next pose. */
  replace(): void {
    const { current, retiring } = this;
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

  /** Advance retirement in playing seconds; a freshly placed cue keeps its first frame intact. */
  update(elapsedSeconds: number, justPlaced: boolean): void {
    if (elapsedSeconds <= 0) return;
    for (const arrow of this.arrows) {
      if (arrow.presence <= 0 || (arrow === this.current && justPlaced))
        continue;
      this.updateArrow(arrow, elapsedSeconds);
    }
  }

  /** Clear both lifetimes without replacing their borrowed pose vectors. */
  reset(): void {
    for (const arrow of this.arrows) Object.assign(arrow, createLifetime());
  }

  private updateArrow(
    arrow: typeof this.current,
    elapsedSeconds: number,
  ): void {
    this.offset.copy(arrow.position).sub(this.viewpoint.worldPosition);
    if (arrow.fadeSeconds < 0) {
      const inView =
        this.offset.angleTo(this.viewpoint.worldDirection) <
        this.viewpoint.viewHalfAngleRadians +
          Math.atan2(this.lengthMeters / 2, this.offset.length());
      arrow.outsideSeconds = inView ? 0 : arrow.outsideSeconds + elapsedSeconds;
      if (arrow.outsideSeconds < START_SETTINGS.arrowOutOfViewSeconds) return;
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

function createArrow() {
  return {
    position: new Vector3(),
    normal: new Vector3(),
    up: new Vector3(),
    ...createLifetime(),
  };
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
