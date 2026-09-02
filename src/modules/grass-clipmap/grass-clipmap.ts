/**
 * Purpose: Connect the clipmap grass field to the shared world lifecycle and stream queue.
 * Context: An endless grass field must follow flight without ever touching a vertex buffer.
 * Responsibility: Own the height field, the clipmap, their refills, visibility, and cleanup.
 * Boundary: Layout and blade shape live beside this file; frame budgets live in World.
 */

import type { PerspectiveCamera, Scene } from "three";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import type { WorldModule } from "../../world/module-runtime";
import type { StreamJob, StreamQueue } from "../../world/stream-queue";
import type { Viewpoint } from "../../world/viewer-rig";
import type { WorldSurfaceSettings } from "../../world-surface/surface-settings";
import type { WorldSurface } from "../../world-surface/world-surface";
import {
  createGrassClipmapField,
  type GrassClipmapField,
} from "./grass-clipmap-field";
import type { GrassClipmapPreset } from "./grass-clipmap-settings";
import {
  createGrassHeightField,
  type GrassHeightField,
} from "./grass-height-field";

export type { GrassClipmapPreset } from "./grass-clipmap-settings";

export interface GrassClipmapModuleOptions {
  readonly scene: Scene;
  readonly viewpoint: Viewpoint;
  /**
   * Projection and view matrices for frustum culling — never its position.
   * The visitor's world position is the viewpoint's to publish.
   */
  readonly frustumCamera: PerspectiveCamera;
  readonly preset: GrassClipmapPreset;
  readonly streamQueue: StreamQueue;
  readonly worldSurface: WorldSurface;
  readonly surfaceSettings: WorldSurfaceSettings;
  /** The carried level haze the field fades into where no sense covers it. */
  readonly fogColor: number;

  /** Sense responses the composition root patches into the blade material. */
  readonly effects?: readonly UnlitMaterialEffect[];
}

interface GrassClipmapResources {
  readonly heightField: GrassHeightField;
  readonly field: GrassClipmapField;
  readonly refillKey: object;
  refilling: boolean;
}

interface GrassClipmapState {
  currentResources: GrassClipmapResources | undefined;
}

export function createGrassClipmapModule(
  options: GrassClipmapModuleOptions,
): WorldModule {
  const state: GrassClipmapState = { currentResources: undefined };

  return {
    load: () => loadGrassClipmap(state, options),
    activate: () => setGrassClipmapVisible(state, true),
    update: (deltaSeconds) => updateGrassClipmap(state, options, deltaSeconds),
    deactivate: () => setGrassClipmapVisible(state, false),
    unload: () => unloadGrassClipmap(state, options.scene),
  };
}

function loadGrassClipmap(
  state: GrassClipmapState,
  options: GrassClipmapModuleOptions,
): void {
  const heightField = createGrassHeightField({
    worldSurface: options.worldSurface,
    surfaceSettings: options.surfaceSettings,
    cameraX: options.viewpoint.worldPosition.x,
    cameraZ: options.viewpoint.worldPosition.z,
  });
  const field = createGrassClipmapField({
    preset: options.preset,
    heightField,
    fogColor: options.fogColor,
    effects: options.effects,
  });

  field.publishHeightWindow();
  const { worldPosition } = options.viewpoint;
  field.followCamera(worldPosition.x, worldPosition.z);
  field.selectDetail(worldPosition.x, worldPosition.z);
  // Loading happens before the first render. Keep every object hidden until
  // the module lifecycle activates it.
  field.group.visible = false;
  options.scene.add(field.group);

  state.currentResources = {
    heightField,
    field,
    refillKey: {},
    refilling: false,
  };
}

function updateGrassClipmap(
  state: GrassClipmapState,
  options: GrassClipmapModuleOptions,
  deltaSeconds: number,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  const { viewpoint, frustumCamera, streamQueue } = options;
  const cameraX = viewpoint.worldPosition.x;
  const cameraZ = viewpoint.worldPosition.z;

  resources.field.advanceWind(deltaSeconds);
  resources.field.updateFrustum(frustumCamera);
  resources.field.followCamera(cameraX, cameraZ);
  // Detail and allocation follow the distance every frame, not only when the
  // grid snaps: walking across a chunk changes both without moving the layout.
  resources.field.selectDetail(cameraX, cameraZ);

  if (resources.refilling) return;
  if (!resources.heightField.needsRecenter(cameraX, cameraZ)) return;

  resources.heightField.beginRecenter(cameraX, cameraZ);
  // The queue refuses work when its memory guard is full. Marking the refill
  // as running anyway would latch the flag forever: nothing else clears it,
  // so the field would keep rooting its blades in a window the camera has
  // long left, and outside that window the clamped edge texel puts every
  // blade at one wrong height.
  resources.refilling = streamQueue.enqueue(createRefillJob(state, resources));
}

/**
 * The window is only published once it is complete, so the field keeps rooting
 * blades in the old one meanwhile. That is what lets the refill run as small
 * cooperative steps instead of one long stall.
 */
function createRefillJob(
  state: GrassClipmapState,
  resources: GrassClipmapResources,
): StreamJob {
  return {
    key: resources.refillKey,
    isCurrent: () => state.currentResources === resources,
    runStep: () => {
      const complete = resources.heightField.fillNextRows();
      if (!complete) return false;

      resources.field.publishHeightWindow();
      resources.refilling = false;
      return true;
    },
  };
}

function setGrassClipmapVisible(
  state: GrassClipmapState,
  visible: boolean,
): void {
  const resources = state.currentResources;
  if (!resources) return;

  resources.field.group.visible = visible;
}

function unloadGrassClipmap(state: GrassClipmapState, scene: Scene): void {
  const resources = state.currentResources;
  if (!resources) return;

  state.currentResources = undefined;
  scene.remove(resources.field.group);
  resources.field.dispose();
  resources.heightField.dispose();
}
