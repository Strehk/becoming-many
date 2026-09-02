/**
 * Purpose: Verify the sky presentation produced by Magnetic Sense.
 * Context: The sense is the previous version's shimmer sky, ported and hardcoded.
 * Responsibility: Cover the ported shader math, uniform wiring, dome lifecycle, clock, and validation.
 * Boundary: Visual fidelity against the previous build requires side-by-side acceptance.
 */

import { expect, test } from "bun:test";
import {
  BackSide,
  Color,
  type Mesh,
  Scene,
  type ShaderMaterial,
  Vector3,
} from "three";
import {
  createMagneticSense,
  type MagneticSenseOptions,
  type MagneticSenseParameters,
} from "../../src/modules/magnetic-sense/magnetic-sense";
import { MAGNETIC_SENSE_SETTINGS } from "../../src/modules/magnetic-sense/magnetic-sense-settings";

// These modules never read the view distance; the value only completes the
// contract. It matches the Three.js default far plane.
const DEFAULT_VIEW_DISTANCE_METERS = 2_000;

const PARAMETERS: MagneticSenseParameters = {
  intensity: 1,
  fieldDirectionDegreesFromNorth: 0,
  fieldElevationDegrees: 7.5,
  colors: {
    northColor: 0x000000,
    southColor: 0xffffff,
    zenithColor: 0xc4d7f6,
  },
};

function createOptions(): MagneticSenseOptions {
  return {
    scene: new Scene(),
    viewpoint: {
      worldPosition: new Vector3(),
      viewDistanceMeters: DEFAULT_VIEW_DISTANCE_METERS,
    },
    skyHazeColor: 0xf1f1f1,
  };
}

function loadDome(
  options: MagneticSenseOptions,
  parameters: MagneticSenseParameters = PARAMETERS,
): { handle: ReturnType<typeof createMagneticSense>; dome: Mesh } {
  const handle = createMagneticSense(parameters, options);
  handle.module.load();
  const dome = options.scene.children[0];
  if (!dome || !("material" in dome)) {
    throw new Error("Loading the sense must add the dome to the scene");
  }

  return { handle, dome: dome as Mesh };
}

test("Magnetic Sense carries the whole sky on one opaque dome", () => {
  const options = createOptions();
  const { dome } = loadDome(options);
  const material = dome.material as ShaderMaterial;

  // An opaque backdrop drawn first: never lit, never writing depth, one call.
  expect(options.scene.children).toHaveLength(1);
  expect(material.side).toBe(BackSide);
  expect(material.depthWrite).toBe(false);
  expect(material.transparent).toBe(false);
  expect(dome.renderOrder).toBe(-1);
  expect(dome.frustumCulled).toBe(false);
  expect(dome.visible).toBe(false);
});

test("Magnetic Sense keeps the ported shimmer math", () => {
  const options = createOptions();
  const { dome } = loadDome(options);
  const shader = (dome.material as ShaderMaterial).fragmentShader;

  // The previous version's four-octave value noise, unrolled rather than looped.
  expect(shader).toContain("43758.5453");
  expect(shader).toContain("vec3(11.5, 21.7, 31.9)");
  expect(shader).not.toContain("for (");
  // Its pole zone, grain threshold, and iridescent phase offsets.
  expect(shader).toContain("pow(clamp(axial + breathe, 0.0, 1.0)");
  expect(shader).toContain("smoothstep(0.34, 0.66, noise)");
  expect(shader).toContain("sin(phase + 2.09)");
  // One coherent early-out keeps the noise off the open sky.
  expect(shader).toContain("if (amount > PATTERN_CUTOFF)");
  // Colors arrive linear and the dome converts on output like every other
  // material in the world.
  expect(shader).toContain("#include <colorspace_fragment>");
  // The ground lines are gone for good.
  expect(shader).not.toContain("magneticWorldPosition");
});

test("Magnetic Sense hardcodes the previous version's saved sky values", () => {
  const options = createOptions();
  const { dome } = loadDome(options);
  const uniforms = (dome.material as ShaderMaterial).uniforms;
  const shimmer = MAGNETIC_SENSE_SETTINGS.shimmer;

  // Ported from `state.json`, module `magnetfeld`, mode `birdspec`.
  expect(shimmer.grainFrequency).toBe(30);
  expect(shimmer.baseAmount).toBe(0);
  expect(shimmer.poleAmount).toBe(2.85);
  expect(shimmer.poleWidthExponent).toBe(20);
  expect(shimmer.iridescence).toBe(0.7);
  expect(uniforms.magneticGrainFrequency?.value).toBe(30);
  expect(uniforms.magneticPoleWidth?.value).toBe(20);
  // A quiet open sky is what lets the early-out skip the noise there.
  expect(uniforms.magneticBaseAmount?.value).toBe(0);
  // Drift heading 60° from north at 0.4 per second, with its vertical part.
  const drift = uniforms.magneticDriftVelocity?.value;
  expect(drift.x).toBeCloseTo(Math.sin(Math.PI / 3) * 0.4, 9);
  expect(drift.y).toBeCloseTo(0.25 * 0.4, 9);
  expect(drift.z).toBeCloseTo(Math.cos(Math.PI / 3) * 0.4, 9);
});

test("Magnetic Sense tilts the field axis above the northern horizon", () => {
  const options = createOptions();
  const { dome } = loadDome(options);
  const axis = (dome.material as ShaderMaterial).uniforms.magneticFieldAxis
    ?.value;

  // North is +Z here, where the previous version used −Z.
  expect(axis.x).toBeCloseTo(0, 9);
  expect(axis.y).toBeCloseTo(Math.sin((7.5 * Math.PI) / 180), 9);
  expect(axis.z).toBeCloseTo(Math.cos((7.5 * Math.PI) / 180), 9);
  expect(axis.length()).toBeCloseTo(1, 9);
});

test("Magnetic Sense sends the authored palette to the dome", () => {
  const options = createOptions();
  const { dome } = loadDome(options);
  const uniforms = (dome.material as ShaderMaterial).uniforms;

  expect(uniforms.magneticNorthColor?.value.getHex()).toBe(0x000000);
  expect(uniforms.magneticSouthColor?.value.getHex()).toBe(0xffffff);
  expect(uniforms.magneticZenithColor?.value.getHex()).toBe(0xc4d7f6);
  // The horizon carries the level haze, so the dome meets the fogged distance.
  expect(uniforms.magneticHorizonColor?.value.getHex()).toBe(0xf1f1f1);
  expect(uniforms.magneticIntensity?.value).toBe(1);
});

test("Magnetic Sense wraps its clock far outside the length of a show", () => {
  const options = createOptions();
  const { handle, dome } = loadDome(options);
  const uniforms = (dome.material as ShaderMaterial).uniforms;

  handle.module.update?.(1.5);
  expect(uniforms.magneticTime?.value).toBe(1.5);

  // The drift is linear, so the wrap is a visible step and must stay far away.
  expect(MAGNETIC_SENSE_SETTINGS.animationLoopSeconds).toBeGreaterThanOrEqual(
    3600,
  );
  handle.module.update?.(MAGNETIC_SENSE_SETTINGS.animationLoopSeconds - 1.5);
  expect(uniforms.magneticTime?.value).toBe(0);
});

test("Magnetic Sense keeps the show drivers reaching the dome", () => {
  const options = createOptions();
  const { handle, dome } = loadDome(options);
  const uniforms = (dome.material as ShaderMaterial).uniforms;

  // One strength for the whole sense, written while the show runs.
  handle.setIntensity(0.25);
  expect(uniforms.magneticIntensity?.value).toBe(0.25);

  // The dome is opaque, so its horizon must follow a lerping clear color or
  // the sky would split from the fogged distance.
  handle.setSkyBackground(new Color(0x203040));
  expect(uniforms.magneticHorizonColor?.value.getHex()).toBe(0x203040);
});

test("Magnetic sky dome follows the world module lifecycle", () => {
  const options = createOptions();
  const { handle, dome } = loadDome(options);

  handle.module.activate();
  expect(dome.visible).toBe(true);

  options.viewpoint.worldPosition.set(12, 34, -56);
  handle.module.update?.(0.016);
  expect(dome.position.toArray()).toEqual([12, 34, -56]);

  handle.module.deactivate();
  expect(dome.visible).toBe(false);

  handle.module.unload();
  expect(options.scene.children).toHaveLength(0);
});

test("Magnetic Sense keeps the field axis out of the ground", () => {
  expect(() =>
    createMagneticSense(
      { ...PARAMETERS, fieldElevationDegrees: -5 },
      createOptions(),
    ),
  ).toThrow(
    "Magnetic field elevation must lie between the horizon and the zenith",
  );
});

test("Magnetic Sense rejects an intensity above full strength", () => {
  expect(() =>
    createMagneticSense({ ...PARAMETERS, intensity: 1.5 }, createOptions()),
  ).toThrow("Magnetic intensity must be between zero and one");
});
