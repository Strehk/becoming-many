/**
 * Purpose: Draw the bodies flying the bird flocks as one instanced pool.
 * Context: The flocks are simulated as a trace; a level may also let them be seen.
 * Responsibility: Own the instanced mesh, its wing beat, and the per-frame writes.
 * Boundary: The flight is the flock simulation's; what reveals a body is the show's.
 */

import {
  BufferAttribute,
  type BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  Quaternion,
  type Scene,
  Vector3,
} from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { UnlitMaterialEffect } from "../../utils/asset-loader/material-effect";
import { applyMaterialEffects } from "../../utils/asset-loader/material-effect";
import { applyShaderPatch } from "../../utils/asset-loader/material-shader-patch";
import { createUnlitMaterial } from "../../utils/asset-loader/unlit-material";
import wingBeatShader from "./bird-wing-beat.vert.glsl?raw";
import {
  type BirdBodyAppearance,
  MOTION_SENSE_SETTINGS,
} from "./motion-sense-settings";

const WING_BEAT_CACHE_KEY = "bird-wing-beat-v1";

/**
 * The one model the flocks fly. Module-owned, like every other asset a module
 * needs: a level authors how large and how dark a bird is, never which file.
 */
export const BIRD_BODY_ASSET = {
  id: "bird",
  url: "/birds/bird.glb",
} as const;
const UP = new Vector3(0, 1, 0);

export interface BirdBodiesOptions {
  readonly scene: Scene;
  readonly asset: GLTF;
  readonly appearance: BirdBodyAppearance;
  readonly birdCount: number;
  /** Applied to the body material; the show fades the pool through them. */
  readonly effects: readonly UnlitMaterialEffect[];
}

export interface BirdBodies {
  /** Place every body from the flock's body stream. */
  readonly update: (bodyStream: Float32Array) => void;
  /** Show the pool, or put it away while nothing reveals a warm body. */
  readonly setVisible: (visible: boolean) => void;
  readonly dispose: () => void;
}

interface BirdBodyResources {
  readonly mesh: InstancedMesh;
  readonly beats: InstancedBufferAttribute;
}

/**
 * One `InstancedMesh` carries the whole pool: sixty birds are one draw call,
 * their wings beat in the vertex shader, and nothing per-bird is uploaded but
 * a matrix and one beat value.
 */
export function createBirdBodies(options: BirdBodiesOptions): BirdBodies {
  const geometry = readBirdGeometry(options.asset, options.appearance);
  const material = createBirdMaterial(options);
  const mesh = new InstancedMesh(geometry, material, options.birdCount);
  mesh.name = "BirdBodies";
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  // The pool follows the traveller and its bounds change every frame, so
  // object-level culling would need rebuilding as often as the matrices.
  mesh.frustumCulled = false;
  mesh.visible = false;

  const beats = new InstancedBufferAttribute(
    new Float32Array(options.birdCount),
    1,
  );
  beats.setUsage(DynamicDrawUsage);
  geometry.setAttribute("birdBeat", beats);

  options.scene.add(mesh);
  const resources: BirdBodyResources = { mesh, beats };
  const scale = new Vector3().setScalar(1);
  const placement = new Matrix4();
  const facing = new Quaternion();
  const position = new Vector3();

  return {
    update: (bodyStream) => {
      const stride = MOTION_SENSE_SETTINGS.birdBodyValuesPerBird;
      for (let birdIndex = 0; birdIndex < options.birdCount; birdIndex += 1) {
        const offset = birdIndex * stride;
        position.set(
          bodyStream[offset] ?? 0,
          bodyStream[offset + 1] ?? 0,
          bodyStream[offset + 2] ?? 0,
        );
        facing.setFromAxisAngle(UP, bodyStream[offset + 3] ?? 0);
        placement.compose(position, facing, scale);
        resources.mesh.setMatrixAt(birdIndex, placement);
        resources.beats.setX(birdIndex, bodyStream[offset + 4] ?? 0);
      }
      resources.mesh.instanceMatrix.needsUpdate = true;
      resources.beats.needsUpdate = true;
    },

    setVisible: (visible) => {
      resources.mesh.visible = visible;
    },

    dispose: () => {
      options.scene.remove(resources.mesh);
      resources.mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * The model as one geometry, scaled onto the authored length and marked up
 * across the wings. The signed span is what the beat swings: it is fixed
 * geometry, so it is measured once here rather than derived per frame.
 */
function readBirdGeometry(
  asset: GLTF,
  appearance: BirdBodyAppearance,
): BufferGeometry {
  asset.scene.updateMatrixWorld(true);
  let source: Mesh | undefined;
  asset.scene.traverse((object) => {
    if (object instanceof Mesh && !source) source = object;
  });
  if (!source) throw new Error("The bird model holds no mesh");

  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error("The bird model has no measurable bounds");

  const modelLength = bounds.max.z - bounds.min.z;
  const halfSpan = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
  if (modelLength <= 0 || halfSpan <= 0) {
    throw new Error("The bird model has no measurable length or span");
  }
  geometry.scale(
    appearance.lengthMeters / modelLength,
    appearance.lengthMeters / modelLength,
    appearance.lengthMeters / modelLength,
  );

  const positions = geometry.attributes.position;
  if (!positions) throw new Error("The bird model holds no positions");
  const scaledHalfSpan = (halfSpan * appearance.lengthMeters) / modelLength;
  const span = new Float32Array(positions.count);
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    span[vertex] = positions.getX(vertex) / scaledHalfSpan;
  }
  // Per vertex, not per instance: every bird of the pool shares one pair of
  // wings and only the beat driving them differs.
  geometry.setAttribute("birdWingSpan", new BufferAttribute(span, 1));
  return geometry;
}

function createBirdMaterial(options: BirdBodiesOptions): MeshBasicMaterial {
  let source: Mesh | undefined;
  options.asset.scene.traverse((object) => {
    if (object instanceof Mesh && !source) source = object;
  });
  const sourceMaterial = Array.isArray(source?.material)
    ? source?.material[0]
    : source?.material;
  if (!sourceMaterial) throw new Error("The bird model holds no material");

  const material = createUnlitMaterial(
    sourceMaterial,
    options.appearance.color,
  );
  material.name = "bird-body";
  // The world fade goes on first so it wins the final colour, exactly as the
  // walking population is decorated.
  applyMaterialEffects(options.effects, material);
  applyShaderPatch(material, {
    cacheKey: WING_BEAT_CACHE_KEY,
    uniforms: {
      birdWingBeatRadians: { value: MOTION_SENSE_SETTINGS.birdWingBeatRadians },
      birdWingRootShare: { value: MOTION_SENSE_SETTINGS.birdWingRootShare },
    },
    vertexHeader: wingBeatShader,
    vertexAnchor: "#include <begin_vertex>",
    vertexCall: "transformed = applyBirdWingBeat(transformed);",
    fragmentHeader: "",
    colorFragmentCall: "",
  });
  return material;
}
