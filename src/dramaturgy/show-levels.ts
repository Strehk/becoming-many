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
 * Authored keyframed envelopes are the planned evolution of this ramp
 * (docs/direction/dramaturgy-audio.md); they replace it, not extend it.
 */
export const SENSE_FADE_SECONDS = 4;

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
