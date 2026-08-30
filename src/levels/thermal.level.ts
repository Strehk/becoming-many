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
    // its colors were taken away from it. Exposed ground tips into cyan, a
    // plant runs from blue at its outermost foliage inward through cyan and
    // magenta to orange at its core, and only a living body reaches the
    // yellow at the top.
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
      // plant is still not one temperature — but the temperatures it holds
      // belong to it, and they are laid out along its own shape instead of
      // scattered across it. The base is what the trunk itself holds, and it
      // sits high on the ramp on purpose: a plant is read from its core
      // outward now, so the authored warmth is the core's warmth and
      // everything else on the plant is measured as a loss away from it.
      // One gradient shapes the plant, and it is radial. Warmth falls with
      // horizontal distance from the plant's own vertical axis, so the trunk
      // line runs hottest from base to crown top, the inner crown beside it
      // falls back through magenta, the mid canopy through cyan, and the
      // outermost foliage — the part actually exposed to the sky — arrives at
      // blue. It is a smooth continuous function of where a point sits on the
      // plant, so every intermediate color between core and edge is genuinely
      // visited on the way rather than jumped over.
      // The height gradient is off. It used to carry the plant's range
      // upward, which made a crown top and a trunk base two temperatures for
      // a reason that had nothing to do with the plant's structure, and it
      // fought the radial reading: a point far out on a high branch and a
      // point on the trunk beside it could arrive at the same warmth from
      // opposite directions, so depth into the crown stopped meaning
      // anything. At zero the trunk axis holds one temperature over its whole
      // length and distance from that axis is the only thing that changes the
      // reading, which is what lets a tree read as a warm core inside a
      // cooler shell rather than as a warm top.
      // The spread between plants is nearly closed. It is the one value that
      // moves a whole plant at once, and a stand does not need it: neighbours
      // separate through their own radial gradients and their own places in
      // the world, while a spread wide enough to be read as a difference in
      // overall color was exactly what made two adjacent trees look like two
      // different substances. What is left is a hint, well inside one band.
      // The texture is noise and the contrast curve steepens whatever it is
      // given, so together they are what turn a gradient into hard
      // boundaries: warm beside cold with nothing in between, isolated cold
      // specks inside a warm crown. Both are pulled well back. The texture is
      // now shallow enough that it can only shade the color the gradient
      // already chose and never carry a fragment into a neighbouring band,
      // and the curve is applied lightly enough to keep the core-to-edge
      // falloff separated without sharpening the grain inside it into edges.
      // The plant's whole range comes from the radial gradient now; the
      // texture is only what keeps foliage from reading as painted plastic.
      // Only tall plants have the radius to span that range. A bush is under
      // a metre across, so it loses little on the way out and reads near its
      // own core temperature — one small warm thing in a meadow rather than a
      // gradient too small to see.
      vegetationWarmth: 0.8,
      vegetationWarmthSpread: 0.05,
      vegetationHeightWarmthPerMeter: 0,
      vegetationAxisWarmthPerMeter: -0.22,
      vegetationTextureWarmth: 0.1,
      vegetationContrast: 0.22,
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
    // cold end and stop at saturated cyan; a plant spans blue to orange from
    // its outer foliage inward; only a living body reaches yellow.
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
    // Plants no longer reach the bottom of the ramp. Their floor sits where
    // blue is fully reached, which is where the outermost foliage lands, so a
    // crown fades out into cold blue rather than into the near-black the
    // ground's own hollows use: a plant sharing the ground's darkest color
    // stops reading as a separate object standing in it. Their ceiling still
    // sits exactly where orange is fully reached, so the trunk core is
    // allowed that color and one tree covers blue through cyan and magenta to
    // orange along its own radius, with no stretch of it left flat. Yellow
    // stays out of reach. A living body's floor is lifted far higher: it sits
    // above the warm stop, so the coolest reading anywhere on an animal — a
    // hoof tip, an antler end, the end of a tail — is a full magenta, and
    // nothing on a body can arrive at the cyan the landscape ends on. That is
    // a far narrower band than a plant's, deliberately: an animal is one warm
    // thing, and the whole of it has to read that way.
    bands: {
      terrain: { floorWarmth: 0, ceilingWarmth: 0.48 },
      vegetation: { floorWarmth: 0.16, ceilingWarmth: 0.86 },
      rocks: { floorWarmth: 0, ceilingWarmth: 0.48 },
      animals: { floorWarmth: 0.72, ceilingWarmth: 1 },
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
    // Warm-blooded animals are the hottest thing in the world, and every part
    // of one is warm. The core reaches the yellow end of the ramp outright,
    // and the falloff carries neck, head, legs, and tail down through orange
    // into magenta — and stops there. It is short, because the distance from
    // a chest to a hoof is not a reason for a leg to read as ground: a body
    // is warm all over and merely warmest in the middle, and a falloff long
    // enough to reach the cold colors describes a body cooling rather than an
    // animal standing. What is left is a genuine gradient — magenta at the
    // extremities, orange across neck and flank, yellow at the core — so the
    // shape is still contoured, only entirely within the warm colors.
    actorWarmth: 0.96,
    actorExtremityFalloff: 0.2,
    // About a third of what the core-to-limb falloff spans, and the shader
    // still eases it off above the quiet warmth: the coat mottles, but only
    // within the color the falloff has already put there. It used to be deep
    // enough to move a patch of flank a whole band away from the flank around
    // it, which is what put cold speckle inside a warm body.
    actorTextureWarmth: 0.07,
    // The curve is applied lightly now. At its old strength it pushed the
    // core to full heat and drove everything below the pivot steeply down,
    // which is most of why limbs left the warm range at all; the band floor
    // then caught them at the bottom and flattened them against it. Softened
    // to this it still lifts the core clear of the torso and keeps the
    // gradations along a leg apart from one another, without manufacturing
    // the fall it is only meant to shape.
    actorContrast: 0.3,
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
