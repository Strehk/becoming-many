import { type BufferGeometry, Float32BufferAttribute, Vector3 } from "three";
import type { PathParticleMaterial } from "../flight-path/particle-contract";
import type { VolumeSettings } from "./particle-contract";
import grainShader from "./particle-grain.frag.glsl?raw";

// 1. Shared volume distribution: dense center with a sparse, translucent dust envelope
/** Mutate owned particle geometry; local shape samples remain independent of this material treatment. */
export function fillParticleVolume(
  geometry: BufferGeometry,
  settings: VolumeSettings,
): BufferGeometry {
  const positions = geometry.getAttribute("position");
  const opacity = new Float32Array(positions.count);
  const seeds = new Float32Array(positions.count);
  const sizes = geometry.getAttribute("pathParticleSize");
  const random = createRandom(settings.seed);
  const offset = new Vector3();
  const point = new Vector3();
  for (let index = 0; index < positions.count; index++) {
    seeds[index] = random();
    const particleOpacity = sampleVolume(settings, random, offset);
    opacity[index] = particleOpacity;
    const scale =
      particleOpacity === settings.coreOpacity
        ? settings.coreSizeScale
        : settings.haloSizeScale;
    if (sizes) sizes.setX(index, sizes.getX(index) * scale);
    point.fromBufferAttribute(positions, index).add(offset);
    positions.setXYZ(index, point.x, point.y, point.z);
  }
  geometry.setAttribute(
    "elementOpacity",
    new Float32BufferAttribute(opacity, 1),
  );
  geometry.setAttribute("elementSeed", new Float32BufferAttribute(seeds, 1));
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
  const distance = radius * (halo ? Math.cbrt(random()) : random() ** 0.65);
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
  settings: VolumeSettings,
): PathParticleMaterial {
  const points = material.pointsMaterial;
  const compileBase = points.onBeforeCompile.bind(points);
  const baseKey = points.customProgramCacheKey();
  points.onBeforeCompile = (shader, renderer) => {
    compileBase(shader, renderer);
    shader.uniforms.elementRelief = { value: settings.relief };
    shader.uniforms.elementGrainSpread = { value: settings.grainSpreadMeters };
    shader.uniforms.elementAccentFraction = { value: settings.accentFraction };
    shader.vertexShader = patchVolumeVertex(shader.vertexShader);
    shader.fragmentShader = patchVolumeFragment(shader.fragmentShader);
  };
  points.customProgramCacheKey = () =>
    `${baseKey}:particle-volume-instanced-grains-v5`;
  return material;
}

function patchVolumeVertex(source: string): string {
  return source
    .replace(
      "#include <common>",
      `#include <common>
      attribute float elementOpacity;
      attribute float elementSeed;
      attribute vec3 elementCenter;
      attribute float grainIndex;
      uniform float elementGrainSpread;
      uniform float elementAccentFraction;
      varying float volumeOpacity;
    `,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      volumeOpacity = elementOpacity;
      float seed = fract(sin(elementSeed * 137.0 + grainIndex * 91.7) * 43758.5453);
      vec3 grainOffset = vec3(sin(seed * 137.0), cos(seed * 93.0), sin(seed * 71.0));
      transformed = elementCenter + grainOffset * elementGrainSpread * sqrt(seed);
    `,
    )
    .replace(
      "gl_PointSize = size * pathParticleSize;",
      "gl_PointSize = size * pathParticleSize * (seed < elementAccentFraction ? 1.8 : 0.45 + seed * 0.55);",
    );
}

function patchVolumeFragment(source: string): string {
  return source
    .replace("#include <common>", `#include <common>\n${grainShader}`)
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor = shadeElementGrain(diffuseColor);",
    );
}
