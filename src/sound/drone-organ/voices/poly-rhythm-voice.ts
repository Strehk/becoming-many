/**
 * Purpose: Three euclidean voices running against one another.
 * Context: The connections world's pulse. Sixteen, twelve, and nine steps do
 *   not divide, so the combined pattern only repeats after 144 steps — it never
 *   sounds twice the same without anything being random.
 * Responsibility: Build the three drum voices, their patterns, and their room.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { Filter, type Gain, Loop, MembraneSynth, NoiseSynth } from "tone";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import type { OrganVoice } from "./organ-voice";

/** Step counts the three voices spread apart to at full spread. */
const STEP_COUNTS = [16, 12, 9] as const;

/** Transport grids the haste control chooses between. */
const HASTE_GRID = ["4n", "8n", "16n", "32n"] as const;

/**
 * Bjorklund's euclidean rhythm: `hits` beats spread as evenly as possible over
 * `steps` steps.
 */
function euclideanPattern(hits: number, steps: number): boolean[] {
  const pattern: boolean[] = [];
  let bucket = 0;
  for (let step = 0; step < steps; step += 1) {
    bucket += hits;
    if (bucket >= steps) {
      bucket -= steps;
      pattern.push(true);
    } else {
      pattern.push(false);
    }
  }
  return pattern;
}

interface RhythmVoice {
  steps: number;
  hits: number;
  position: number;
  pattern: boolean[];
  readonly fire: (time: number) => void;
}

export interface PolyRhythmSettings {
  readonly haste: number; // 0..1 which transport grid the three step on.
  readonly lowVoice: number; // 0..1 level of the membrane drum.
  readonly middleVoice: number; // 0..1 level of the pink-noise hit.
  readonly highVoice: number; // 0..1 level of the white-noise tick.
  readonly middleColour: number; // 0..1 centre of the middle voice's band.
  readonly room: EchoRoomSettings;
}

export function createPolyRhythmVoice(
  bus: Gain,
  settings: PolyRhythmSettings,
): OrganVoice {
  const room = createEchoRoom(bus, settings.room);
  const low = new MembraneSynth({
    pitchDecay: 0.04,
    octaves: 5,
    envelope: { attack: 0.001, decay: 0.3, sustain: 0 },
    volume: -6,
  });
  const middle = new NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -16,
  });
  const middleBand = new Filter(1200, "bandpass");
  middleBand.Q.value = 2.2;
  const high = new NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.0005, decay: 0.03, sustain: 0 },
    volume: -20,
  });
  const highBand = new Filter(6000, "bandpass");
  highBand.Q.value = 3;

  low.connect(room.input);
  middle.chain(middleBand, room.input);
  high.chain(highBand, room.input);

  const voices: RhythmVoice[] = [
    {
      steps: 16,
      hits: 5,
      position: 0,
      pattern: [],
      fire: (time) => low.triggerAttackRelease(58, "8n", time, 0.95),
    },
    {
      steps: 12,
      hits: 4,
      position: 0,
      pattern: [],
      fire: (time) => middle.triggerAttackRelease(0.06, time, 0.7),
    },
    {
      steps: 9,
      hits: 4,
      position: 0,
      pattern: [],
      fire: (time) => high.triggerAttackRelease(0.02, time, 0.6),
    },
  ];

  let density = 0.45;
  let spread = 0.5;
  const rebuildPatterns = (): void => {
    voices.forEach((voice, index) => {
      // Spread 0 puts all three on sixteen steps — one shared bar; spread 1
      // pulls them onto 16, 12, and 9 and lets them drift against each other.
      const target = STEP_COUNTS[index] ?? 16;
      voice.steps = Math.max(3, Math.round(16 + (target - 16) * spread));
      voice.hits = Math.max(
        1,
        Math.min(
          voice.steps,
          Math.round(1 + density * (voice.steps - 1) * 0.7),
        ),
      );
      voice.pattern = euclideanPattern(voice.hits, voice.steps);
    });
  };
  rebuildPatterns();

  const loop = new Loop((time) => {
    for (const voice of voices) {
      const index = voice.position % voice.steps;
      voice.position += 1;
      if (voice.pattern[index]) voice.fire(time);
    }
  }, "16n").start(0);

  loop.interval =
    HASTE_GRID[Math.floor(settings.haste * (HASTE_GRID.length - 0.001))] ??
    "16n";
  low.volume.rampTo(-40 + settings.lowVoice * 38, 0.1);
  middle.volume.rampTo(-46 + settings.middleVoice * 36, 0.1);
  high.volume.rampTo(-50 + settings.highVoice * 36, 0.1);
  middleBand.frequency.rampTo(300 + settings.middleColour * 3000, 0.1);

  return {
    setPad: (x, y): void => {
      density = x;
      spread = y;
      rebuildPatterns();
    },

    dispose: (): void => {
      loop.dispose();
      room.dispose();
      for (const node of [low, middle, middleBand, high, highBand]) {
        node.dispose();
      }
    },
  };
}
