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

Windows-PCVR over USB-C is selected; standalone PICO is outside this project.
Prioritize #42 before committing to a visitor restart mechanism. On the actual
Windows/browser/XR/streaming/cable/headset matrix, establish:

1. Reliable initial XR entry and full-show 90-Hz delivery.
2. XR termination, re-entry and audio permission after a candidate page reload,
   with a concrete operator sequence; automatic VR restart is not assumed.
3. Available see-through and safety-exit procedures. Additional device-side code
   remains a separate decision only if normal tooling cannot meet a proven need.

Do not assume vendor capability from a different PICO model or software
version. Record the complete tested matrix. A native host or agent is justified
only by a failed concrete requirement, not by anticipated flexibility.
