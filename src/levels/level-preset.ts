/**
 * Purpose: Define the authored contracts used to construct standalone levels and shows.
 * Context: One preset constructs the world; live show state controls its presentation.
 * Responsibility: Describe presentation and immutable world-construction data without runtime ownership.
 * Boundary: This file contains types only and creates no browser or Three.js resources.
 */

import type { NarrationLanguage } from "../dramaturgy/narration-catalog";
import type { AirParticlesParameters } from "../modules/air-particles/air-particles";
import type { AnimalsPreset } from "../modules/animals/animals";
import type { EchoDepthParameters } from "../modules/echo-depth/echo-depth";
import type { GrassClipmapPreset } from "../modules/grass-clipmap/grass-clipmap";
import type { MagneticSenseParameters } from "../modules/magnetic-sense/magnetic-sense";
import type { MotionSenseParameters } from "../modules/motion-sense/motion-sense";
import type { ConnectionsParameters } from "../modules/mycelium/mycelium";
import type { RocksPreset } from "../modules/rocks/rocks";
import type { ScentParticlesParameters } from "../modules/scent-particles/scent-particles";
import type { StartParameters } from "../modules/start/start.module";
import type { StaticPopulationPreset } from "../modules/static-population";
import type { TerrainColors } from "../modules/terrain/terrain-colors";
import type { ThermalPerceptionParameters } from "../modules/thermal-perception/thermal-perception";
import type { VegetationPreset } from "../modules/vegetation/vegetation";
import type { NarrationRecording } from "../sound/narration-player";
import type { TrainingAudioParameters } from "../sound/training-audio.runtime";

export interface TerrainPreset {
  readonly opacity: number;
  readonly presentation?: "zones";
  readonly colors?: TerrainColors;
}

/** Immutable module and asset choices used to construct one world. */
export type WorldComposition = {
  readonly start?: StartParameters;
  readonly invisibleGround?: true;
  readonly airParticles?: AirParticlesParameters;
  readonly scentParticles?: ScentParticlesParameters;
  readonly terrain?: TerrainPreset;
  readonly grassClipmap?: GrassClipmapPreset;
  readonly rocks?: RocksPreset;
  readonly animals?: AnimalsPreset;
  readonly echoDepth?: EchoDepthParameters;
  readonly motion?: MotionSenseParameters;
  readonly thermal?: ThermalPerceptionParameters;
  readonly magnetic?: MagneticSenseParameters;
  readonly connections?: ConnectionsParameters;
} & (
  | {
      readonly vegetation?: VegetationPreset;
      readonly invisibleVegetation?: never;
    }
  | {
      readonly vegetation?: never;
      readonly invisibleVegetation?: StaticPopulationPreset;
    }
);

/** A complete world recipe used by standalone routes, benchmarks and the Show. */
export type LevelPreset = WorldComposition & {
  /** Tutorial translation speed; Run restores the main controls' defaults on handoff. */
  readonly flightSpeedMetersPerSecond?: number;
  readonly startAudio?: TrainingAudioParameters;
  readonly startNarration?: Readonly<
    Record<NarrationLanguage, readonly NarrationRecording[]>
  >;
  readonly backgroundColor: number;
  readonly viewDistance: number;
  /** Vertical desktop view angle; immersive XR retains the headset projection. */
  readonly desktopFieldOfViewDegrees?: number;
  readonly maximumGroundClearanceMeters: number;
};
