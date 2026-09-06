# Platforms

## Confirmed Installation Target

Windows-PCVR over USB-C is the delivery platform. Target stable 90 Hz on the
actual Windows PC, XR runtime, streaming/USB transport and headset together.
Standalone PICO belongs to a separate project after the PC version is complete;
do not add a second deployment or rendering path in anticipation.

Mac browser testing remains the local development and regression path. Neither
its refresh rate nor deterministic counters prove Windows-PCVR acceptance.

## Current Runtime

The Vite/Three.js/WebGL2 application uses one renderer and render loop for desktop
and user-triggered WebXR. Desktop uses pointer-lock and keyboard flight; the
viewer rig preserves local headset pose. The context is created XR-compatible.
There is no implemented passthrough or `immersive-ar` flow.

The station has one browser window and a Bun server: Conductor hosts the show;
the server serves files, `/config` and `/health`. Docker packaging, a release-image
update path, a Windows kiosk launcher and an optional M5 simulator exist. Their
presence does not establish reliable installation operation.

## Early Physical Validation

[#42](https://github.com/Strehk/becoming-many/issues/42) owns basic Windows-PCVR
startup and diagnosis. Begin with existing tooling; do not wait for a diagnostic
refactor to collect the exact hardware/software/cable matrix. Distinguish app,
WebXR host, XR runtime, streaming, cable and headset failures before fixing code.

Evaluate full-page reload as a simple visitor restart candidate: XR exit,
re-entry, audio permission and operator actions must work on the actual setup.
Present the concrete sequence and implications before selecting it. A reload is
not assumed to resume VR automatically. Full teardown, failed/cancelled startup
cleanup and fresh visitors remain required whichever mechanism is selected.

Record complete-show frame and transport evidence, repeated-visitor recovery,
and meaningful visible failures. Exact passthrough, safety-exit and venue choices
remain in [open decisions](direction/open-decisions.md); platform selection does not.
