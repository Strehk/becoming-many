/**
 * Purpose: A fast metallic hiss — a swarm landing on metal.
 * Context: The connections world's top end, above the poly rhythm.
 * Responsibility: Build the metal synth, its high-pass, its room, and the
 *   eight-step figure that plays it.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { Filter, type Gain, Loop, MetalSynth } from "tone";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import type { OrganVoice } from "./organ-voice";

/** Steps in the figure; the open hit lands on its off-beats. */
const FIGURE_STEPS = 8;

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
  settings: HiHatSettings,
): OrganVoice {
  // Six detuned squares through a band-pass: the classic hi-hat recipe, and
  // what a swarm needs — many fast metallic events rather than a tone.
  const hat = new MetalSynth({
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    volume: -22,
  });
  // The struck pitch is a signal rather than an option; every hit sets it
  // again below, so this is only where the body starts out.
  hat.frequency.value = 250;
  const highPass = new Filter(6000, "highpass");
  const room = createEchoRoom(bus, settings.room);
  hat.chain(highPass, room.input);

  hat.harmonicity = 1.2 + settings.metal * 9;
  // The pitch travels with every hit rather than on the synth's frequency:
  // `triggerAttackRelease` sets that parameter itself on each strike, so a
  // ramped value would be overwritten before it were heard.
  const bodyHertz = 120 + settings.body * 500;

  let position = 0;
  const loop = new Loop((time) => {
    const step = position % FIGURE_STEPS;
    position += 1;

    // Scatter eats a hit now and then — a swarm does not count along.
    if (settings.scatter > 0 && Math.random() < settings.scatter * 0.22) return;

    const isOpen =
      settings.openness > 0 &&
      (step === 3 || step === 7) &&
      Math.random() < settings.openness;
    hat.envelope.decay = isOpen
      ? 0.06 + settings.openness * 0.4
      : 0.008 + settings.closedness * 0.07;
    const stress = step % 4 === 0 ? 1 : 1 - settings.accent * 0.55;
    const velocity = Math.max(
      0.05,
      stress * (1 - Math.random() * settings.scatter) * 0.9,
    );
    hat.triggerAttackRelease(bodyHertz, "64n", time, velocity);
  }, 0.13).start(0);

  return {
    setPad: (x, y): void => {
      loop.interval = 0.25 - x * 0.2; // Four to twenty hits per second.
      highPass.frequency.rampTo(1500 + y * 10000, 0.15);
    },

    dispose: (): void => {
      loop.dispose();
      room.dispose();
      for (const node of [hat, highPass]) node.dispose();
    },
  };
}
