<!--
Purpose: Explain the flight-control test scope.
Context: Navigation constraints must remain independent from browser event handling.
Responsibility: Route tests for deterministic movement rules under src/control.
Boundary: World rendering, surface formulas, and physical PICO acceptance live elsewhere.
-->

# Control Tests

This folder verifies input-independent navigation behavior. Ground-clearance
tests protect the minimum flight height without requiring a browser or terrain
mesh, and the M5 flight tests pin the glider mapping — yaw about world-up with
a level horizon, climb without pitching the view — against a flight rig.
`vr-flight.test.ts` proves that M5 locomotion remains on that rig when WebXR
replaces the child camera's local transform with the headset pose.
