/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as motionLevel } from "./motion.level";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Motion Perception preset
  // verbatim; the heat view exists only inside a viewer-centred radius, and
  // outside it the carried Motion world shows unchanged.
  ...motionLevel,
  // New in level 05: warm bodies against the carried grayscale world. Fur
  // colors come from the level-03 dark stops so animals outside the thermal
  // radius sit inside the echo palette like vegetation does.
  animals: {
    colors: {
      furColor: 0x171717,
      lightFurColor: 0x494949,
      darkFurColor: 0x101010,
      featureColor: 0x101010,
    },
  },
  // Level 05 palette from docs/levels/README.md: #2E1386 #0C47D1 #2EB4E8
  // #D5198A #FB5F16 #FCCE43, mapped cold to hot. Five of the six stops are
  // those documented colors verbatim; the coldest is the one deviation, and
  // it is described where it is authored below. How far up the warmth range
  // each stop is reached is set by the ramp thresholds the module owns.
  thermal: {
    // Full sense strength until a dramaturgy driver exists.
    intensity: 1,
    // Heat is a near sense, and narrowly so: the false-color view reaches 35
    // metres and feathers back into the echo ramp far inside its 96 m far
    // distance. Most of what the viewer can see is therefore still the
    // carried grey world, and heat is a pool that travels with them — a tree
    // or an animal holds its temperature back until they come close enough
    // to be inside its reach, which is the sense behaving like a sense
    // rather than like a filter over the whole image. The feather stays at
    // about a third of the radius, so the handover to the echo ramp keeps
    // the same softness at any reach.
    radiusMeters: 35,
    edgeFeatherMeters: 12,
    // Heat seen through the carried grey world rather than painted over it,
    // and translucently enough that more than two fifths of the echo ramp
    // survives on every sensed surface. That ramp is the only true luminance
    // the heat view owns — near-dark to far-pale, shaded by the world's own
    // form — so the more of it survives, the more the image reads as
    // structure at a distance rather than as temperature painted flat. It
    // stops short of half because the blend is one shared value: past this
    // the warm bodies grey out with the ground, and they are the one thing
    // that must stay legible as heat.
    carriedColorBlend: 0.42,
    // The full moodboard ramp, cold to hot. A neutral cold end was tried here
    // and reverted: draining the hue out of violet and blue did let the
    // carried echo world show through cold ground, but it left the level
    // looking like the echolocation world with warm objects standing in it
    // rather than like a thermal image, which reads cold to hot as violet
    // through yellow. What that experiment reached for is done by the ramp
    // thresholds instead — the ground is held in violet, blue, and cyan
    // because magenta now begins above anything it can measure, not because
    // its colors were taken away from it. Exposed ground tips into cyan,
    // plants climb through magenta into orange, and only a living body
    // reaches the yellow at the top.
    // The coldest stop is the one place the moodboard is departed from, and
    // only in value: the documented #2E1386 is carried down its own hue to
    // near-black. A thermal image has a black floor, and this ramp had none —
    // its coldest reading was a lit violet, so the shadowed depths inside a
    // crown, the cold hollows of the ground, and deep water all bottomed out
    // on a color bright enough to read as a surface rather than as absence.
    // The hue is kept, so the cold end still runs violet into blue and the
    // level still reads cold to hot rather than dark to light; what changes
    // is that the bottom of the ramp can now actually go dark. It stays a
    // near-black violet rather than true black because the carried echo world
    // keeps its own share of every sensed surface, and a black stop under
    // that share reads as a hole in the image instead of as cold.
    colors: {
      coldestColor: 0x0e0628,
      coldColor: 0x0c47d1,
      coolColor: 0x2eb4e8,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      // Plants are the warmest thing in the world that is not alive, and one
      // plant is not one temperature. The base is what a shaded stem holds,
      // and the two gradients carry heat up the plant and outward from its
      // axis, so a single tree spans most of the ramp by itself: a stem
      // climbing out of violet through blue into cyan, a shaded inner crown
      // in magenta, and fine outer foliage exposed to the sky reaching
      // orange. Only tall plants gain much from it, so a low shrub still
      // reads near its own stem temperature and stays the warmer substance
      // where it stands in an open meadow.
      // The height gradient is deliberately held short of what would drive a
      // crown top through the band ceiling. Readings that pile into the knee
      // all come back at the same orange, and a canopy flattened into one
      // color at the top is exactly the reading this is meant to break. What
      // it gives up there the axis gradient takes over, so depth into the
      // crown reads as temperature rather than the crown reading as a warm
      // shell: outer branches run warmest, and the interior beside the stem
      // falls back through magenta toward the cyan of the stem itself.
      // The spread between plants is narrow. It is the one value that moves a
      // whole plant at once, and while a stand does need to read as many
      // separate plants, a spread wide enough to carry that alone was also
      // enough to lift an entire tree into one color band and hide everything
      // happening inside it.
      // Which of the two sources carries the plant's range is the whole
      // question here, because they do not read alike. The gradients are
      // smooth continuous functions of where a point sits on the plant, so
      // what they produce is layered: a stem passing through blue, cyan, and
      // magenta on its way to an orange crown, every intermediate color
      // actually visited on the way. The texture is noise, and the contrast
      // curve steepens whatever it is given, so the two together turn gentle
      // variation into hard boundaries — warm beside cold with nothing in
      // between, a canopy of isolated dots rather than a thermally layered
      // one. They had been carrying most of the range, and the texture was
      // the deepest in the world by a clear margin.
      // So the range moves onto the gradients, which are widened to carry it,
      // and the texture drops back to what it should have been all along:
      // subtle local variation riding on a broad gradient, still deep enough
      // that foliage reads as uneven heat rather than as a painted surface.
      // The curve softens with it. Its job is to separate readings that sit
      // close together, and at this depth the texture no longer needs pulling
      // apart — steepening it any further only sharpens the boundaries inside
      // the noise into edges. The detail survives; what goes is the hardness
      // between one patch of it and the next.
      vegetationWarmth: 0.32,
      vegetationWarmthSpread: 0.18,
      vegetationHeightWarmthPerMeter: 0.052,
      vegetationAxisWarmthPerMeter: 0.034,
      vegetationTextureWarmth: 0.4,
      vegetationContrast: 0.52,
      // Rock is cold, heavy substance: it sits near the ground's own range,
      // warmest on the face the sun reaches and cooler down its flanks.
      // It was the last solid thing left in the image: the ground around it
      // had been broken into mottled, high-contrast patches while rock still
      // carried one near-flat temperature, so every boulder read as a pasted
      // shape. Its texture, its spread between instances, and its contrast
      // now sit in the same register as the ground it lies on.
      rockWarmth: 0.2,
      rockWarmthSpread: 0.18,
      rockHeightWarmthPerMeter: 0.05,
      rockAxisWarmthPerMeter: -0.03,
      rockTextureWarmth: 0.24,
      rockContrast: 0.52,
    },
    // What each material's own substance may reach, whatever its elevation,
    // gradient, texture, and contrast add up to. Ground and rock fill the
    // cold end and stop at saturated cyan; plants climb through magenta into
    // orange where they are exposed; only a living body reaches yellow.
    // The ground's floor is open to the bottom of the ramp: the coldest
    // ground is allowed to go dark. Its ceiling once sat only just past the
    // cyan stop, and everything the ground measured above that — a forested
    // slope, a sunlit ridge, and the warm half of the texture laid over both
    // — was folded onto the one color, so the landscape read as a single
    // tone with dark patches punched into it. The ceiling stays open well
    // past that, and it is the ramp rather than the band that keeps the
    // ground cold now: the cyan stop was moved up to meet this ceiling, so
    // the ground's whole spread of readings separates across the cold end
    // and runs out at cyan without ever being clipped and without tipping
    // into magenta. Widening the range and holding the hue are the same
    // move made in two places.
    // Rock shares that range exactly, because it is the same cold substance
    // and any gap between the two showed up as boulders pasted on the ground.
    // Plants may fall as far as ground, so a shaded stem, the dark side of a
    // crown, and a low shrub sit in the dark with the ground they stand in;
    // the floor is open almost to the bottom of the ramp because a crown's
    // own shadowed depths have nowhere else to go. Their ceiling sits exactly
    // where orange is fully reached, so the most exposed foliage is allowed
    // that color and one tree covers violet to orange with no stretch of it
    // left flat. Yellow stays out of reach. A living body's
    // floor is lifted into the warm half instead: no part of an animal,
    // however far from its core, may fall back into the cold range the
    // landscape occupies, because an animal reading as ground temperature
    // stops being the heat this level is about.
    bands: {
      terrain: { floorWarmth: 0, ceilingWarmth: 0.48 },
      vegetation: { floorWarmth: 0.04, ceilingWarmth: 0.86 },
      rocks: { floorWarmth: 0, ceilingWarmth: 0.48 },
      animals: { floorWarmth: 0.5, ceilingWarmth: 1 },
    },
    // The organic texture over the ground: deep enough that no stretch of
    // ground holds one temperature anywhere, comparable now to the span the
    // elevation ramp itself covers. The landscape's shape still leads the
    // reading, but it arrives mottled rather than as flat fields of color,
    // and the patches that fall below the ground's floor go dark.
    terrainTextureWarmth: 0.28,
    // Definition: the ground's readings cluster low on the ramp, so pulling
    // them apart around that cluster separates hollow from ridge and forest
    // from meadow. The curve is steep now because everything below the
    // cluster is driven toward black by it: that is where the ground's depth
    // comes from, since a hollow has no shadow to cast and can only read
    // dark by reading cold.
    terrainContrast: 0.7,
    // Warm-blooded animals are the hottest thing in the world: the body core
    // reaches the yellow end of the ramp outright, and the falloff carries
    // legs, snouts, and tails back down through orange into magenta. That
    // falloff is shorter than it was, because the warm stops moved up: the
    // same drop that used to end in magenta would now end in the cyan the
    // ground occupies, which would hand the landscape's own color to the one
    // thing in the world that has to read as hot.
    actorWarmth: 0.96,
    actorExtremityFalloff: 0.32,
    // Over half of what the core-to-limb falloff spans, and the shader eases
    // it off above the quiet warmth: the coat over flanks, legs, and tail
    // breaks into uneven patches of heat, while the core the ease spares
    // stays smooth and keeps a defined edge against them.
    actorTextureWarmth: 0.24,
    // Living bodies get the strongest curve of anything in the world: it
    // pushes the core toward full heat and the limbs down past the warm
    // stop, so an animal reads as a contoured shape rather than a warm blob.
    actorContrast: 0.8,
    // A body warms what surrounds it, faintly and over a long distance. The
    // spread is several times the animal's own height and the falloff has a
    // gaussian tail, so the warmth thins out for metres without ever reaching
    // an edge that could read as a ring; the strength is what it adds
    // directly beneath the body, where the pool is at its warmest.
    heatEmission: {
      strength: 0.2,
      reachPerBodyHeight: 5,
    },
  },
};
