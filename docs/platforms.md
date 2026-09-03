<!--
Purpose: Define the supported delivery platform and its acceptance boundary.
Context: The installation uses a Windows station PC and a streamed PICO headset.
Responsibility: Prevent standalone and PCVR requirements from being mixed in one codebase.
Boundary: Detailed hardware procedures and measured evidence live in docs/direction and docs/performance.md.
-->

# Platforms

## Delivery Target

This repository targets one delivery topology: **Windows PC VR streamed to a
PICO headset over wired USB**.

```text
Three.js/WebXR in a Windows browser
    → SteamVR
    → PICO Business Streaming
    → wired USB connection
    → PICO headset display and tracking
```

- The station PC runs the browser application and performs rendering.
- SteamVR is the selected PC VR runtime.
- PICO Business Streaming carries the session between the station PC and the
  headset.
- Wired USB is the installation transport. Wireless streaming is outside the
  baseline and is not a fallback to implement here.
- The headset is a display and tracking endpoint, not the host for this
  repository's TypeScript runtime.

PICO's Business Streaming product documentation confirms that its PC software
runs on a VR-ready Windows PC with SteamVR installed and supports wired
streaming to enterprise 6DoF headsets. The exact browser, runtime, headset,
cable, port, and software-version matrix still requires installation evidence.

## Current Application Support

The application currently runs as a Vite/Three.js browser application.

- Desktop development uses pointer-lock mouse look and keyboard controls.
- The World Runtime owns one WebXR-compatible WebGL2 context and one
  `renderer.setAnimationLoop()` path.
- The Conductor page hosts the show and WebXR session in one station window.
- The bare default page remains available for rehearsal and development.

The codebase does not yet contain a recorded end-to-end wired PCVR acceptance
run. That is an installation and evidence gap, not an open platform choice.

## Standalone Fork Boundary

Standalone PICO execution is not a target of this repository. A later,
deliberately reduced PICO edition belongs in its own fork. Keep shared
Experience code independent from PC-only operator and diagnostic composition,
but do not add parallel platform profiles, native Android code, or compatibility
switches for that possible fork.

## Acceptance Boundary

Desktop and headless measurements are useful regression evidence. Delivery
acceptance requires the real wired chain on a pinned station matrix:

- Windows, browser, GPU, and driver versions;
- SteamVR version and active runtime configuration;
- PICO Business Streaming version and mode;
- headset model and PICO OS version;
- USB cable, host port, connection, and reconnect behavior;
- application rendering plus encode, transport, decode, and presentation.

Do not describe a desktop-browser result as PCVR acceptance, and do not use a
standalone-headset result as evidence for this delivery path.

## Primary Source

- [PICO Business Streaming product documentation](https://business.picoxr.com/us/software/streaming-assistant)
  confirms the Windows and SteamVR requirements and wired enterprise-headset
  support.
