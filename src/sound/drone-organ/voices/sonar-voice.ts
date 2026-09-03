/**
 * Purpose: The sonar: a call sent out in time, and the room answering it.
 * Context: The echo world's voice. Its pad is the distance to the wall, so what
 *   is heard is not the ping but how far away everything is standing.
 * Responsibility: Build the ping, the click, and the room they measure.
 * Boundary: Level, room send, and cutoff belong to the layer.
 */

import { Filter, type Gain, MembraneSynth, NoiseSynth } from "tone";
import { createEchoRoom, type EchoRoomSettings } from "./echo-room";
import type { OrganVoice, VoiceContext } from "./organ-voice";

/** Call spacing at the pad's extremes: far apart, or standing close in. */
const SLOWEST_CALL_SECONDS = 2.4;
const CALL_SPEED_RANGE_SECONDS = 2.15;

export interface SonarVoiceSettings {
  readonly returns: number; // 0..1 how often the call comes back.
  readonly callTone: number; // 0..1 pitch of the call itself.
  readonly click: number; // 0..1 level of the noise transient on the call.
  readonly edge: number; // 0..1 centre of the click's band.

  /** The room's distance is the pad, not a setting; everything else is here. */
  readonly room: Omit<EchoRoomSettings, "delay" | "repeats">;
}

export function createSonarVoice(
  bus: Gain,
  context: VoiceContext,
  settings: SonarVoiceSettings,
): OrganVoice {
  const callSeconds = context.harmony.pulseSeconds / 8;
  // The call is an edge rather than a note: nothing to hold on to, so what
  // the ear follows is the return.
  const ping = new MembraneSynth({
    pitchDecay: 0.012,
    octaves: 3,
    oscillator: { type: "triangle" },
    envelope: { attack: 0.001, decay: 0.07, sustain: 0 },
    volume: -6,
  });
  const click = new NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.0005, decay: 0.016, sustain: 0 },
    volume: -14,
  });
  const clickBand = new Filter(2600, "bandpass");
  clickBand.Q.value = 1.8;
  const room = createEchoRoom(bus, {
    ...settings.room,
    delay: 0, // The pad sets it before the first call sounds.
    repeats: settings.returns,
  });
  ping.connect(room.input);
  click.chain(clickBand, room.input);

  const callHertz = 70 + settings.callTone * 500;
  const clickLevel = settings.click;
  clickBand.frequency.rampTo(700 + settings.edge * 7000, 0.1);

  const calls = context.lane.addSteps(1.2, (_call, time) => {
    ping.triggerAttackRelease(callHertz, callSeconds, time, 0.9);
    if (clickLevel > 0.02) click.triggerAttackRelease(0.02, time, clickLevel);
  });

  return {
    setPad: (x, y): void => {
      calls.setStepSeconds(SLOWEST_CALL_SECONDS - x * CALL_SPEED_RANGE_SECONDS);
      room.setDelay(y); // Distance to the wall.
    },

    dispose: (): void => {
      room.dispose();
      for (const node of [ping, click, clickBand]) node.dispose();
    },
  };
}
