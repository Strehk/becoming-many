/**
 * Purpose: Give a voice a room to sound in: a delay for distance and a reverb
 *   for the space that delay is standing in.
 * Context: Four of the composed voices carry their own room. It is deliberately
 *   not the organ's shared reverb: here the delay time is the distance to the
 *   wall, and each voice measures a different room.
 * Responsibility: Build the dry, echo, and reverb paths and their mix.
 * Boundary: The source feeding it and its lifetime belong to the voice.
 *
 * Signal flow, all three paths summing into the voice bus:
 *
 *   source -> dry ------------------------> bus
 *          |-> delay -> echo mix ---------> bus
 *          |-> reverb -> reverb mix ------> bus
 *              ^-- the delay feeds it too, so echoes stand inside the room.
 */

import { FeedbackDelay, Freeverb, Gain, type InputNode } from "tone";

/** Normalized delay maps to this window: at the wall, or across a canyon. */
const MIN_DELAY_SECONDS = 0.02;
const DELAY_RANGE_SECONDS = 0.7;

/** Feedback never reaches one, so a repeat always dies out. */
const MAX_FEEDBACK = 0.88;

/** Soft walls swallow the highs, hard ones throw everything back. */
const MIN_DAMPENING_HERTZ = 500;
const DAMPENING_RANGE_HERTZ = 8000;

/** Every value below is 0..1, the range all of the organ's controls speak in. */
export interface EchoRoomSettings {
  readonly delay: number; // Distance to the wall.
  readonly repeats: number; // How often the call comes back.
  readonly echoMix: number; // How much of the delay reaches the bus.
  readonly reverbMix: number; // How much of the room reaches the bus.
  readonly roomSize: number;
  readonly wallHardness: number;
  readonly dryMix?: number; // Defaults to the full direct signal.
}

export interface EchoRoom {
  /** Where the voice sends its sound. */
  readonly input: Gain;

  /** Move the wall. Only the sonar voice does, from its pad. */
  readonly setDelay: (delay: number) => void;

  readonly dispose: () => void;
}

export function createEchoRoom(
  bus: InputNode,
  settings: EchoRoomSettings,
): EchoRoom {
  const input = new Gain(1);
  const dry = new Gain(settings.dryMix ?? 1);
  const delay = new FeedbackDelay({
    delayTime: MIN_DELAY_SECONDS + settings.delay * DELAY_RANGE_SECONDS,
    feedback: settings.repeats * MAX_FEEDBACK,
    wet: 1,
    maxDelay: 2,
  });
  const echoMix = new Gain(settings.echoMix);
  const reverb = new Freeverb({
    roomSize: 0.2 + settings.roomSize * 0.75,
    dampening:
      MIN_DAMPENING_HERTZ + settings.wallHardness * DAMPENING_RANGE_HERTZ,
  });
  reverb.wet.value = 1;
  const reverbMix = new Gain(settings.reverbMix);

  input.connect(dry);
  dry.connect(bus);
  input.connect(delay);
  delay.connect(echoMix);
  echoMix.connect(bus);
  input.connect(reverb);
  delay.connect(reverb);
  reverb.connect(reverbMix);
  reverbMix.connect(bus);

  return {
    input,

    setDelay: (value): void => {
      delay.delayTime.rampTo(
        MIN_DELAY_SECONDS + value * DELAY_RANGE_SECONDS,
        0.15,
      );
    },

    dispose: (): void => {
      for (const node of [input, dry, delay, echoMix, reverb, reverbMix]) {
        node.dispose();
      }
    },
  };
}
