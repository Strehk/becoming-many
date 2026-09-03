<!--
Purpose: Reserve a module boundary for a rendered river or water surface.
Context: World Surface currently supplies river-related ground conditions to Terrain.
Responsibility: State the present boundary and the smallest future extension point.
Boundary: This folder currently contains documentation only and claims no runtime behavior.
-->

# Rivers

This is a README-only reserved extension boundary. There is no Rivers runtime
module, water geometry, transparency, reflection, or animated surface.

The current World Surface owns deterministic river/ground conditions and
Terrain owns their visible ground presentation. A Rivers module is justified
only by a concrete product issue requiring a separate water surface and a
measured PICO-compatible budget. It should consume existing world facts and own
all water-specific resources and disposal.
