<!--
Purpose: Document what the Snakes module owns.
Context: The authored model was a rigid tube; what crawls is its girth and a wave.
Responsibility: Explain the rebuilt body, the placement rule, and what is absent.
Boundary: Level density lives in the authored preset; the ground facts in World Surface.
-->

# Snakes

Snakes crossing the open ground, each one a body lying on the surface with a
wave running down it.

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
- A candidate is refused unless the **whole way** it would crawl stays in
  meadow or shrub slope and the ground along it never falls further than a
  body can follow. A snake laid through a wood would be laid through trunks.
- A snake walks its way and starts it again, so it never crawls out of the
  country its place was accepted in.

## Which sense reveals them

Snakes join the world at the **Thermal** cue, beside the walking population.
A cold body is the one thing a heat view would physically not show, so this
is a dramaturgical placement rather than a physical one: it is where the piece
wants them. The ground they cross still colours them like the rocks around
them, through the same echo ramp and world fade.

## Deliberately absent

No head turn, no prey, no coiling, no track left in the grass, and no second
species. The crawl is a straight way walked over and over; a snake that
followed the terrain's contours would be the next honest step, and needs its
own issue.
