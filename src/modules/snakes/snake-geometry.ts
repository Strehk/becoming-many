/**
 * Purpose: Build the snake body the module draws, from the authored girth profile.
 * Context: The delivered model was one rigid 57,600-triangle tube that only slid.
 * Responsibility: Lay out rings along the body and mark every vertex with its place on it.
 * Boundary: The wave that moves it is the shader's; the profile is the definition's.
 */

import { BufferAttribute, BufferGeometry } from "three";
import { SNAKES_DEFINITION } from "./snakes-definition";

/**
 * One snake lying along +z, its head at the origin and its tail behind it, at
 * unit length. Every vertex carries how far along the body it sits, which is
 * what lets the shader run a wave down it without a bone anywhere.
 */
export function createSnakeGeometry(): BufferGeometry {
  const { ringCount, sideCount, girthProfile } = SNAKES_DEFINITION;
  const vertexCount = ringCount * sideCount;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const alongBody = new Float32Array(vertexCount);

  for (let ring = 0; ring < ringCount; ring += 1) {
    const along = ring / (ringCount - 1);
    const girth = readGirth(girthProfile, along);
    for (let side = 0; side < sideCount; side += 1) {
      const angle = (side / sideCount) * Math.PI * 2;
      const index = ring * sideCount + side;
      const offset = index * 3;
      // A snake lies on the ground: its section is wider than it is tall, so
      // it reads as a body pressed into the grass rather than as a pipe.
      positions[offset] = Math.cos(angle) * girth;
      positions[offset + 1] = Math.sin(angle) * girth * 0.62;
      positions[offset + 2] = along;
      normals[offset] = Math.cos(angle);
      normals[offset + 1] = Math.sin(angle);
      normals[offset + 2] = 0;
      alongBody[index] = along;
    }
  }

  const indices: number[] = [];
  for (let ring = 0; ring < ringCount - 1; ring += 1) {
    for (let side = 0; side < sideCount; side += 1) {
      const nextSide = (side + 1) % sideCount;
      const current = ring * sideCount;
      const next = (ring + 1) * sideCount;
      indices.push(
        current + side,
        next + side,
        current + nextSide,
        current + nextSide,
        next + side,
        next + nextSide,
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("snakeAlongBody", new BufferAttribute(alongBody, 1));
  geometry.setIndex(indices);
  return geometry;
}

/** The girth at one place on the body, read between the authored stops. */
function readGirth(profile: readonly number[], along: number): number {
  const lastStop = profile.length - 1;
  const place = Math.min(along, 1) * lastStop;
  const stop = Math.min(lastStop, Math.floor(place));
  const nextStop = Math.min(lastStop, stop + 1);
  const mix = place - stop;
  const girth = profile[stop] ?? 0;
  const nextGirth = profile[nextStop] ?? girth;
  return girth + (nextGirth - girth) * mix;
}
