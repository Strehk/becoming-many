import {
  type BufferGeometry,
  Color,
  Float32BufferAttribute,
  Vector2,
  Vector3,
} from "three";
import type { PathParticleMaterial } from "../flight-path/particle-contract";
import type {
  ElementRetirement,
  ParticleLight,
  ParticleLightFrame,
  ParticleLightSettings,
  VolumeSettings,
} from "./particle-contract";
import grainShader from "./particle-grain.frag.glsl?raw";
import grainVertex from "./particle-grain.vert.glsl?raw";

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

interface LightOptions {
  readonly settings: ParticleLightSettings;
  readonly animation: ParticleLight;
  readonly retirement: ElementRetirement;
  readonly reveal?: Float32Array;
}

// 2. Per-particle opacity preserves black pigment while softening the outer cloud
/** Extend an injected material; ownership and its existing wind/size treatment are preserved. */
export function createVolumeMaterial(
  material: PathParticleMaterial,
  settings: VolumeSettings,
  light: LightOptions,
): PathParticleMaterial {
  const uniforms = createVolumeUniforms(settings, light.settings);
  const points = material.pointsMaterial;
  const compileBase = points.onBeforeCompile.bind(points);
  const baseKey = points.customProgramCacheKey();
  points.onBeforeCompile = (shader, renderer) => {
    compileBase(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.uniforms.elementPresence = { value: light.retirement.presence };
    shader.uniforms.elementReveal = {
      value:
        light.reveal ??
        new Float32Array(light.retirement.presence.length).fill(1),
    };
    shader.vertexShader = patchVolumeVertex(shader.vertexShader).replaceAll(
      "ELEMENT_CAPACITY",
      String(light.settings.capacity),
    );
    shader.fragmentShader = patchVolumeFragment(shader.fragmentShader);
  };
  points.customProgramCacheKey = () =>
    `${baseKey}:particle-volume-directional-light-wind-v12:${light.settings.capacity}`;
  return {
    pointsMaterial: points,
    update(seconds) {
      material.update(seconds);
      updateLightUniforms(
        light.animation.update(seconds),
        uniforms.elementEffects.value,
      );
    },
  };
}

function updateLightUniforms(
  frames: readonly ParticleLightFrame[],
  effects: Vector2[],
): void {
  frames.forEach((frame, index) => {
    effects[index]?.set(frame.head, frame.strength);
  });
}

// Fixed uniform storage: update one record per element instead of every grain.
function createVolumeUniforms(
  settings: VolumeSettings,
  light: ParticleLightSettings,
) {
  return {
    elementEffects: {
      value: Array.from({ length: light.capacity }, () => new Vector2(-1, 0)),
    },
    elementLightColor: { value: new Color(light.color) },
    elementLightGain: { value: light.lightGain },
    elementLightSizeBoost: { value: light.lightSizeBoost },
    elementGlintStrength: { value: light.glintStrength },
    elementBandWidth: { value: light.bandWidth },
    elementGlassFraction: { value: light.glassFraction },
    elementRelief: { value: settings.relief },
    elementGrainSpread: { value: settings.grainSpreadMeters },
    elementAccentFraction: { value: settings.accentFraction },
  };
}

function patchVolumeVertex(source: string): string {
  return source
    .replace("#include <common>", `#include <common>\n${grainVertex}`)
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float seed = fract(sin(elementSeed * 137.0 + grainIndex * 91.7) * 43758.5453);
      transformed = placeElementGrain(seed);
    `,
    )
    .replace(
      "transformed = animateAirParticle(transformed);",
      "transformed = animateAirParticle(transformed, seed * 6.28318530718);",
    )
    .replace(
      "gl_PointSize = size * pathParticleSize;",
      "gl_PointSize = size * pathParticleSize * (seed < elementAccentFraction ? 1.8 : 0.45 + seed * 0.55) * (1.0 + grainLight * elementLightSizeBoost);",
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
