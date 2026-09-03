/**
 * Purpose: Hold the composed state of the drone organ — the piece the
 *   instrument plays, as authored in its own editor and committed here.
 * Context: The old instrument saved this as a state file its patch-cable UI
 *   wrote. That UI stays in its old repository; this is the same composition
 *   as typed configuration, and it is the only place to retune the organ.
 * Responsibility: Own the harmony, the master, and every layer's voice, mix,
 *   placement, and patched signals.
 * Boundary: What a setting does to the sound lives in the voice that reads it;
 *   which voice sounds when, and to what pulse, is the dramaturgy's score.
 *
 * Every control below is 0..1 — the range the instrument's knobs turned in.
 * Knob positions are carried at four decimals, which is far below what an ear
 * can tell apart on any of them.
 */

import type { OrganVoiceName } from "../../dramaturgy/organ-score";
import type { ModulationSettings } from "./signal-modulation";
import type { OrganVoiceSettings } from "./voices/voice-catalog";

export const DRONE_ORGAN_COMPOSITION: OrganComposition = {
  harmony: {
    rootNote: "A2", // Every voice is transposed from this root.
    scaleSemitones: [0, 3, 5, 7, 10], // Pentatonic minor; the shared scale.
  },

  masterVolume: 0.77, // Level of the whole organ before its limiter.

  room: {
    decaySeconds: 9, // Length of the shared reverb tail — a hall, not a chamber.
    preDelaySeconds: 0.04,
  },

  layers: [
    // The wind carries the empty world: the one voice the score never puts away.
    {
      name: "wind",
      voice: {
        kind: "wind",
        gustRate: 0.0737,
        sharpness: 0.15,
        padLevel: 0.5,
        gustDepth: 1,
        melodyDensity: 0.25,
      },
      volume: 0.3307,
      roomSend: 0.34,
      cutoff: 0.7293,
      pad: [0.2644, 0.3445],
      // Flying higher opens the wind: brighter on one axis, stronger on the
      // other. Height is the only thing in the world the wind answers to.
      modulation: {
        padX: { source: "altitude", minimum: 0, maximum: 1, smoothing: 0.4 },
        padY: {
          source: "altitude",
          minimum: 0.1089,
          maximum: 1,
          smoothing: 0.4,
        },
      },
    },

    // Magnetic: a sub drone whose depth turns with the compass.
    {
      name: "pressureWave",
      voice: {
        kind: "pressureWave",
        pressure: 0.8194,
        waveDepth: 0.6,
        secondVoice: 0.4,
      },
      volume: 0.334,
      roomSend: 1,
      cutoff: 0.1917,
      pad: [0.0453, 0.1908],
      modulation: {
        // Run against the signal: the drone drops toward the south pole and
        // lightens toward the north one, which is the way round it reads in
        // the world. A cable may run either way; the range says which.
        padY: { source: "north", minimum: 1, maximum: 0, smoothing: 0.4 },
      },
    },

    // Connections: three euclidean voices running against one another.
    {
      name: "polyRhythm",
      voice: {
        kind: "polyRhythm",
        haste: 0.5,
        lowVoice: 0.6,
        middleVoice: 0.5,
        highVoice: 0.45,
        middleColour: 0.35,
        room: {
          delay: 0.22,
          repeats: 0.3,
          echoMix: 0.3,
          reverbMix: 0.26,
          roomSize: 0.6,
          wallHardness: 0.4,
        },
      },
      volume: 0.64, // Held back from the composed 0.8094: about 2 dB quieter.
      roomSend: 0.34,
      cutoff: 0.3907,
      pad: [0.45, 0.5],
    },

    // Scent: the choir, quiet and almost entirely inside the shared room.
    {
      name: "choir",
      voice: {
        kind: "choir",
        breath: 0.15,
        fullness: 0,
        brightness: 0.55,
        melodyDensity: 0.3,
        chordSeconds: 8,
      },
      volume: 0.0786,
      roomSend: 0.9501,
      cutoff: 0.9,
      pad: [0.8126, 0.6843],
    },

    // Motion, on the birds: a slow beat placed on the nearest flock.
    {
      name: "birdWingBeat",
      voice: {
        kind: "wingBeat",
        gustiness: 0.4,
        restingAir: 0.335,
        sharpness: 0.1292,
        level: 0.8,
      },
      volume: 0.484,
      roomSend: 0.6441,
      cutoff: 0.424,
      pad: [0, 0.3851],
      placement: { group: "birds", nearRadius: 0, falloff: 0.1702 },
    },

    // Motion, on the insects: the same voice, faster and drier, in the swarms.
    {
      name: "insectWingBeat",
      voice: {
        kind: "wingBeat",
        gustiness: 0.4,
        restingAir: 0.15,
        sharpness: 0.4,
        level: 0.8,
      },
      volume: 0.5123,
      roomSend: 0,
      cutoff: 0.6347,
      pad: [0.8485, 0.5183],
      placement: { group: "insects", nearRadius: 0.0306, falloff: 0.3671 },
    },

    // Thermal: the bass loop, wide open and echoing at full feedback.
    {
      name: "bassLoop",
      voice: {
        kind: "bassLoop",
        pluck: 0.4869,
        noteLength: 0.8865,
        wood: 0.5,
        melodyDensity: 0.8,
        sequenceLength: 8,
        mutation: 0.1,
        room: {
          delay: 0.34,
          repeats: 1,
          echoMix: 0.3442,
          reverbMix: 0.2,
          roomSize: 0.55,
          wallHardness: 0.4,
        },
      },
      volume: 0.36, // Held back from the composed 0.4874: about 2.6 dB quieter.
      roomSend: 1,
      cutoff: 1,
      pad: [0.4, 0.25],
    },

    // Echo: the sonar, calling into a room three quarters of a wall away.
    {
      name: "sonar",
      voice: {
        kind: "sonar",
        returns: 0.62,
        callTone: 0,
        click: 0.457,
        edge: 0.35,
        room: {
          echoMix: 0.75,
          reverbMix: 0.4,
          roomSize: 0.75,
          wallHardness: 0.6,
          dryMix: 1,
        },
      },
      volume: 0.4169,
      roomSend: 0.6869,
      cutoff: 0.2622,
      pad: [0.35, 0.4],
    },

    // Connections again, on top: the metallic hiss over the poly rhythm.
    {
      name: "hiHat",
      voice: {
        kind: "hiHat",
        openness: 0.25,
        closedness: 0.3,
        metal: 0.5,
        body: 0.35,
        accent: 0.6,
        scatter: 0.35,
        room: {
          delay: 0.17,
          repeats: 0.28,
          echoMix: 0.22,
          reverbMix: 0.24,
          roomSize: 0.55,
          wallHardness: 0.55,
        },
      },
      volume: 0.42, // Held back from the composed 0.4576, with the poly rhythm.
      roomSend: 0.34,
      cutoff: 1,
      pad: [0.55, 0.55],
    },
  ],
};

/** The moving world groups a layer can be placed on. */
export type OrganPlacementGroup = "birds" | "insects";

export interface OrganPlacement {
  readonly group: OrganPlacementGroup;

  /** 0..1 how close the visitor must come before the source is at full level. */
  readonly nearRadius: number;

  /** 0..1 how steeply the level drops off with distance. */
  readonly falloff: number;
}

export interface OrganLayerSettings {
  /** Which voice of the score this layer is; the score says when it sounds. */
  readonly name: OrganVoiceName;
  readonly voice: OrganVoiceSettings;
  readonly volume: number;

  /** How much of the layer is sent into the organ's shared room. */
  readonly roomSend: number;

  /** The layer's own low-pass; 1 leaves it open. */
  readonly cutoff: number;

  /** Where the voice's two-axis control stands before anything modulates it. */
  readonly pad: readonly [number, number];

  /** World signals patched onto the pad's axes. */
  readonly modulation?: {
    readonly padX?: ModulationSettings;
    readonly padY?: ModulationSettings;
  };

  /** Absent, the layer sounds from everywhere; present, it sounds from there. */
  readonly placement?: OrganPlacement;
}

export interface OrganComposition {
  readonly harmony: {
    readonly rootNote: string;
    readonly scaleSemitones: readonly number[];
  };
  readonly masterVolume: number;
  readonly room: {
    readonly decaySeconds: number;
    readonly preDelaySeconds: number;
  };
  readonly layers: readonly OrganLayerSettings[];
}
