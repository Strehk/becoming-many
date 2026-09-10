import { expect, test } from "bun:test";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { START_SETTINGS } from "../start-exercises";
import { fillParticleVolume } from "./particle-volume";

// A shape-free point fixture verifies spatial depth, both layers and reproducibility.
test("volume has a bounded dense core and translucent halo in three dimensions", () => {
  const make = () =>
    new BufferGeometry().setAttribute(
      "position",
      new Float32BufferAttribute(new Float32Array(3000), 3),
    );
  const settings = START_SETTINGS.elementVolume;
  const first = fillParticleVolume(make(), settings);
  const second = fillParticleVolume(make(), settings);
  const positions = first.getAttribute("position");
  const opacity = first.getAttribute("elementOpacity");
  let haloCount = 0;
  let depth = 0;
  for (let index = 0; index < positions.count; index++) {
    const radius = Math.hypot(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    );
    const halo = opacity.getX(index) < settings.coreOpacity - 0.01;
    expect(radius).toBeLessThanOrEqual(
      halo
        ? settings.haloRadiusMeters + 1e-6
        : settings.coreRadiusMeters + 1e-6,
    );
    if (halo) haloCount++;
    depth = Math.max(depth, Math.abs(positions.getZ(index)));
  }
  expect(haloCount).toBeGreaterThan(100);
  expect(haloCount).toBeLessThan(400);
  expect(depth).toBeGreaterThan(settings.coreRadiusMeters);
  expect(positions.array).toEqual(second.getAttribute("position").array);
  first.dispose();
  second.dispose();
});
