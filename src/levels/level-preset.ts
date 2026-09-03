/**
 * Purpose: Define the authored contracts used to construct standalone levels and shows.
 * Context: Static presets, show composition, and live show state have different lifecycles.
 * Responsibility: Describe presentation and immutable world-construction data without runtime ownership.
 * Boundary: This file contains types only and creates no browser or Three.js resources.
 */

import type { AirParticlesParameters } from "../modules/air-particles/air-particles";
import type { AnimalsPreset } from "../modules/animals/animals";
import type { EchoDepthParameters } from "../modules/echo-depth/echo-depth";
import type { GrassPreset } from "../modules/grass/grass";
import type { GrassClipmapPreset } from "../modules/grass-clipmap/grass-clipmap";
import type { MagneticSenseParameters } from "../modules/magnetic-sense/magnetic-sense";
import type { MotionSenseParameters } from "../modules/motion-sense/motion-sense";
import type { ConnectionsParameters } from "../modules/mycelium/mycelium";
import type { RocksPreset } from "../modules/rocks/rocks";
import type { RuinsPreset } from "../modules/ruins/ruins";
import type { ScentParticlesParameters } from "../modules/scent-particles/scent-particles";
import type { StaticPopulationPreset } from "../modules/static-population";
import type { TerrainColors } from "../modules/terrain/terrain-colors";
import type { ThermalPerceptionParameters } from "../modules/thermal-perception/thermal-perception";
import type { VegetationPreset } from "../modules/vegetation/vegetation";

export interface TerrainPreset {
  readonly opacity: number;
  readonly presentation?: "zones";
  readonly colors?: TerrainColors;
}

/** Immutable module and asset choices used to construct one world. */
export interface WorldComposition {
  readonly invisibleGround?: true;
  readonly invisibleVegetation?: StaticPopulationPreset;
  readonly airParticles?: AirParticlesParameters;
  readonly scentParticles?: ScentParticlesParameters;
  readonly terrain?: TerrainPreset;
  readonly grass?: GrassPreset;
  readonly grassClipmap?: GrassClipmapPreset;
  readonly vegetation?: VegetationPreset;
  readonly rocks?: RocksPreset;
  readonly ruins?: RuinsPreset;
  readonly animals?: AnimalsPreset;
  readonly echoDepth?: EchoDepthParameters;
  readonly motion?: MotionSenseParameters;
  readonly thermal?: ThermalPerceptionParameters;
  readonly magnetic?: MagneticSenseParameters;
  readonly connections?: ConnectionsParameters;
}

/** A complete standalone startup recipe used by development routes and benchmarks. */
export interface LevelPreset extends WorldComposition {
  readonly backgroundColor: number;
  readonly viewDistance: number;
  readonly testUi?: true;
  readonly maximumGroundClearanceMeters: number;
}

/** The construction-only world preloaded once for a running show. */
export interface ShowComposition {
  readonly world: WorldComposition;
  /** Haze baked into surface and sky materials before live state following. */
  readonly materialHazeColor: number;
}
