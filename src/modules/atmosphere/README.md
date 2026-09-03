<!--
Purpose: Reserve a module boundary for atmospheric content.
Context: The current runtime handles background and fog without an Atmosphere module.
Responsibility: State what a future concrete module would own.
Boundary: This folder currently contains documentation only and claims no runtime behavior.
-->

# Atmosphere

This is a README-only reserved extension boundary. There is no Atmosphere
module in the current runtime.

If a concrete issue requires unloadable atmospheric content beyond the current
scene background, fog, Air Particles, or Magnetic sky, this module may own its
resources and lifecycle. It must not own the render loop, WebXR, global frame
scheduling, or resources already owned by another module.
