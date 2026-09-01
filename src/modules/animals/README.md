# Animals

This module contains animal content, including animal instances, placement,
animation, and bounded behavior updates.

It consumes shared world data and owns its loaded animal resources. It does
not create a separate render loop or import other concrete content modules.

## Current MVP

- `animals-definition.ts` owns the Deer, Stag, Fox, and Rat assets, population,
  habitat, movement, and visibility budget. The level uses `animals: true` to
  enable that complete definition.
- Each species defines a small clone count, target metre height, and allowed
  zones. The current four species produce ten actors.
- Homes are chosen deterministically in separate angular territories around
  the camera and use `surfaceYAt()`. Species are interleaved between territories,
  and each actor chooses the nearest point allowed for its species.
- Actors follow a simple heading, turn before entering a disallowed zone, and
  relocate when they fall outside the bounded active radius.
- Visible actors sample the nearby surface height in four directions. Their
  body stays tangent to that slope while their forward axis keeps the current
  movement heading.
- Visible actors are selected from separate directions before vacant slots are
  filled by distance. Only those actors advance animation mixers; the current
  Test Level limit is four.
- Visible actors are reported once per frame as reused `AnimalBody` records —
  position, heading, height, and species — to every sense that asked for
  them. The heat view warms the ground around them from it; the scent sense
  prints their trail from it. Neither module is known here.
- Unload stops mixers, releases cloned skeletons, removes actors, and disposes
  the shared source assets.

Spatial audio, complex behavior, collision, flocking, and LOD are not part of
this MVP. Animals do not query concrete sibling modules.
