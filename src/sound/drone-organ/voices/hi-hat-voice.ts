/**
 * Purpose: A fast metallic hiss — a swarm landing on metal.
 * Context: The connections world's top end, above the poly rhythm.
 * Responsibility: Build the metal body, its high-pass, its room, and the
 *   eight-step figure that plays it.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { dbToGain, Envelope, Filter, FMOscillator, Gain, Scale } from "tone";
import { stepRandom } from "../organ-random";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import type { OrganVoice, VoiceContext } from "./organ-voice";

/** Steps in the figure; the open hit lands on its off-beats. */
const FIGURE_STEPS = 8;

/** Hash channels of the three rolls one hit makes. */
const CHANNEL = { scatter: 40, open: 41, velocity: 42 } as const;

/** The six inharmonic partials of a struck metal body. */
const PARTIAL_RATIOS = [1, 1.483, 1.932, 2.546, 2.63, 3.897] as const;

/** Where the body's high-pass rests, and how far each hit sweeps it open. */
const RESONANCE_HERTZ = 4000;
const RESONANCE_OCTAVES = 1.5;
const MODULATION_INDEX = 32;
const VOLUME_DECIBELS = -22;

export interface HiHatSettings {
  readonly openness: number; // 0..1 how often and how far the hat opens.
  readonly closedness: number; // 0..1 how long a closed hit rings.
  readonly metal: number; // 0..1 harmonicity of the metal body.
  readonly body: number; // 0..1 pitch of the struck body.
  readonly accent: number; // 0..1 how much the off-beats duck.
  readonly scatter: number; // 0..1 how much the figure is thinned and dented.
  readonly room: EchoRoomSettings;
}

export function createHiHatVoice(
  bus: Gain,
  context: VoiceContext,
  settings: HiHatSettings,
): OrganVoice {
  const { salt } = context;
  const hitSeconds = context.harmony.pulseSeconds / 16;
  const bodyHertz = 120 + settings.body * 500;

  // Six detuned squares through a swept high-pass: the classic hi-hat recipe,
  // and what a swarm needs — many fast metallic events rather than a tone.
  // The partials are built and started once and run for the voice's whole
  // life; a hit only opens the envelope. A synth that starts fresh
  // oscillators on every strike leaves each one connected to its long-lived
  // pitch signal, so the audio graph grows with every hit and every later
  // connection gets slower — which is what made the finale stutter.
  const output = new Gain(dbToGain(VOLUME_DECIBELS));
  const amplitude = new Gain(0).connect(output);
  const resonance = new Filter({ type: "highpass", Q: 0 }).connect(amplitude);
  const envelope = new Envelope({
    attack: 0.001,
    attackCurve: "linear",
    decay: 0.05,
    sustain: 0,
    release: 0.01,
  });
  const sweep = new Scale(
    RESONANCE_HERTZ,
    RESONANCE_HERTZ * 2 ** RESONANCE_OCTAVES,
  );
  envelope.chain(sweep, resonance.frequency);
  envelope.connect(amplitude.gain);
  const partials = PARTIAL_RATIOS.map((ratio) =>
    new FMOscillator({
      frequency: bodyHertz * ratio,
      type: "square",
      modulationType: "square",
      harmonicity: 1.2 + settings.metal * 9,
      modulationIndex: MODULATION_INDEX,
    }).connect(resonance),
  );
  // The partials start with the first hit, so a voice that never plays in a
  // show never runs them.
  let partialsRunning = false;

  const highPass = new Filter(6000, "highpass");
  const room = createEchoRoom(bus, settings.room);
  output.chain(highPass, room.input);

  const track = context.lane.addSteps(0.13, (hit, time) => {
    const step = hit % FIGURE_STEPS;

    // Scatter eats a hit now and then — a swarm does not count along.
    if (
      settings.scatter > 0 &&
      stepRandom(hit, CHANNEL.scatter, salt) < settings.scatter * 0.22
    ) {
      return;
    }

    if (!partialsRunning) {
      for (const partial of partials) partial.start(time);
      partialsRunning = true;
    }

    const isOpen =
      settings.openness > 0 &&
      (step === 3 || step === 7) &&
      stepRandom(hit, CHANNEL.open, salt) < settings.openness;
    envelope.decay = isOpen
      ? 0.06 + settings.openness * 0.4
      : 0.008 + settings.closedness * 0.07;
    const stress = step % 4 === 0 ? 1 : 1 - settings.accent * 0.55;
    const velocity = Math.max(
      0.05,
      stress *
        (1 - stepRandom(hit, CHANNEL.velocity, salt) * settings.scatter) *
        0.9,
    );
    envelope.triggerAttackRelease(hitSeconds, time, velocity);
  });

  return {
    setPad: (x, y): void => {
      track.setStepSeconds(0.25 - x * 0.2); // Four to twenty hits per second.
      highPass.frequency.rampTo(1500 + y * 10000, 0.15);
    },

    dispose: (): void => {
      room.dispose();
      for (const partial of partials) partial.dispose();
      for (const node of [envelope, sweep, resonance, amplitude, output]) {
        node.dispose();
      }
      highPass.dispose();
    },
  };
}
