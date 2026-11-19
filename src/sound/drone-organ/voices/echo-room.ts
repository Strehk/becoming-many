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

import {
  FeedbackDelay,
  Filter,
  Freeverb,
  Gain,
  type InputNode,
  Reverb,
} from "tone";

/** Normalized delay maps to this window: at the wall, or across a canyon. */
const MIN_DELAY_SECONDS = 0.02;
const DELAY_RANGE_SECONDS = 0.7;

/** Feedback never reaches one, so a repeat always dies out. */
const MAX_FEEDBACK = 0.88;

/** Soft walls swallow the highs, hard ones throw everything back. */
const MIN_DAMPENING_HERTZ = 500;
const DAMPENING_RANGE_HERTZ = 8000;

/**
 * Freeverb's eight comb filters each run as their own AudioWorklet: script on
 * the audio thread, eight per room. A computer carries that; a phone or a
 * headset browser runs out of audio time and crackles. Rooms built after this
 * call render the same tail natively instead: a convolution room of the decay
 * the comb feedback would give, with the wall's dampening as a lowpass. The
 * installation never calls it and keeps the composed Freeverb.
 */
let nativeRooms = false;
export function preferNativeRooms(): void {
  nativeRooms = true;
}

/** Freeverb's comb delays average about 34 ms with their stereo spread; feedback g decays 60 dB in 3·d / −log10 g. */
const COMB_SECONDS = 0.034;
function combDecaySeconds(feedback: number): number {
  return Math.max(0.1, (3 * COMB_SECONDS) / -Math.log10(feedback));
}
/** Eight combs add up, a convolution room is normalized: this evens the level. */
const NATIVE_ROOM_GAIN = 15;

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
  const roomSize = 0.2 + settings.roomSize * 0.75;
  const dampening =
    MIN_DAMPENING_HERTZ + settings.wallHardness * DAMPENING_RANGE_HERTZ;
  let reverb: Freeverb | Reverb;
  let walls: Filter | undefined;
  if (nativeRooms) {
    reverb = new Reverb({ decay: combDecaySeconds(roomSize), wet: 1 });
    walls = new Filter(dampening, "lowpass");
  } else {
    reverb = new Freeverb({ roomSize, dampening });
    reverb.wet.value = 1;
  }
  const reverbMix = new Gain(
    settings.reverbMix * (walls ? NATIVE_ROOM_GAIN : 1),
  );

  input.connect(dry);
  dry.connect(bus);
  input.connect(delay);
  delay.connect(echoMix);
  echoMix.connect(bus);
  input.connect(reverb);
  delay.connect(reverb);
  if (walls) reverb.chain(walls, reverbMix);
  else reverb.connect(reverbMix);
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
      for (const node of [input, dry, delay, echoMix, reverb, walls, reverbMix])
        node?.dispose();
    },
  };
}
