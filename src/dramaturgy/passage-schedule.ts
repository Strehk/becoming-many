/**
 * Purpose: Define the authored animal passages and answer which one is flying when.
 * Context: A passage announces the sense whose animal names it, across a cue boundary.
 * Responsibility: Own the passage contract and the pure show-time lookup.
 * Boundary: Routes, models, and the flight itself live in the Animal Passages module.
 */

/**
 * The animals that cross the show. Each is named after the sense it announces:
 * the bat before Echolocation, the mosquitoes before Motion Perception, the
 * bird before Magnetic Field Perception — the three levels `docs/experience.md`
 * gives an animal as inspiration. Scent, Thermal, and Connections carry no
 * passage; that is authored absence, not an omission.
 */
export type PassageId = "bat" | "mosquitoes" | "bird";

/** One authored crossing placed on the show timeline. */
export interface AnimalPassage {
  /** Names the animal; the module resolves it to a route and a model. */
  readonly passageId: PassageId;
  /** Show time the animal enters. */
  readonly atSeconds: number;
  /**
   * How long the crossing runs, entry through exit. A passage carries its own
   * duration where a narration cue deliberately does not: a cue takes the slot
   * up to the next cue because the same section runs longer in one language
   * than the other, while a passage is an authored movement of fixed length in
   * both. Without it there is no progress to derive.
   */
  readonly durationSeconds: number;
}

/**
 * The passage facet of the one show schedule. It lives beside the narration
 * facet in `piece-schedule.ts`, which stays the single authored data file for
 * the piece — one schedule authority, two facets.
 */
export interface PassageSchedule {
  /** Ordered by `atSeconds`. Passages may not overlap. */
  readonly passages: readonly AnimalPassage[];
}

/**
 * How far one passage has flown at a show time, in 0..1, or undefined while it
 * is not crossing. Progress is derived from the asked instant rather than
 * accumulated, exactly like `senseIntensityAt`, so scrubbing into a passage
 * lands the animal at the point on its route where playing through would have
 * put it — the reason this is a schedule lookup and not a trigger.
 *
 * A passage is flying from its start up to but not including its end, so the
 * returned progress never reaches one and the animal is away at the end.
 */
export function passageProgressAt(
  schedule: PassageSchedule,
  passageId: PassageId,
  showTimeSeconds: number,
): number | undefined {
  for (const passage of schedule.passages) {
    if (passage.passageId !== passageId) continue;

    const elapsed = showTimeSeconds - passage.atSeconds;
    if (elapsed < 0 || elapsed >= passage.durationSeconds) continue;
    return elapsed / passage.durationSeconds;
  }
  return undefined;
}

/**
 * Reject a schedule that could not be staged: passages must run forwards, in
 * order, and one at a time. Two animals crossing at once would fight for the
 * same moment, and the module would have to decide which one the visitor is
 * meant to be watching — a decision that belongs in the authored data.
 */
export function validatePassageSchedule(schedule: PassageSchedule): void {
  let previousEnd = Number.NEGATIVE_INFINITY;

  for (const passage of schedule.passages) {
    if (passage.durationSeconds <= 0) {
      throw new RangeError(
        `Passage "${passage.passageId}" needs a positive duration`,
      );
    }
    if (passage.atSeconds < previousEnd) {
      throw new RangeError(
        `Passage "${passage.passageId}" overlaps the passage before it`,
      );
    }
    previousEnd = passage.atSeconds + passage.durationSeconds;
  }
}
