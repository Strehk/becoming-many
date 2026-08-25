# Scent Particles

This module contains visible scent signatures as colored drifting particles.

The current version streams deterministic scent sources with the traveler:
every resident 64-metre chunk tries a bounded candidate search for its
authored number of emitters and keeps only candidates inside the module-owned
source zones (conifer and deciduous forest). Kept emitters anchor low above
the sampled world ground as flat clouds, each with one signature color from
the level palette; misses stay hidden in their fixed particle range. All resident chunks share one
fixed pool drawn as a single opaque vertex-colored Points object in one draw
call. Recycled chunk slots rewrite only their buffer range through the shared
frame-budgeted stream queue. Particles rise, sway, and fade GPU-side from one
looping time uniform; a sense-intensity uniform (0..1) is authored through the
level preset. The module owns its particle lifecycle and disposes every
resource on unload.

Not part of this version: wind-field coupling, scent fields, emitters that
move while placed, and a runtime intensity driver (blocked on the open
runtime-coordination decision). It does not own the master audio clock or a
separate render loop.
