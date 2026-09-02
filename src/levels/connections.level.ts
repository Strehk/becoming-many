/**
 * Purpose: Define the Connections level preset (the final synthesis, level 07).
 * Context: Connections (level 07) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as magneticLevel } from "./magnetic.level";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Magnetic preset verbatim;
  // every earlier sense stays at full strength while the underground web
  // reveals the relationships between the elements they already show.
  ...magneticLevel,
  // Animals are deliberately absent from the sources: a root system is what
  // stands still and grows, and a body walking over it is not part of it. The
  // module's live actor links stay unauthored here.
  // New in level 07: no further biological sense. The moodboard palette
  // #F2E3D3 #683B5A #292E55 #A5BDC3 #D06780 #E39E54 colors the web. A
  // pulsing root system lies in the opened soil under the unchanged carried
  // world, connecting the same deterministic positions the earlier senses
  // source.
  connections: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Reach before density (the grass module's rule): a root system carried
    // at the wurzeln experiment's density cannot also span the horizon, so
    // the mat is an intimate zone the visitor walks inside rather than a
    // web seen across the valley. It stays inside the guaranteed topology
    // window coverage.
    webRadiusMeters: 30,
    // Underground and slow, against the magnetic pulses crossing the sky:
    // nutrients, not signals. Slower than the sparse web's four metres per
    // second because the mat is now a third of its reach: the crawl is the
    // authored quality, and it is the crossing time that carries it.
    pulseSpeedMetersPerSecond: 1.5,
    sources: {
      vegetation: { nodeColor: 0xa5bdc3, weight: 1 },
      scentEmitters: { nodeColor: 0xd06780, weight: 1 },
      rocks: { nodeColor: 0x292e55, weight: 0.25 },
      // The mat itself: dense, and deliberately the lightest pull of all, so
      // hubs stay on the world's real elements and the soil stays connective
      // tissue rather than becoming the subject. Bone, because real mycelium
      // is white and because it is the strongest contrast this palette has
      // against the ground the mat is read through: thermal's cold half
      // (`#0E0628` to `#1C6C8B`), echo's grey, and the grass above it.
      soil: { nodeColor: 0xf2e3d3, weight: 0.2 },
    },
    colors: {
      // Plum: the cord midpoints sink toward this, so a strand reads bone at
      // its anchors and dusk in the middle — the shading that makes a flat
      // ribbon read as a round root going down.
      depthColor: 0x683b5a,
      // Amber, because the cords are now bone: cream pulses on cream strands
      // would be no pulses at all. Warm against the mat's neutral white.
      pulseColor: 0xe39e54,
    },
  },
};
