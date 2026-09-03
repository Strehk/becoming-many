/**
 * Purpose: Define the Thermal Perception level preset ("Snake", level 05).
 * Context: Thermal Perception (level 05) develops in isolation before narrative integration.
 * Responsibility: Provide immutable level values to the shared world runtime.
 * Boundary: This file contains data only and creates no runtime resources.
 */

import type { LevelPreset } from "./level-runtime";
import { level as motionLevel } from "./motion.level";
import {
  sharedMotionSense,
  sharedMotionSenseBirds,
} from "./shared-level-values";

export const level: LevelPreset = {
  // Senses layer, never swap: the world carries the Motion Perception preset
  // verbatim; the heat view exists only inside a viewer-centred radius, and
  // outside it the carried Motion world shows unchanged.
  ...motionLevel,
  maximumGroundClearanceMeters: 50,
  // The one thing level 05 repaints in the carried Motion world. A bird is a
  // warm body, and a heat view that prints its trace in the cold accent of
  // the pale world says the opposite of what the sense is for. The trace
  // takes the palette's hot stop, the same orange the ramp gives a warm
  // surface, so a flock reads as heat crossing the sky.
  // The flies keep their indigo: an insect carries no warmth of its own, and
  // a swarm printed warm would be the level's brightest untruth.
  motion: {
    ...sharedMotionSense,
    birds: {
      ...sharedMotionSenseBirds,
      appearance: {
        ...sharedMotionSenseBirds.appearance,
        trailColor: 0xfb5f16,
      },
      // New in level 05: the flocks get bodies. Movement without a body is
      // what level 04 is about, so the birds fly it as pure trace; the heat
      // view is the first sense that shows a warm body, and it shows theirs.
      // A blackbird's length, and the fur color the walking animals carry,
      // because a bird crossing the ring above stays outside the 35 m heat
      // view and reads in the echo palette like an unwarmed animal does.
      body: {
        lengthMeters: 0.26,
        color: 0x171717,
      },
    },
  },
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
  // #D5198A #FB5F16 #FCCE43, mapped cold to hot. The warm half is those
  // documented colors verbatim. The cold half deviates, and only ever in
  // value: all three cold stops are carried down their own hues so the
  // landscape they cover can read dark. Every deviation is described where
  // it is authored below. How far up the warmth range each stop is reached
  // is set by the ramp thresholds the module owns.
  thermal: {
    // Full strength in a standalone level; the show drives this at runtime.
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
    // structure at a distance rather than as temperature painted flat.
    // It was carried up to an even split to darken the cold ground and
    // brought back here again, because the blend is one shared value applied
    // to every sensed fragment at the same strength: it cannot be aimed at
    // the cold end, so buying darkness with it charges the warm bodies for
    // ground they are not standing on. The cold end pays for its own
    // darkness now, in the colors authored below, and this value is left
    // where it only has to do the thing it is actually for — keeping the
    // depth ramp's shading present underneath the heat image.
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
    // The cold half of the ramp is carried down to about three fifths of the
    // luminance the moodboard gives it, hue untouched. Blue stays blue and
    // cyan stays cyan; both simply stop being lit. The ground and the rock
    // on it live entirely inside these three stops — their band runs out
    // just past where cool is fully reached — so this is the whole landscape
    // being darkened, and it is darkened at the source rather than by
    // thinning the false color until the grey world shows through it. The
    // cyan is the stop that mattered most: it is the ceiling the ground
    // arrives at, so every exposed ridge and sunlit slope was landing on the
    // brightest color in the cold half and the landscape read lit from
    // within. Deepened, the ground ends dark and the warm half of the ramp
    // is left as the only bright thing in the image, which is what a thermal
    // view is supposed to say.
    colors: {
      coldestColor: 0x0e0628,
      coldColor: 0x072b7d,
      coolColor: 0x1c6c8b,
      warmColor: 0xd5198a,
      hotColor: 0xfb5f16,
      hottestColor: 0xfcce43,
    },
    surfaces: {
      // Plants are the warmest thing in the world that is not alive, and one
      // plant is still not one temperature — but the temperatures it holds
      // belong to it, and they are laid out along its own shape instead of
      // scattered across it. The base is what the plant holds where it meets
      // the ground, and it sits high on the ramp on purpose: warmth enters a
      // plant at the foot of its trunk, and everything else on it is measured
      // as a loss on the way out from there.
      // Two gradients shape the plant and they work as one. Both are negative
      // and close to equal, so warmth falls with height above the foot and
      // with distance out from the trunk line at nearly the same rate: what
      // they add up to is a single falloff away from the base of the trunk in
      // every direction at once. A point's reading is therefore set by
      // roughly how far it lies from where the plant is rooted, which is as
      // close as this level can come to how far heat had to travel through
      // the plant to reach it. The trunk is the warmest line in the tree
      // because it is the shortest path from the foot; it cools as it climbs,
      // and the crown around it cools further with every metre outward — so a
      // high outer twig, far from the foot by both measures, is the coldest
      // thing on the plant, and the low inner trunk is the hottest.
      // This replaces a purely radial reading. That one cooled outward from
      // the trunk line but gave the trunk itself no gradient at all: the whole
      // axis from root to crown top held one temperature, so a tree read as a
      // hot vertical column standing inside a cooler shell, which is a
      // description of the model's bounding cone rather than of the plant.
      // What none of this does is follow the plant's actual branches. The
      // shader is handed the offset from the instance origin and nothing else
      // — no skeleton, no branch topology, no branch thickness, and no way to
      // tell trunk geometry from foliage geometry, since both submeshes share
      // one set of uniforms. A gradient measured from the foot approximates
      // distance travelled through the plant; it does not measure it, and no
      // value in this file can turn it into a measurement. The conifers have
      // no branch geometry to follow in any case: their crowns are solid.
      // The spread between plants is nearly closed. It is the one value that
      // moves a whole plant at once, and a stand does not need it: neighbours
      // separate through their own gradients and their own places in the
      // world, while a spread wide enough to be read as a difference in
      // overall color was exactly what made two adjacent trees look like two
      // different substances. What is left is a hint, well inside one band.
      // The texture is what stands in for the structure the geometry does not
      // carry. It is a world-space noise field sampled per fragment — the one
      // thing in the level that varies across a flat face rather than along
      // it, which matters because these crowns are low-poly solids drawn with
      // an unlit material and nothing shades a facet by its normal. It breaks
      // the falloff into uneven warm masses and cold gaps at about half a
      // crown and below, so a canopy reads as patches of held heat rather than
      // as one airbrushed cone, and the silhouette stops being the only
      // structure there is to see. It is deepened again here because the
      // falloff it now breaks up spans the plant's whole range instead of the
      // crown's outer half, and a smooth field that wide is exactly what reads
      // as a solid. It stays below the ground's own depth, so foliage still
      // reads as the warmer substance. These masses are noise: they are not
      // the plant's branches and they do not know where its branches are.
      // The contrast curve steepens whatever it is given, so it is what turns
      // those masses into separate warm areas instead of soft blushes in one
      // continuous field. It is raised with the texture and for the same
      // reason, but held well short of full: the falloff from foot to tip has
      // to stay continuous, so that every color between orange and blue is
      // genuinely visited on the way out rather than jumped over.
      // Only tall plants have the reach to span that range. A bush stands
      // about a metre and is under a metre across, so it loses little from its
      // foot in either direction and reads near its base temperature — one
      // small warm thing in a meadow rather than a gradient too small to see.
      // Lowered from 0.84: a plant does not hold the heat that value gave it.
      // The base is what a low trunk reads, and everything above it is that
      // value shed by distance from the foot, so the base alone decides how
      // warm a whole plant is — and at 0.84 the contrast curve carried a foot
      // to full orange, the color this level reserves for a living body.
      // It costs the bushes most, which is the point: a bush is a metre tall
      // and a metre across, so it sheds almost nothing from its own foot and
      // reads at very nearly this value all over. That is why the bushes are
      // no longer authored here at all: they are a stature of their own now,
      // and these values describe only the plants that carry a canopy.
      vegetationWarmth: 0.76,
      vegetationWarmthSpread: 0.05,
      vegetationHeightWarmthPerMeter: -0.06,
      vegetationAxisWarmthPerMeter: -0.11,
      vegetationTextureWarmth: 0.26,
      vegetationContrast: 0.34,
      // Undergrowth, read from the meadow upward rather than from the canopy
      // down. A bush is a low body of leaf standing in grass, and every value
      // a tree earns by being tall is one a bush cannot earn: it has no stem
      // to hold heat at the bottom of, and no reach to shed heat over. Given
      // the trees' values it was the one thing in the landscape that held a
      // single warm color across its whole body, which read as a hot object
      // in a cold field rather than as scrub.
      // The base is the grass's own reading plus a little, so a bush and the
      // meadow around it are the same substance seen at two thicknesses. What
      // is left of the plant gradient is aimed at its middle: the falloff per
      // metre is steep for something a metre wide, so the heart of the bush
      // keeps the warmth and the outer leaf arrives back at the grass. The
      // texture and contrast are the grass's too, so the two carry one
      // register and a meadow does not change substance where a bush stands
      // in it. The spread between bushes is wider than the trees' because it
      // is the only variation a plant this small has: nothing else about it
      // separates one from the next.
      undergrowthWarmth: 0.42,
      undergrowthWarmthSpread: 0.07,
      undergrowthHeightWarmthPerMeter: -0.09,
      undergrowthAxisWarmthPerMeter: -0.16,
      undergrowthTextureWarmth: 0.28,
      undergrowthContrast: 0.5,
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
      // Grass is the ground, not the bushes standing in it. A meadow is a
      // thin layer over the soil and holds the soil's temperature; a canopy
      // holds its own. Authored just above the ground's own reading so the
      // grazed slopes read as grown rather than as painted, and given the
      // ground's texture depth and contrast so the two carry one register.
      grassWarmth: 0.34,
      grassTextureWarmth: 0.28,
      grassContrast: 0.5,
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
    // stops reading as a separate object standing in it. Their ceiling used to
    // sit exactly where orange is fully reached, which allowed the foot of a
    // trunk that color; it now sits below that stop, so the warmest thing a
    // plant can be is a warm magenta however its texture and contrast add up.
    // One tree still covers blue through cyan into magenta between its foot
    // and its farthest tips, with no stretch of it left flat — what it no
    // longer does is arrive at the color of a body. Orange and yellow
    // stay out of reach. A living body's floor is lifted far higher: it sits
    // above the warm stop, so the coolest reading anywhere on an animal — a
    // hoof tip, an antler end, the end of a tail — is a full magenta, and
    // nothing on a body can arrive at the cyan the landscape ends on. That is
    // a far narrower band than a plant's, deliberately: an animal is one warm
    // thing, and the whole of it has to read that way.
    bands: {
      terrain: { floorWarmth: 0, ceilingWarmth: 0.48 },
      vegetation: { floorWarmth: 0.16, ceilingWarmth: 0.82 },
      // Undergrowth is held just above the grass and nowhere near the canopy:
      // the ceiling leaves room for the little heat a bush keeps in its middle
      // and stops well below the magenta a tree's stem is allowed, and the
      // floor is the grass's, so an outer leaf may arrive at the meadow's own
      // color rather than at a plant's cold blue.
      undergrowth: { floorWarmth: 0, ceilingWarmth: 0.6 },
      rocks: { floorWarmth: 0, ceilingWarmth: 0.48 },
      // Barely wider than the ground's, and starting at the same floor: grass
      // may read a shade warmer than the soil under it, never like a plant.
      grass: { floorWarmth: 0, ceilingWarmth: 0.54 },
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
    // A body warms what it stands on, and almost nothing further. Both values
    // are cut hard from what they were, because radiated warmth is the one
    // reading in the level that is added after a material's band is applied:
    // it is the only thing allowed to carry ground past its own ceiling, and
    // at its old depth it did exactly that over a wide area, tipping the
    // landscape around an animal into the magenta that is supposed to mean a
    // living body. A hoofed animal was dragging a warm lake behind it.
    // The reach is a multiplier on the animal's own height, and the falloff
    // is gaussian in it, so what it sets is how quickly the pool dies rather
    // than where it ends. Just above one, a 1.6 m stag spreads about two
    // metres: the ground it stands on takes the full addition, two metres out
    // keeps about a third of it, and by four metres there is nothing left to
    // measure. That is a pool the size of the animal's own footing, which is
    // what a body pressed against cold ground would actually warm.
    // The strength is what it adds directly beneath the body, and a twentieth
    // is deliberately less than a fifth of the depth of the ground's own
    // thermal texture. The trace can therefore never be the strongest thing
    // happening on the ground it lies on — it reads as that ground running
    // slightly warm, and it is swallowed by the terrain's own grain rather
    // than sitting on top of it as a shape.
    // The pool is rigidly attached to the body and is recomputed every frame
    // from where the animals are now. Nothing is deposited and nothing decays:
    // when an animal moves on, its warmth moves with it and the ground behind
    // it is cold again immediately. There is no lingering footprint here to
    // shorten, and no value in this file could make one.
    heatEmission: {
      strength: 0.05,
      reachPerBodyHeight: 1.2,
    },
  },
};
