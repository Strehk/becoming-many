/**
 * Purpose: Carry show time into the organ: every rhythmic voice steps on a
 *   grid the show clock owns, placed onto audio time just ahead of playing.
 * Context: The show clock is the one authority for time in the piece. Tone's
 *   own transport was the organ's second clock; this replaces it with a
 *   follower that has no clock of its own.
 * Responsibility: Own the lanes and tracks, the lookahead, and the mapping
 *   from a step's show time to the audio time it is played at.
 * Boundary: Reading the audio clock is injected, so all of this is pure; what
 *   a step plays belongs to the voice.
 */

import { createStepSequencer, type StepSequencer } from "./step-sequencer";

/** What the show hands the organ each frame about time. */
export interface OrganClock {
  readonly showTimeSeconds: number;
  /** False while held; nothing is placed and the grids wait where they are. */
  readonly isPlaying: boolean;
  /** Show seconds per audio second. Notes squeeze and stretch with it. */
  readonly timeScale: number;
}

/** Play a step: its index on the grid, and the audio time to play it at. */
export type StepFire = (stepIndex: number, audioTimeSeconds: number) => void;

export interface StepTrack {
  readonly setStepSeconds: (stepSeconds: number) => void;
}

/**
 * One layer's tracks together. A silent layer puts its lane to sleep, so a
 * voice nobody hears schedules nothing; when it wakes, its grids start fresh
 * from the playhead.
 */
export interface OrganLane {
  readonly addSteps: (stepSeconds: number, fire: StepFire) => StepTrack;
  readonly setActive: (isActive: boolean) => void;
  readonly dispose: () => void;
}

export interface OrganTimeline {
  readonly follow: (clock: OrganClock) => void;
  readonly createLane: () => OrganLane;
}

/**
 * How far ahead of the playhead steps are placed, in show seconds. Longer
 * than a frame at any rate the show runs, so a step is never asked for late;
 * short enough that a held show lets at most this much through.
 */
export const STEP_LOOKAHEAD_SECONDS = 0.15;

interface Track {
  readonly sequencer: StepSequencer;
  readonly visit: (stepIndex: number, stepShowTimeSeconds: number) => void;
  isActive: boolean;
}

export function createOrganTimeline(
  readAudioTimeSeconds: () => number,
  lookaheadSeconds = STEP_LOOKAHEAD_SECONDS,
): OrganTimeline {
  const tracks = new Set<Track>();
  // The instant being followed, shared by every track's visitor so following
  // allocates nothing per frame.
  let showTimeSeconds = 0;
  let audioTimeSeconds = 0;
  let timeScale = 1;

  return {
    follow: (clock): void => {
      if (!clock.isPlaying || !(clock.timeScale > 0)) return;

      showTimeSeconds = clock.showTimeSeconds;
      timeScale = clock.timeScale;
      audioTimeSeconds = readAudioTimeSeconds();
      for (const track of tracks) {
        if (!track.isActive) continue;
        track.sequencer.advance(showTimeSeconds, lookaheadSeconds, track.visit);
      }
    },

    createLane: (): OrganLane => {
      const laneTracks: Track[] = [];
      let isActive = true;

      return {
        addSteps: (stepSeconds, fire): StepTrack => {
          const sequencer = createStepSequencer(stepSeconds);
          const track: Track = {
            sequencer,
            visit: (stepIndex, stepShowTimeSeconds): void => {
              fire(
                stepIndex,
                audioTimeSeconds +
                  (stepShowTimeSeconds - showTimeSeconds) / timeScale,
              );
            },
            isActive,
          };
          laneTracks.push(track);
          tracks.add(track);
          return { setStepSeconds: sequencer.setStepSeconds };
        },

        setActive: (active): void => {
          if (active === isActive) return;

          isActive = active;
          for (const track of laneTracks) {
            track.isActive = active;
            if (active) track.sequencer.reset();
          }
        },

        dispose: (): void => {
          for (const track of laneTracks) tracks.delete(track);
          laneTracks.length = 0;
        },
      };
    },
  };
}
