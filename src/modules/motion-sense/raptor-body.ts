/**
 * Purpose: Fly the raptor model along the ring its flight holds.
 * Context: One bird can afford the skeleton a flock of sixty cannot.
 * Responsibility: Own the model, its wing beat, its placement, and its cleanup.
 * Boundary: The ring is the flight's; which sense reveals a body is the show's.
 */

import {
  AnimationMixer,
  Box3,
  Group,
  type Material,
  Mesh,
  type Scene,
  SkinnedMesh,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  applyMaterialEffects,
  type UnlitMaterialEffect,
} from "../../utils/asset-loader/material-effect";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import { RAPTOR_DEFINITION } from "./raptor-definition";

export interface RaptorBodyAppearance {
  /** Feather tone. Far outside the heat view's reach, it reads as echo does. */
  readonly color: number;
}

export interface RaptorBodyOptions {
  readonly scene: Scene;
  readonly asset: GLTF;
  readonly appearance: RaptorBodyAppearance;
  /** Applied to the body material; the show fades the bird through them. */
  readonly effects: readonly UnlitMaterialEffect[];
}

export interface RaptorBody {
  /** Carry the bird to where its flight now says it is. */
  readonly update: (bodyStream: Float32Array, deltaSeconds: number) => void;
  readonly setVisible: (visible: boolean) => void;
  readonly dispose: () => void;
}

/**
 * The only body in the piece with a skeleton of its own: a single actor can
 * afford what a flock cannot. Its authored beat plays back at a fifth speed,
 * because a soaring bird holds the wing and lets the air work — and that held
 * wing is what reads from ninety metres away.
 */
export function createRaptorBody(options: RaptorBodyOptions): RaptorBody {
  const model = clone(options.asset.scene);
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
      createUnlitMaterial(source, options.appearance.color),
    );
    // Transparent for its whole lifetime, at full opacity while it is there:
    // toggling the flag with a fade would recompile the patched shader, and
    // one bird in the transparent pass costs nothing.
    for (const material of replacements) material.transparent = true;
    applyMaterialEffects(options.effects, replacements);
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
  const clip = options.asset.animations.find(
    ({ name }) => name === RAPTOR_DEFINITION.beatClip,
  );
  if (!clip) throw new Error("The raptor model carries no wing beat");
  mixer.clipAction(clip).play();
  options.scene.add(root);

  return {
    update: (bodyStream, deltaSeconds) => {
      root.position.set(
        bodyStream[0] ?? 0,
        bodyStream[1] ?? 0,
        bodyStream[2] ?? 0,
      );
      // Along the ring, banked into the turn — the tilt is what reads as a
      // circle held rather than a straight line crossed.
      root.rotation.set(
        0,
        bodyStream[3] ?? 0,
        RAPTOR_DEFINITION.bankRadians,
        "YXZ",
      );
      mixer.update(deltaSeconds * RAPTOR_DEFINITION.beatTimeScale);
    },

    setVisible: (visible) => {
      root.visible = visible;
    },

    dispose: () => {
      mixer.stopAllAction();
      options.scene.remove(root);
      root.traverse((object) => {
        if (object instanceof Mesh) object.geometry.dispose();
      });
      for (const material of materials) material.dispose();
    },
  };
}
