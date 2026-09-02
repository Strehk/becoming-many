/**
 * Purpose: Give one voice its place in the organ: level, room, colour, and — if
 *   the composition places it — a position in the world.
 * Context: Every layer is built the same way, whatever voice it holds, which is
 *   what lets nine of them stack without turning to mud.
 * Responsibility: Own the mix strip, the gate ramp, and the panner.
 * Boundary: The sound itself belongs to the voice; when a gate opens is decided
 *   by the show.
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
import type { OrganVoice } from "./voices/organ-voice";
import { createOrganVoice } from "./voices/voice-catalog";

/** The heard level is the authored one scaled down; nine layers share a master. */
const VOLUME_SCALE = 0.6;

/** The post-fader send is scaled back up so the room sounds as it was composed. */
const SEND_SCALE = 1.5;

/** The organ wakes slowly; a gate opening later is a quicker, deliberate move. */
const WAKE_SECONDS = 1.2;
const GATE_SECONDS = 0.25;

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

  /** Open the layer for its sense, or close it again. */
  readonly setGateOpen: (isOpen: boolean) => void;

  readonly setPad: (x: number, y: number) => void;

  /** Where the layer sounds from. Silently ignored for an unplaced layer. */
  readonly setPosition: (x: number, y: number, z: number) => void;

  readonly dispose: () => void;
}

export function createOrganLayer(
  engine: OrganEngine,
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
    engine.harmony,
    settings.voice,
  );
  voice.setPad(settings.pad[0], settings.pad[1]);

  let isOpen = false;
  let hasOpened = false;

  return {
    placement: settings.placement,

    setGateOpen: (open): void => {
      if (open === isOpen) return;

      isOpen = open;
      level.gain.rampTo(
        open ? settings.volume * VOLUME_SCALE : 0,
        open && !hasOpened ? WAKE_SECONDS : GATE_SECONDS,
      );
      hasOpened = hasOpened || open;
    },

    setPad: voice.setPad,

    setPosition: (x, y, z): void => {
      panner?.setPosition(x, y, z);
    },

    dispose: (): void => {
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
