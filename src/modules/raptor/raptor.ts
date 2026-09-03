/**
 * Purpose: Hold one raptor on its ring high over the traveller.
 * Context: A single bird can afford the skeleton a flock of sixty cannot.
 * Responsibility: Own the model, its beat, the ring it flies, and its cleanup.
 * Boundary: Which sense reveals it is the show's; the ring's shape is authored.
 */

import {
  AnimationMixer,
  Box3,
  Group,
  type Material,
  Mesh,
  type Scene,
  SkinnedMesh,
  Vector3,
} from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  disposeGltfAssets,
  type GltfAssets,
} from "../../utils/asset-loader/gltf-assets";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import type { WorldModule } from "../../world/module-runtime";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurface } from "../../world-surface/world-surface";
import { RAPTOR_DEFINITION } from "./raptor-definition";

export interface RaptorPreset {
  /** Feather tone; the senses recolour it from here like any other body. */
  readonly color: number;
}

export interface RaptorModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  readonly preset: RaptorPreset;
  readonly assets: GltfAssets;
  readonly worldSurface: WorldSurface;
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface RaptorResources {
  readonly root: Group;
  readonly mixer: AnimationMixer;
  readonly materials: readonly Material[];
  /** Where the ring's centre stands; it drifts after the traveller. */
  readonly centre: Vector3;
}

interface RaptorState {
  resources: RaptorResources | undefined;
  ringAngleRadians: number;
}

/**
 * One bird, held on a wide ring at seventy metres. It is the only body in the
 * piece with a skeleton of its own: a single actor can afford what a flock
 * cannot, and the wing it holds while soaring is the thing that reads from
 * that distance.
 */
export function createRaptorModule(options: RaptorModuleOptions): WorldModule {
  const state: RaptorState = { resources: undefined, ringAngleRadians: 0 };

  return {
    load: () => loadRaptor(state, options),
    activate: () => setRaptorVisible(state, true),
    update: (deltaSeconds) => updateRaptor(state, options, deltaSeconds),
    deactivate: () => setRaptorVisible(state, false),
    unload: () => unloadRaptor(state, options),
  };
}

function loadRaptor(state: RaptorState, options: RaptorModuleOptions): void {
  const gltf = options.assets.get(RAPTOR_DEFINITION.asset.id);
  if (!gltf) throw new Error("The raptor model was not loaded");

  const model = clone(gltf.scene);
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const sourceSpan = bounds.max.x - bounds.min.x;
  if (!Number.isFinite(sourceSpan) || sourceSpan <= 0) {
    throw new Error("The raptor model has no measurable wingspan");
  }

  const materials: Material[] = [];
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;

    const sources = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const replacements = sources.map((source) =>
      createUnlitMaterial(source, options.preset.color),
    );
    // Transparent for its whole lifetime, at full opacity while it is there:
    // toggling the flag with a fade would recompile the patched shader, and
    // one bird in the transparent pass costs nothing.
    for (const material of replacements) material.transparent = true;
    applyMaterialEffects(options.effects ?? [], replacements);
    object.material = Array.isArray(object.material)
      ? replacements
      : (replacements[0] ?? object.material);
    materials.push(...replacements);
    // A soaring bird leaves the static bounds its glTF was measured at.
    if (object instanceof SkinnedMesh) object.frustumCulled = false;
  });

  const root = new Group();
  root.name = "Raptor";
  root.scale.setScalar(RAPTOR_DEFINITION.wingSpanMeters / sourceSpan);
  root.add(model);
  root.visible = false;

  const mixer = new AnimationMixer(root);
  const clip = gltf.animations.find(
    ({ name }) => name === RAPTOR_DEFINITION.beatClip,
  );
  if (!clip) throw new Error("The raptor model carries no wing beat");
  mixer.clipAction(clip).play();

  options.scene.add(root);
  state.resources = {
    root,
    mixer,
    materials,
    centre: new Vector3(
      options.viewpoint.worldPosition.x,
      0,
      options.viewpoint.worldPosition.z,
    ),
  };
  placeRaptor(state, options);
}

function updateRaptor(
  state: RaptorState,
  options: RaptorModuleOptions,
  deltaSeconds: number,
): void {
  const resources = state.resources;
  if (!resources?.root.visible) return;

  // The centre drifts after the traveller rather than following rigidly, so
  // the ring stays a place in the world instead of a hat.
  const follow = Math.min(1, RAPTOR_DEFINITION.centreFollowRate * deltaSeconds);
  resources.centre.x +=
    (options.viewpoint.worldPosition.x - resources.centre.x) * follow;
  resources.centre.z +=
    (options.viewpoint.worldPosition.z - resources.centre.z) * follow;

  state.ringAngleRadians +=
    (RAPTOR_DEFINITION.ringSpeedMetersPerSecond /
      RAPTOR_DEFINITION.ringRadiusMeters) *
    deltaSeconds;
  resources.mixer.update(deltaSeconds * RAPTOR_DEFINITION.beatTimeScale);
  placeRaptor(state, options);
}

/** Carry the bird to its place on the ring and turn it into the bank. */
function placeRaptor(state: RaptorState, options: RaptorModuleOptions): void {
  const resources = state.resources;
  if (!resources) return;

  const angle = state.ringAngleRadians;
  const worldX =
    resources.centre.x + Math.cos(angle) * RAPTOR_DEFINITION.ringRadiusMeters;
  const worldZ =
    resources.centre.z + Math.sin(angle) * RAPTOR_DEFINITION.ringRadiusMeters;
  // The ring rises and falls over its turn: a soaring bird gains height on
  // one side of the circle and gives it back on the other.
  const rise = Math.sin(angle * 2) * RAPTOR_DEFINITION.ringRiseMeters;

  resources.root.position.set(
    worldX,
    options.worldSurface.groundYAt(worldX, worldZ) +
      RAPTOR_DEFINITION.heightAboveGroundMeters +
      rise,
    worldZ,
  );
  // Along the tangent, banked into the turn — the tilt is what reads as a
  // circle held rather than a straight line crossed.
  resources.root.rotation.set(
    0,
    Math.atan2(-Math.sin(angle), Math.cos(angle)),
    RAPTOR_DEFINITION.bankRadians,
    "YXZ",
  );
}

function setRaptorVisible(state: RaptorState, visible: boolean): void {
  if (state.resources) state.resources.root.visible = visible;
}

function unloadRaptor(state: RaptorState, options: RaptorModuleOptions): void {
  const resources = state.resources;
  if (!resources) return;

  state.resources = undefined;
  resources.mixer.stopAllAction();
  options.scene.remove(resources.root);
  resources.root.traverse((object) => {
    if (object instanceof Mesh) object.geometry.dispose();
  });
  for (const material of resources.materials) material.dispose();
  disposeGltfAssets(options.assets);
}
