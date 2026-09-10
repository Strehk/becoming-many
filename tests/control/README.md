<!--
Purpose: Explain the flight-control test scope.
Context: Navigation constraints must remain independent from browser event handling.
Responsibility: Route tests for deterministic movement rules under src/control.
Boundary: World rendering, surface formulas, and physical PICO acceptance live elsewhere.
-->

# Control Tests

This folder verifies input mapping, deterministic source combination and shared
navigation behavior. Desktop tests protect the held-key semantics and prove
mouse look cannot steer the rig. Source tests require exactly two normalized
axes even for inactive or stale input. They also cover immediate key response,
frame-driven return to exact center, invalid deltas, and immediate neutralization
on blur, pointer-lock loss, or unload. Flight tests cover neutral continuous
thrust, world-up yaw, climb, fixed-order summed/clamped inputs, simultaneous M5
and desktop input, unchanged M5 adaptation, and a third fake source. Ground
clearance remains independent from browser input, while
`vr-flight.test.ts` proves locomotion remains on the rig when WebXR replaces the
child camera pose.
