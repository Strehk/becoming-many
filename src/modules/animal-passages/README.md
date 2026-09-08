<!--
Purpose: Document what the Animal Passages module owns.
Context: An authored crossing announces a sense across its cue boundary.
Responsibility: Explain the passage contract, the route port, and what is deliberately absent.
Boundary: Placement in the show lives in src/dramaturgy; the population lives in src/modules/animals.
-->

# Animal Passages

A **passage** is one animal crossing the visitor's flight on an authored route.
It is not part of the animal population: the population lives in the world all
the time and is bounded by habitat, while a passage happens once, at a moment
the schedule names, and then leaves.

Each passage announces the sense whose animal names it — `script/en.md` gives
Bat for Echolocation, Insect for Motion Perception, and Migratory Bird for
Magnetic Field Perception. The animal enters six seconds before that cue, while
the previous world still stands, and is gone once the new sense has faded in:
it introduces the sense rather than illustrating it.

Two of those three are authored: the bat and the mosquitoes. Magnetic Field
Perception carries no crossing — what announced it was a single bird leaving
due north, and one animal pointing is a thin way to carry a sense that is about
a bearing, so that cue opens with nothing ahead of it.

Of the two, only the bat crosses as a body flying a route and is staged here.
The mosquitoes have no body — in the project these come from, their particles were
never drawn, and what the visitor saw was only the trail their movement
printed. They are staged as a swarm in `src/modules/motion-sense`, where trail
printing lives, and this module gives it the route and the schedule through one
function: where the centre is now, and how long it has been crossing.

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
seconds of gliding. The bat's route turns to the visitor's heading, once, as
it enters; a route may instead hold fixed world axes, for a crossing that
belongs to the world rather than to the visitor.

## The departure can carry a bearing

An authored route is left exactly as it was tuned: how close the animal passes
and how wide it sweeps *is* that route data, and it is what makes a crossing
land whichever way the visitor happens to be flying.

The *exit* is different — it was always procedural, never authored in Blender —
so a passage may give it a compass bearing, and the exit banks from the heading
its route ends on onto that bearing across its first stretch. The first leg
holds the arriving heading exactly, so the hand-off has no kink; taking most of
a half turn inside four metres would read as a hinge rather than as flight.

No authored passage carries a bearing at present. The one that did was the
bird, whose departure meant something because the sense it announced is the one
migratory birds navigate by; with it out, every crossing leaves straight on the
heading its route ends with. The bearing stays in the contract because it is a
property a definition may claim, not a property of that one animal — but
nothing exercises it, so a passage that claims one again should be flown before
it is trusted.

## Not decorated by the senses

Passage animals wear plain unlit materials and are not touched by the sense
effects or the world fades that decorate the population. This is authored: a
passage has to land in the white world before any sense exists, and a body only
the heat view could see would simply be missing there.

## The swarm carries its own trails

The mosquitoes keep the same six-second lead as the bat, and that has one
consequence worth stating: they cannot print through the Motion Sense module,
because that module is gated on the very sense they are announcing and stands
at zero strength while they cross. The swarm therefore owns its own trail ring
at full strength, composed beside Motion Sense rather than inside it. It is the
same rule as the flown animals wearing plain unlit materials — a passage must
land in the world that is still standing, not in the one it is announcing.

The two modules meet at `src/modules/passage-crossing.ts` and nowhere else.
This module's handle offers a `PassageSwarmCrossing` — where the cloud stands
this instant, and the shape that prints it — only when the schedule actually
places the swarm. The cloud shape travels with the reader because both are
authored against the same crossing, so nothing outside this folder reaches into
`passage-definitions.ts` to size a ring.

## Not here yet

- **Passages for Scent, Thermal, and Connections.** Those three senses have no
  animal in the authored set. Their absence is a choice, not a gap.
- **A passage for Magnetic Field Perception.** This one is an opening rather
  than a choice: the cue lost the bird that announced it and is waiting for a
  crossing that carries a direction rather than points in one.
- **Ground clearance under a moving frame.** The bat's route is lifted against
  the live ground each frame, which is correct, but the exit curve is built
  once from the route's end pose. Over strongly sloping ground the departure
  therefore reads the terrain of the moment it began.
