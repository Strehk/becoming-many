# Headset Direction

## Current

The browser runtime supports user-triggered `immersive-vr`, creates its WebGL2
context XR-compatible, and moves a parent viewer rig while preserving headset
pose. Automated tests cover the contract, but no current physical PICO
acceptance is recorded for the complete show or flight behavior.

The application does not currently control passthrough, read headset telemetry,
or contain an Android headset agent.

## Planned

Installation onboarding and safety exit should let staff place or remove the
headset while the visitor can see the room. If device-side integration is
required, keep it narrow:

- confirm requested headset state before the operator advances;
- report only useful status such as connection, foreground state, battery, and
  worn/proximity state;
- degrade visibly and permit a documented manual procedure;
- keep maintenance tooling separate from show-time control.

## Open

The final path depends on real hardware tests:

1. Does standalone browser/WebXR meet performance and operations needs?
2. Does wired PICO Business Streaming expose a reliable VR and see-through
   workflow on the exact station matrix?
3. If neither path supplies the required control, is a small device-side agent
   justified?

Do not assume vendor capability from a different PICO model or software
version. Record the complete tested matrix. A native host or agent is justified
only by a failed concrete requirement, not by anticipated flexibility.
