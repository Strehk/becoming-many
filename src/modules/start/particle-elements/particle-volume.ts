import { type BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { PathParticleMaterial } from "../flight-path/particle-contract";
import type { VolumeSettings } from "./particle-contract";

// 1. Shared volume distribution: dense center with a sparse, translucent dust envelope
/** Mutate owned particle geometry; local shape samples remain independent of this material treatment. */
export function fillParticleVolume(
  geometry: BufferGeometry,
  settings: VolumeSettings,
): BufferGeometry {
  const positions = geometry.getAttribute("position");
  const opacity = new Float32Array(positions.count);
  const random = createRandom(settings.seed);
  const offset = new Vector3();
  for (let index = 0; index < positions.count; index++) {
    opacity[index] = sampleVolume(settings, random, offset);
    positions.setXYZ(
      index,
      positions.getX(index) + offset.x,
      positions.getY(index) + offset.y,
      positions.getZ(index) + offset.z,
    );
  }
  geometry.setAttribute(
    "elementOpacity",
    new Float32BufferAttribute(opacity, 1),
  );
  geometry.computeBoundingSphere();
  return geometry;
}

function sampleVolume(
  settings: VolumeSettings,
  random: () => number,
  offset: Vector3,
): number {
  const halo = random() < settings.haloFraction;
  const radius = halo ? settings.haloRadiusMeters : settings.coreRadiusMeters;
  const azimuth = random() * Math.PI * 2;
  const height = random() * 2 - 1;
  const distance = radius * Math.cbrt(random());
  const horizontal = Math.sqrt(1 - height * height) * distance;
  offset.set(
    Math.cos(azimuth) * horizontal,
    height * distance,
    Math.sin(azimuth) * horizontal,
  );
  return halo
    ? settings.haloOpacity.from +
        random() * (settings.haloOpacity.to - settings.haloOpacity.from)
    : settings.coreOpacity;
}

function createRandom(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// 2. Per-particle opacity preserves black pigment while softening the outer cloud
/** Extend an injected material; ownership and its existing wind/size treatment are preserved. */
export function createVolumeMaterial(
  material: PathParticleMaterial,
): PathParticleMaterial {
  const points = material.pointsMaterial;
  const compileBase = points.onBeforeCompile.bind(points);
  const baseKey = points.customProgramCacheKey();
  points.onBeforeCompile = (shader, renderer) => {
    compileBase(shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float elementOpacity;\nvarying float volumeOpacity;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvolumeOpacity = elementOpacity;",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying float volumeOpacity;",
      )
      .replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\ndiffuseColor.a *= volumeOpacity;",
      );
  };
  points.customProgramCacheKey = () => `${baseKey}:particle-volume-v1`;
  return material;
}
