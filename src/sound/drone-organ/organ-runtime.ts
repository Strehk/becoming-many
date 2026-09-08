/**
 * Purpose: Run the composed organ: build it once, then follow the show.
 * Context: Everything Tone touches hangs below this file, so the public entry
 *   beside it can stay free of the library and load it only for a show.
 * Responsibility: Build engine and layers, carry show time onto the grids and
 *   the voice strengths onto the faders, carry the patched signals onto the
 *   pads, and keep the placed layers in their places.
 * Boundary: Where the visitor is, what time it is, and how strong each voice
 *   stands is decided by the show; how a voice sounds is decided by the voice.
 */

import type { SpatialAudio } from "../spatial-audio.runtime";
import type { DroneOrganFrame, DroneOrganOptions } from "./drone-organ";
import {
  DRONE_ORGAN_COMPOSITION,
  type OrganLayerSettings,
} from "./drone-organ-settings";
import { type AnchorPoint, readNearestAnchor } from "./nearest-anchor";
import { createOrganEngine, type OrganEngine } from "./organ-engine";
import { createOrganLayer, type OrganLayer } from "./organ-layer";
import { readOrganSignal } from "./organ-signals";
import { createOrganTimeline } from "./organ-timeline";
import { createModulation, type ModulationSettings } from "./signal-modulation";

/** Control moves below this are not written; they are inaudible and not free. */
const CONTROL_DEAD_BAND = 0.0005;

/**
 * How far a placed layer travels toward its source per frame. Fast, because
 * both placed groups fly: a bird passing at twelve metres a second would
 * otherwise trail its own sound by half a wingspan of world.
 */
const PLACEMENT_GLIDE = 0.45;

/** A source jumping further than this was recycled, not moved. Follow it. */
const PLACEMENT_SNAP_METERS = 120;

/** One patched pad axis, ready to answer with the control value it stands at. */
interface PadAxis {
  readonly follow: (frame: DroneOrganFrame) => number;
}

interface RunningLayer {
  readonly layer: OrganLayer;
  readonly settings: OrganLayerSettings;
  readonly padX: PadAxis | undefined;
  readonly padY: PadAxis | undefined;

  /** Where this layer is currently heard from; only placed layers use it. */
  readonly heardAt: AnchorPoint;
  isOpen: boolean;
  hasBeenPlaced: boolean;
  hadSource: boolean;
  writtenPadX: number;
  writtenPadY: number;
}

export interface OrganRuntime {
  readonly update: (frame: DroneOrganFrame) => void;
  readonly unload: () => Promise<void>;
}

export async function startOrganRuntime(
  options: DroneOrganOptions,
  audio: SpatialAudio,
  signal: AbortSignal,
): Promise<OrganRuntime | undefined> {
  const { context } = audio;
  const layers: RunningLayer[] = [];
  let engine: OrganEngine | undefined;
  let unloading: Promise<void> | undefined;
  function unload(): Promise<void> {
    unloading ??= (async () => {
      const results = await Promise.allSettled([
        ...layers.reverse().map(async (running) => running.layer.dispose()),
        engine?.unload(),
      ]);
      const errors = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (errors.length)
        throw new AggregateError(errors, "Organ cleanup failed");
    })();
    return unloading;
  }
  try {
    if (signal.aborted) {
      await unload();
      return undefined;
    }
    const composition = DRONE_ORGAN_COMPOSITION;
    engine = await createOrganEngine(
      composition,
      options.pulseSeconds,
      context,
    );
    if (signal.aborted) {
      await unload();
      return undefined;
    }
    const timeline = createOrganTimeline(() =>
      context.state === "running" ? context.now() : undefined,
    );
    const nearest: AnchorPoint = { x: 0, y: 0, z: 0 };

    for (const [index, settings] of composition.layers.entries()) {
      const layer = createOrganLayer(
        engine,
        timeline.createLane(),
        index,
        settings,
      );
      layers.push({
        layer,
        settings,
        padX: createPadAxis(settings.modulation?.padX),
        padY: createPadAxis(settings.modulation?.padY),
        heardAt: { x: 0, y: 0, z: 0 },
        isOpen: false,
        hasBeenPlaced: false,
        hadSource: false,
        writtenPadX: settings.pad[0],
        writtenPadY: settings.pad[1],
      });
    }

    function followStrengths(frame: DroneOrganFrame): void {
      for (const running of layers) {
        const strength = frame.voiceStrengths[running.settings.name];
        running.isOpen = strength > 0;
        running.layer.setStrength(strength);
      }
    }

    function followPads(frame: DroneOrganFrame): void {
      for (const running of layers) {
        if (!running.padX && !running.padY) continue;

        const x = running.padX?.follow(frame) ?? running.writtenPadX;
        const y = running.padY?.follow(frame) ?? running.writtenPadY;
        if (
          Math.abs(x - running.writtenPadX) < CONTROL_DEAD_BAND &&
          Math.abs(y - running.writtenPadY) < CONTROL_DEAD_BAND
        ) {
          continue;
        }

        running.writtenPadX = x;
        running.writtenPadY = y;
        running.layer.setPad(x, y);
      }
    }

    function followPlacements(frame: DroneOrganFrame): void {
      for (const running of layers) {
        const placement = running.settings.placement;
        // A closed layer is silent, so where it would have sounded from costs
        // nothing to skip; it glides in from the listener when its sense opens.
        if (!placement || !running.isOpen) continue;

        const hasSource = readNearestAnchor(
          frame.readGroupCenters(placement.group),
          frame.listener,
          nearest,
        );
        // With nothing of the group in the world the sound comes home to the
        // listener, which is where it also starts before the first source exists.
        const wantX = hasSource ? nearest.x : frame.listener.x;
        const wantY = hasSource ? nearest.y : frame.listener.y;
        const wantZ = hasSource ? nearest.z : frame.listener.z;

        const heard = running.heardAt;
        // The same group jumping a long way is a recycled cloud, not a flight
        // path: follow it instead of gliding the sound through the listener.
        const hasJumped =
          hasSource &&
          running.hadSource &&
          (Math.abs(wantX - heard.x) > PLACEMENT_SNAP_METERS ||
            Math.abs(wantY - heard.y) > PLACEMENT_SNAP_METERS ||
            Math.abs(wantZ - heard.z) > PLACEMENT_SNAP_METERS);

        if (hasJumped || !running.hasBeenPlaced) {
          heard.x = wantX;
          heard.y = wantY;
          heard.z = wantZ;
        } else {
          heard.x += (wantX - heard.x) * PLACEMENT_GLIDE;
          heard.y += (wantY - heard.y) * PLACEMENT_GLIDE;
          heard.z += (wantZ - heard.z) * PLACEMENT_GLIDE;
        }
        running.hasBeenPlaced = true;
        running.hadSource = hasSource;
        running.layer.setPosition(heard.x, heard.y, heard.z);
      }
    }

    return {
      update: (frame): void => {
        if (unloading) return;
        followStrengths(frame);
        followPads(frame);
        timeline.follow(frame);
        followPlacements(frame);
      },

      unload,
    };
  } catch (error) {
    try {
      await unload();
    } catch (cleanupError) {
      if (cleanupError !== error)
        throw new AggregateError([error, cleanupError], "Organ startup failed");
    }
    throw error;
  }
}

function createPadAxis(
  settings: ModulationSettings | undefined,
): PadAxis | undefined {
  if (!settings) return undefined;

  const modulation = createModulation(settings);
  return {
    follow: (frame): number =>
      modulation.follow(
        readOrganSignal(settings.source, frame.listener, frame.groundYMeters),
      ),
  };
}
