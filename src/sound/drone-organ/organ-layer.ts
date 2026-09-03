/**
 * Purpose: Give one voice its place in the organ: level, room, colour, and — if
 *   the composition places it — a position in the world.
 * Context: Every layer is built the same way, whatever voice it holds, which is
 *   what lets nine of them stack without turning to mud.
 * Responsibility: Own the mix strip, the strength fader, the lane, and the
 *   panner.
 * Boundary: The sound itself belongs to the voice; how strong a layer stands
 *   at a show time is decided by the dramaturgy's score.
 *
 *   voice -> bus -> cutoff -> [panner] -> level -> master
 *                                            |--> room send -> shared reverb
 *
 * The send sits behind the level, so silencing a layer silences its room too.
 */

import { Filter, Gain, Panner3D } from "tone";
import type {
  OrganLayerSettings,
  OrganPlacement,
} from "./drone-organ-settings";
import type { OrganEngine } from "./organ-engine";
import type { OrganLane } from "./organ-timeline";
import type { OrganVoice } from "./voices/organ-voice";
import { createOrganVoice } from "./voices/voice-catalog";

/** The heard level is the authored one scaled down; nine layers share a master. */
const VOLUME_SCALE = 0.6;

/** The post-fader send is scaled back up so the room sounds as it was composed. */
const SEND_SCALE = 1.5;

/**
 * How long one strength write takes to land on the fader. The score fades a
 * voice over seconds, one write per frame; this only smooths the steps between
 * writes, and turns a seek's jump into a short ramp rather than a click.
 */
const STRENGTH_RAMP_SECONDS = 0.05;

/** Fader moves below this are not written; they are inaudible and not free. */
const STRENGTH_DEAD_BAND = 0.0005;

/** The cutoff control spans 80 Hz to 20 kHz exponentially; 1 is fully open. */
const CUTOFF_BASE_HERTZ = 80;
const CUTOFF_DECADES = 250;

/** Placement ranges: how near is near, and how fast a source falls away. */
const NEAR_RADIUS_METERS = { base: 6, range: 54 };
const FALLOFF = { base: 0.4, range: 2.2 };
const MAX_HEARING_DISTANCE_METERS = 320;

export interface OrganLayer {
  /** Present when the composition places this layer on a world group. */
  readonly placement: OrganPlacement | undefined;

  /**
   * How strongly the layer sounds, 0..1, as the score derives it. At zero the
   * layer's lane sleeps as well, so a voice nobody hears schedules nothing.
   */
  readonly setStrength: (strength: number) => void;

  readonly setPad: (x: number, y: number) => void;

  /** Where the layer sounds from. Silently ignored for an unplaced layer. */
  readonly setPosition: (x: number, y: number, z: number) => void;

  readonly dispose: () => void;
}

export function createOrganLayer(
  engine: OrganEngine,
  lane: OrganLane,
  salt: number,
  settings: OrganLayerSettings,
): OrganLayer {
  const bus = new Gain(1);
  const cutoff = new Filter(
    CUTOFF_BASE_HERTZ * CUTOFF_DECADES ** settings.cutoff,
    "lowpass",
  );
  const level = new Gain(0);
  const roomSend = new Gain(settings.roomSend * SEND_SCALE);

  // Placed layers hear the world through a panner, which collapses the voice
  // to mono: where a sound is replaces its stereo image, and that is the point.
  const panner = settings.placement
    ? createPanner(settings.placement)
    : undefined;

  bus.connect(cutoff);
  if (panner) {
    cutoff.connect(panner);
    panner.connect(level);
  } else {
    cutoff.connect(level);
  }
  level.connect(engine.master);
  level.connect(roomSend);
  roomSend.connect(engine.reverb);

  const voice: OrganVoice = createOrganVoice(
    bus,
    { harmony: engine.harmony, lane, salt },
    settings.voice,
  );
  voice.setPad(settings.pad[0], settings.pad[1]);
  lane.setActive(false);

  let writtenLevel = 0;

  return {
    placement: settings.placement,

    setStrength: (strength): void => {
      lane.setActive(strength > 0);

      const target = settings.volume * VOLUME_SCALE * strength;
      if (target === writtenLevel) return;
      if (
        target !== 0 &&
        Math.abs(target - writtenLevel) < STRENGTH_DEAD_BAND
      ) {
        return;
      }

      writtenLevel = target;
      level.gain.rampTo(target, STRENGTH_RAMP_SECONDS);
    },

    setPad: voice.setPad,

    setPosition: (x, y, z): void => {
      panner?.setPosition(x, y, z);
    },

    dispose: (): void => {
      lane.dispose();
      voice.dispose();
      for (const node of [bus, cutoff, level, roomSend, panner])
        node?.dispose();
    },
  };
}

function createPanner(placement: OrganPlacement): Panner3D {
  return new Panner3D({
    // Equal power rather than HRTF: the composition was mixed with it, and it
    // is the cheaper of the two on a headset that has frames to spend.
    panningModel: "equalpower",
    distanceModel: "inverse",
    refDistance:
      NEAR_RADIUS_METERS.base + placement.nearRadius * NEAR_RADIUS_METERS.range,
    rolloffFactor: FALLOFF.base + placement.falloff * FALLOFF.range,
    maxDistance: MAX_HEARING_DISTANCE_METERS,
  });
}
