<!--
Purpose: Document what the Raptor module owns.
Context: One bird soaring far above, and the only body here with a skeleton.
Responsibility: Explain the ring, the beat, and what is deliberately absent.
Boundary: Which sense reveals it is the show's; the palette is the level's.
-->

# Raptor

One bird, holding a wide ring seventy metres over the landscape.

## Why this one has a skeleton

The flocks are sixty birds in one instanced draw, with their wings beaten by
a vertex shader, because sixty skeletons is not a cost a frame can carry. A
single raptor is: it keeps its armature and its authored beat, played back at
a fifth of its speed, because a soaring bird barely beats at all — it holds
the wing and lets the air work, and that held wing is what reads from ninety
metres away.

## The ring

- The ring's centre drifts after the traveller rather than following rigidly,
  so it stays a place in the world instead of a hat.
- The bird rises and falls over each turn, gaining height on one side of the
  circle and giving it back on the other.
- It banks into the turn by a fixed angle. The tilt is what reads as a circle
  held rather than a straight line crossed.

## Which sense reveals it

The Thermal cue, beside the walking population and the bodies on the flocks —
a bird is a warm body, and the heat view is the sense that shows one. It
holds its ring far outside that view's thirty-five metre reach, so it carries
the echo palette like an unwarmed animal rather than a false colour.

## Deliberately absent

No hunting, no stoop, no second raptor, no reaction to anything below it. It
circles, and that is the whole behaviour. A bird that dropped on something
would be a product feature and needs its own issue.
