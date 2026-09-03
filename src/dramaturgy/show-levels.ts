/**
 * Purpose: Answer which world state and sense strengths hold at a show time.
 * Context: Schedule cues carry the level; senses fade in from cue boundaries.
 * Responsibility: Own the sense ladder, the fade constant, and pure lookups.
 * Boundary: Presets, modules, and how intensities reach the GPU live elsewhere.
 */

import type { NarrationSchedule, ShowLevelName } from "./narration-schedule";

/** Every layered sense, named after the level that introduces it. */
export type ShowSense =
  | "scent"
  | "echo"
  | "motion"
  | "thermal"
  | "magnetic"
  | "connections";

const SENSE_LADDER: readonly ShowSense[] = [
  "scent",
  "echo",
  "motion",
  "thermal",
  "magnetic",
  "connections",
];

/**
 * Which senses each world state carries. "Senses layer, never swap": every
 * level keeps the senses of the level before it, so the ladder is a prefix
 * per level rather than a free set. White World carries none; the level
 * presets in `src/levels` enable the same senses through their module blocks.
 */
export const SHOW_LEVEL_SENSES: Record<ShowLevelName, readonly ShowSense[]> = {
  "white-world": SENSE_LADDER.slice(0, 0),
  scent: SENSE_LADDER.slice(0, 1),
  echo: SENSE_LADDER.slice(0, 2),
  motion: SENSE_LADDER.slice(0, 3),
  thermal: SENSE_LADDER.slice(0, 4),
  magnetic: SENSE_LADDER.slice(0, 5),
  connections: SENSE_LADDER,
};

/**
 * How long a sense takes to reach its new strength after a cue boundary. One
 * shared dramaturgy constant: each fade starts exactly at its cue's
 * `atSeconds`, so the sense grows in under the narration that names it.
 * This derived ramp is the current complete intensity model.
 */
export const SENSE_FADE_SECONDS = 4;

/**
 * How long before a sense first carries strength its content already runs,
 * hidden. A gated module builds nothing while its sense is down: its chunk
 * window stops following the viewer and its actors stop moving, so at the cue
 * boundary the whole layer would have to stream and re-home from scratch — and
 * it would arrive in pieces under a fade that is already climbing, which is
 * exactly what reads as popping. Warming stands the layer up early and
 * invisible, so the fade only has to raise something already complete.
 *
 * The window must stay shorter than the shortest cue slot, or a sense would
 * begin warming before the cue it is warming behind; `piece-schedule.test.ts`
 * holds the authored piece to that bound.
 */
export const SENSE_PREWARM_SECONDS = 20;

/**
 * The world state holding at a show time. A cue's level holds until the next
 * cue starts, exactly like its recording; before the first cue the show
 * already stands in that cue's level, so the lead-in opens the first world.
 * Undefined only for a schedule with no cues.
 */
export function showLevelAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): ShowLevelName | undefined {
  let holding = schedule.narration[0];
  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;
    holding = cue;
  }
  return holding?.level;
}

/** One world-state crossing: what the show is fading from, to, and how far. */
export interface LevelTransition {
  /** The world state before the most recent cue boundary. */
  readonly from: ShowLevelName;
  /** The world state the schedule now calls for. */
  readonly to: ShowLevelName;
  /** 0..1 progress of the crossing; 1 once the fade window has passed. */
  readonly progress: number;
}

/**
 * The world-state crossing in effect at a show time, for values that blend
 * between levels rather than belonging to one sense — the background color
 * above all. Before the first cue `from` equals `to`, so the progress does
 * not matter there; after a boundary the progress climbs to one over the fade
 * window and stays there. Cue slots are far longer than the fade, so a
 * boundary landing inside a still-running fade is not modeled: `from` is
 * simply the previous cue's level. Undefined only for a schedule with no
 * cues.
 */
export function levelTransitionAt(
  schedule: NarrationSchedule,
  showTimeSeconds: number,
): LevelTransition | undefined {
  let holding = schedule.narration[0];
  let previous = schedule.narration[0];
  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;
    previous = holding;
    holding = cue;
  }
  if (!holding || !previous) return undefined;

  const elapsed = showTimeSeconds - holding.atSeconds;
  const progress =
    elapsed >= SENSE_FADE_SECONDS
      ? 1
      : Math.max(elapsed / SENSE_FADE_SECONDS, 0);
  return { from: previous.level, to: holding.level, progress };
}

/**
 * One sense's strength at a show time, in 0..1. Each cue boundary sets a new
 * target — one when the cue's level carries the sense, zero when it does not —
 * and the strength moves linearly from wherever it stood at the boundary to
 * that target over `SENSE_FADE_SECONDS`. The value is derived purely from the
 * schedule and the asked instant, never accumulated, so a seek or scrub lands
 * mid-fade exactly where playing through would have.
 */
export function senseIntensityAt(
  schedule: NarrationSchedule,
  sense: ShowSense,
  showTimeSeconds: number,
): number {
  // The show opens with no senses; the first cue's boundary raises them.
  let rampStartSeconds = 0;
  let rampStartValue = 0;
  let rampTarget = 0;

  for (const cue of schedule.narration) {
    if (cue.atSeconds > showTimeSeconds) break;

    rampStartValue = rampValueAt(
      rampStartSeconds,
      rampStartValue,
      rampTarget,
      cue.atSeconds,
    );
    rampStartSeconds = cue.atSeconds;
    rampTarget = SHOW_LEVEL_SENSES[cue.level].includes(sense) ? 1 : 0;
  }

  return rampValueAt(
    rampStartSeconds,
    rampStartValue,
    rampTarget,
    showTimeSeconds,
  );
}

/** What a sense's content is doing at a show time. */
export type SenseStanding =
  /** Nothing of the sense exists; its modules stay put away. */
  | "away"
  /** Building and following the viewer, with nothing on screen yet. */
  | "warming"
  /** Carrying strength: the sense is on screen, fading in, out, or held. */
  | "live";

/**
 * Whether a sense's content must be running at a show time, and whether it may
 * be seen. Derived from the same ramp the strengths are, one prewarm window
 * ahead, so a seek lands a warming layer exactly as playing through would have
 * — and a jump straight into a cue gets no warming, because there is no show
 * time before it in which to warm.
 */
export function senseStandingAt(
  schedule: NarrationSchedule,
  sense: ShowSense,
  showTimeSeconds: number,
): SenseStanding {
  if (senseIntensityAt(schedule, sense, showTimeSeconds) > 0) return "live";

  const warmed = senseIntensityAt(
    schedule,
    sense,
    showTimeSeconds + SENSE_PREWARM_SECONDS,
  );
  return warmed > 0 ? "warming" : "away";
}

function rampValueAt(
  rampStartSeconds: number,
  rampStartValue: number,
  rampTarget: number,
  atSeconds: number,
): number {
  const elapsed = atSeconds - rampStartSeconds;
  if (elapsed >= SENSE_FADE_SECONDS) return rampTarget;
  if (elapsed <= 0) return rampStartValue;

  return (
    rampStartValue +
    ((rampTarget - rampStartValue) * elapsed) / SENSE_FADE_SECONDS
  );
}
