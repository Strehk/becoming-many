<!--
Purpose: Document what the Snakes module owns.
Context: The authored model was a rigid tube; what crawls is its girth and a wave.
Responsibility: Explain the rebuilt body, the placement rule, and what is absent.
Boundary: Level density lives in the authored preset; the ground facts in World Surface.
-->

# Snakes

Snakes crossing the open ground, each one a body lying on the surface with a
wave running down it.

## Size

A large snake, and no larger: one and a half to two and a half metres. What
makes one findable from the air is the heat it carries, not the size it is
blown up to — an earlier pass grew them to five metres and they were still
missed, because the problem was never the size.

## The body is rebuilt, not loaded

The authored model was one rigid tube of **57,600 triangles**, fifty-seven
metres long, carrying no skinning and no shape keys: its animation moved the
whole tube as one piece, so it could only slide. What ships instead is that
tube's **girth**, read off it in forty slices and kept as the eleven stops the
definition names, rebuilt at load as eleven rings of six sides — **120
triangles**. Nothing is loaded at runtime; there is no snake asset.

Every vertex carries how far along the body it sits, and
`snake-slither.vert.glsl` runs one travelling wave down that axis. The wave
grows out of the head rather than starting at it, so a snake pushes forward
instead of wagging. A whole pool of snakes is one draw call and one uniform.

## Where a snake crawls

- Each 64-metre cell offers candidate places drawn from its own coordinates,
  so the same landscape carries the same snakes in every run. How many places
  a cell offers is a level value, because how much snake a world holds is a
  question for the piece rather than for the module.
- The places are a lattice, not a scatter: each candidate keeps its own square
  of the cell and is jittered inside it, with a margin at the edges. Drawn
  freely across the whole cell, a dozen snakes landed on top of each other
  while the rest of the cell stayed empty. A snake also crawls a short way
  now — thirteen metres rather than thirty — because a long one let two of
  them crawl into each other from opposite squares.
- A candidate is refused unless the **whole way** it would crawl stays out of
  water and the ground along it never falls further than a body can follow.
- Ground carries a weight rather than a yes or no, because where a snake
  *belongs* and where a crossing can be *seen* are not the same place. The
  meadow keeps a snake without ever showing one: its grass covers it fully
  and stands three metres tall. The wood carries no grass but a canopy above
  it, so a body there reads from below and at the treeline. The open slope
  carries half the grass and no canopy, and is the one ground a snake is met
  on from the air — so it carries the most.
- Left unweighted, the population followed the landscape: three in five
  snakes lay in meadow, where nobody would ever find one. Weighted, and at
  the density the piece currently carries, about eight snakes are within
  seventy metres of a flight at a time and five of them on ground the grass
  does not close over, with twenty metres between a snake and its nearest
  neighbour.
- A snake walks its way and starts it again, so it never crawls out of the
  country its place was accepted in.

## Which sense reveals them, and why they are warm

Snakes join the world at the **Thermal** cue, beside the walking population,
and they are the one surface here that deliberately skips the ground's heat
ramp.

Read as ground, a snake took the palette's cold stops and lay invisibly blue
on blue ground — cold-blooded, correct, and impossible to find. But a snake
does not stay at the ground's temperature: it takes its warmth from the sun,
which is the whole reason it lies out in the open at all. A basking body is
among the warmest things on a meadow and the one thermography finds first.
So a snake is authored at the palette's hot stop and left there, while the
echo ramp still carries it into the haze with distance.

## Deliberately absent

No head turn, no prey, no coiling, no track left in the grass, and no second
species. The crawl is a straight way walked over and over; a snake that
followed the terrain's contours would be the next honest step, and needs its
own issue.
