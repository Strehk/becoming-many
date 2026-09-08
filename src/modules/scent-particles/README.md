# Scent Particles

This module contains visible scent signatures as colored drifting particles.
Scent has no positions of its own: it radiates from the plants and animals of
the world, and every family carries one signature color.

## Plant layer

The plant layer streams with the traveler. Every resident 64-metre chunk
replays the deterministic Vegetation placement for its area through the
`PlantScentSource` contract, so each particle belongs to a plant that really
stands there — the same plant the Connections web links. A plant's particles
scatter through an emission volume authored in fractions of its own height,
so one signature fits a knee-high bush and a ten-metre pine, and its scent
lifts by its own authored rise rather than by one height for the whole layer.

Inside that volume the particles sit on a ring around the plant rather than on
its axis: evenly by area, with the innermost core left clear. Emission from a
single centre put the whole signature downwind of the plant as soon as the wind
picked it up, so the upwind side of a tree smelled of nothing. Starting the
scent off the axis is what makes a plant smell on every side of itself.

Every particle drifts on its own phase, its own amplitude, and a second
faster turn, so a plant's scent churns instead of sliding about as one rigid
block. On top of that drift the shared wind carries the scent downwind in
proportion to particle age, so a stand reads as plants with plumes rather
than as fog.

All resident chunks share one fixed pool drawn as a single opaque
vertex-colored Points object in one draw call. Each slot is sized for the
densest chunk the source can produce and packs the plants it actually holds
into the front of that range; the unused tail stays hidden. Recycled chunk
slots rewrite only their buffer range through the shared frame-budgeted
stream queue. Particles rise, sway, and fade GPU-side from one looping time
uniform.

The plant layer needs a plant population, not a rendered one: levels that
keep their sources invisible author `invisibleVegetation` instead of
`vegetation`, and the scent then maps a wood nothing draws.

## Trail layer

Live animals print their scent where they walk, at an authored rate per
second, into one fixed ring drawn in a second opaque call. A print stays
where it was left and ages against the same looping clock. Each print walks
away along its own bearing, and it walks faster than it ages, so the fresh
end of a route stays a readable line while the old end opens out into a fan.
The wind carries the whole route downwind and carries its old end furthest.
What the traveler sees is the route the animal took, fraying behind it,
rather than a cloud that travels with it. Colors come from one signature per
species. The ring is only allocated where the Animals module actually runs.

Both layers sample one shared wind, each scaled by its own authored reach, so
plant scent and animal trails always lean the same way. The wind clock runs
separately from the 60-second animation clock: a wind read from the animation
clock would turn back onto the same bearing every minute.

## Deliberately Absent

Scent fields and distance fading into the echo haze are absent. The show drives
the implemented particle intensity through `setIntensity()`. That strength
scales the point size, and an opaque speck either clears the pixel it needs to
rasterize or is not there at all — so one shared strength put the whole field
on screen in a single frame. Each particle therefore takes its own share of
the fade window from the phase it already carries, and the field condenses
speck by speck instead. Both layers spread it the same way. The module owns
neither the show clock nor a separate render loop.

`scent-emitter-anchors.ts` no longer emits anything: it keeps the forest
clearing positions the Connections web links, frozen at the values level 07
was built on.
