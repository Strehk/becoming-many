# Platforms

## Current Browser Runtime

The same Vite/Three.js/WebGL2 application runs on desktop and through WebXR.
Desktop uses pointer-lock and keyboard controls; immersive sessions use one
user-triggered VR entry and the existing render loop. The WebGL context is
created XR-compatible.

The implementation contains no current passthrough or `immersive-ar` flow.

## Current Station Runtime

The station package consists of one browser window and one small Bun server:

- `/conductor.html` hosts the show and operator controls in-process;
- the server serves the built files plus `/config` and `/health`;
- Docker packaging, an explicit release-image update path, and a Windows kiosk
  launcher are present;
- an optional M5 simulator supports development without hardware.

This is implemented deployment infrastructure, not proof of venue reliability.
Recovery, session-state, telemetry, and security work remains issue-backed.

## Standalone PICO

PICO 4 remains the primary performance target. WebXR entry and rig locomotion
are implemented and covered by automated contract tests, but the complete
current show has no recorded physical PICO 4 performance acceptance. XR flight
also requires final device validation.

Target-device evidence must record headset model, browser/runtime version,
refresh rate, level or route, frame timing, and observed recovery behavior.

## Windows PCVR

Wired Windows/SteamVR/PICO delivery remains an open validation path. Current
code does not establish that the station can start and present reliably through
PICO Business Streaming. Issue #42 owns physical reproduction and diagnosis;
the result must distinguish application, WebXR host, SteamVR, streaming, cable,
and headset failures before choosing a fix.

## Open Delivery Decision

The installation still needs measured evidence before choosing standalone PICO
or Windows PCVR as its final delivery baseline. That decision and the associated
passthrough question are tracked in
[direction/open-decisions.md](direction/open-decisions.md).
