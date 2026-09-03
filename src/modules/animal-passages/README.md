<!--
Purpose: Document what the Animal Passages module owns.
Context: One animal announces each sense that names one, across its cue boundary.
Responsibility: Explain the passage contract, the route port, and what is deliberately absent.
Boundary: Placement in the show lives in src/dramaturgy; the population lives in src/modules/animals.
-->

# Animal Passages

A **passage** is one animal crossing the visitor's flight on an authored route.
It is not part of the animal population: the population lives in the world all
the time and is bounded by habitat, while a passage happens once, at a moment
the schedule names, and then leaves.

Each passage announces the sense whose animal names it —
`docs/experience.md` gives Bat for Echolocation, Frog and insects for Motion
Perception, and Migratory birds for Magnetic Field Perception. The bat and the
bird are staged here. The animal enters while the previous world still stands
and is gone once the new sense has faded in, so it introduces the sense rather
than illustrating it.

## Derived, not triggered

A passage's whole pose comes from `passageProgressAt(schedule, id, showTime)`.
Nothing is accumulated across frames, so scrubbing into a crossing lands the
animal at the point on its route where playing through would have put it, and
scrubbing back out takes it away again — the same rule the sense strengths and
the background follow.

That is the one deliberate departure from the predecessor project, where these
were fire-and-forget events pulsed over a bus: a rising edge cannot be seeked,
and the conductor page and the rehearsal transport both scrub. Two hand-off
values that the old code captured at a phase boundary — the orientation the
approach ends on and the curve the exit grows from — are computed from the
route instead, so they answer the same thing on a seek as on a play-through.

The wingbeat is set from show time too, rather than advanced by frame delta, so
a seek lands mid-flap instead of restarting the wings under a body already in
the air.

## The routes are the tuning

`passage-definitions.ts` carries the route files and every constant that shapes
a crossing — scale, rotation, start offset, approach points, phase durations,
model forward axis and roll — unchanged from the project they were tuned in.
Which direction the animal comes from and how close it passes *is* those
numbers, so they are transcribed, not re-derived. The route files themselves
are the same exports, including the one FBX in the repository: converting it
would resample the track it was tuned against.

`passage-route.ts` reads a route as an animated Empty's position track and
resamples it into route-space metres spaced by distance. The authored track's
own timing is dropped on purpose — the flight re-times the route, easing from
the approach speed into a cruise so it still finishes on its authored length.

## The frame rides the visitor

The route frame follows `viewpoint.worldPosition` every frame. A crossing
authored around where the visitor is would otherwise be left behind within
seconds of gliding. Only the bat's route turns to the visitor's heading, once,
as it enters; the bird's keeps a fixed world rotation, because it is the
world's bird and not the visitor's.

## Not decorated by the senses

Passage animals wear plain unlit materials and are not touched by the sense
effects or the world fades that decorate the population. This is authored: a
passage has to land in the white world before any sense exists, and a body only
the heat view could see would simply be missing there.

## Not here yet

- **The mosquitoes before Motion Perception.** They cross as a swarm printing
  motion trails rather than as a flown body, so they belong to Motion Sense as
  a swarm anchor driven along a route — the path-flyby swarm
  `docs/levels/04-motion-perception/README.md` records as a follow-up. The
  `PassageId` union already names them; scheduling them is one entry in
  `piece-schedule.ts` once that swarm exists.
- **Passages for Scent, Thermal, and Connections.** Those three senses have no
  animal in the authored set. Their absence is a choice, not a gap.
- **Ground clearance under a moving frame.** The bat's route is lifted against
  the live ground each frame, which is correct, but the exit curve is built
  once from the route's end pose. Over strongly sloping ground the departure
  therefore reads the terrain of the moment it began.
