/**
 * Purpose: Stage the authored animal crossings the show schedule places.
 * Context: One animal announces each sense that names one, across its cue boundary.
 * Responsibility: Own passage resources, entry and departure, and the show-time follow.
 * Boundary: When a passage runs is the schedule's; how it flies is the flight's.
 */

import { type AnimationClip, Mesh, type Object3D, type Scene } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import type {
  PassageId,
  PassageSchedule,
} from "../../dramaturgy/passage-schedule";
import { passageProgressAt } from "../../dramaturgy/passage-schedule";
import {
  disposeGltfAssets,
  type GltfAssets,
  loadGltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  PASSAGE_FLIGHTS,
  type PassageFlightDefinition,
} from "./passage-definitions";
import { createPassageFlight, type PassageFlight } from "./passage-flight";
import { loadPassageRoute, type PassageRoute } from "./passage-route";

/** The models and routes every passage needs, loaded before the world starts. */
export interface PassageResources {
  readonly models: GltfAssets;
  readonly routes: ReadonlyMap<PassageId, PassageRoute>;
}

export interface AnimalPassagesModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly worldSurface: WorldSurface;
  readonly schedule: PassageSchedule;
  readonly resources: PassageResources;
  /** The direction the visitor is travelling, for routes that face them. */
  readonly readViewHeadingRadians: () => number;
}

/** The module beside the show-time follow that places its animals. */
export interface AnimalPassagesModuleHandle {
  readonly module: WorldModule;
  /**
   * Put every passage where the schedule says it stands at this instant. The
   * Level Runtime calls it beside the sense strengths, from the same sampled
   * show time, so a passage seeks with everything else.
   */
  readonly followShowTime: (showTimeSeconds: number) => void;
}

/**
 * Load every model and route the schedule's passages need. Awaited beside the
 * level's other assets: a route that arrives late would put an animal into the
 * air part-way through its own crossing.
 */
export async function loadPassageResources(
  schedule: PassageSchedule,
): Promise<PassageResources> {
  const definitions = scheduledFlights(schedule);
  const [models, routes] = await Promise.all([
    loadGltfAssets(
      definitions.map(({ passageId, modelUrl }) => ({
        id: passageId,
        url: modelUrl,
      })),
    ),
    Promise.all(
      definitions.map(
        async (definition) =>
          [
            definition.passageId,
            await loadPassageRoute(
              definition.routeUrl,
              {
                scaleToMeters: definition.routeScaleToMeters,
                rotation: definition.routeRotation,
                start: definition.routeStart,
              },
              definition.routeDurationSeconds,
            ),
          ] as const,
      ),
    ),
  ]);

  return { models, routes: new Map(routes) };
}

export function createAnimalPassagesModule(
  options: AnimalPassagesModuleOptions,
): AnimalPassagesModuleHandle {
  const staged: StagedPassage[] = [];
  let active = false;

  return {
    module: {
      load: () => stagePassages(staged, options),
      activate: () => {
        active = true;
      },
      // Nothing advances per frame: a passage's whole pose comes from show
      // time, so there is no state here for a frame delta to carry.
      deactivate: () => {
        active = false;
        for (const passage of staged) hidePassage(passage);
      },
      unload: () => unstagePassages(staged, options),
    },

    followShowTime: (showTimeSeconds: number): void => {
      if (!active) return;

      for (const passage of staged) {
        const progress = passageProgressAt(
          options.schedule,
          passage.definition.passageId,
          showTimeSeconds,
        );
        if (progress === undefined) {
          hidePassage(passage);
          continue;
        }
        // Entering: turn the route to the visitor before the first pose, or
        // the animal's first frame would face the way the last one left.
        if (!passage.crossing) {
          passage.flight.anchor();
          passage.crossing = true;
        }
        passage.flight.applyProgress(progress);
      }
    },
  };
}

interface StagedPassage {
  readonly definition: PassageFlightDefinition;
  readonly flight: PassageFlight;
  /** Whether the animal is in the air, so entry is recognised exactly once. */
  crossing: boolean;
}

function stagePassages(
  staged: StagedPassage[],
  options: AnimalPassagesModuleOptions,
): void {
  for (const definition of scheduledFlights(options.schedule)) {
    const asset = options.resources.models.get(definition.passageId);
    const route = options.resources.routes.get(definition.passageId);
    if (!asset || !route) {
      throw new Error(`Passage was not loaded: ${definition.passageId}`);
    }

    const flight = createPassageFlight({
      definition,
      route,
      model: prepareModel(asset.scene, definition),
      animations: asset.animations as readonly AnimationClip[],
      viewpoint: options.viewpoint,
      groundYAt: options.worldSurface.groundYAt,
      readViewHeadingRadians: options.readViewHeadingRadians,
    });
    options.scene.add(flight.root);
    staged.push({ definition, flight, crossing: false });
  }
}

function hidePassage(passage: StagedPassage): void {
  passage.flight.root.visible = false;
  passage.crossing = false;
}

function unstagePassages(
  staged: StagedPassage[],
  options: AnimalPassagesModuleOptions,
): void {
  for (const passage of staged) {
    options.scene.remove(passage.flight.root);
    passage.flight.dispose();
  }
  staged.length = 0;
  disposeGltfAssets(options.resources.models);
}

/**
 * Give the animal its own clone at the size it should read, wearing plain
 * unlit materials.
 *
 * A passage is deliberately *not* decorated by the senses, unlike the animal
 * population: it is an authored moment that has to land in the white world
 * before any sense exists, and a body that only the heat view can see would
 * simply be missing there.
 */
function prepareModel(
  source: Object3D,
  definition: PassageFlightDefinition,
): Object3D {
  const model = clone(source);
  model.updateMatrixWorld(true);
  const span = measureSpan(model);
  model.scale.setScalar(definition.wingspanMeters / Math.max(span, 1e-4));

  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const sources = Array.isArray(object.material)
      ? object.material
      : [object.material];
    // No colour override: the bird carries its own part colours and the bat
    // its texture, which is what these two were authored to look like.
    const replacements = sources.map((material) =>
      createUnlitMaterial(material),
    );
    object.material = Array.isArray(object.material)
      ? replacements
      : (replacements[0] ?? object.material);
  });
  return model;
}

function measureSpan(model: Object3D): number {
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    object.geometry.computeBoundingBox();
    const bounds = object.geometry.boundingBox;
    if (!bounds) return;
    minimumX = Math.min(minimumX, bounds.min.x);
    maximumX = Math.max(maximumX, bounds.max.x);
  });

  const span = maximumX - minimumX;
  if (!Number.isFinite(span) || span <= 0) {
    throw new Error("Passage model has no measurable span");
  }
  return span;
}

/**
 * The flights the schedule actually calls for. A passage authored without an
 * implementation is a fault, not a silent absence: it would leave the moment
 * that announces a sense simply empty.
 */
function scheduledFlights(
  schedule: PassageSchedule,
): readonly PassageFlightDefinition[] {
  return schedule.passages.map(({ passageId }) => {
    const definition = PASSAGE_FLIGHTS.find(
      (candidate) => candidate.passageId === passageId,
    );
    if (!definition) {
      throw new Error(`Scheduled passage has no definition: ${passageId}`);
    }
    return definition;
  });
}
