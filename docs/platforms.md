# Platforms

## Current Support

The application currently runs as a Vite/Three.js browser application.

- Desktop development uses pointer-lock mouse look and WASD or arrow keys.
- Three.js `VRButton` starts a user-triggered `immersive-vr` WebXR session.
- Desktop and WebXR rendering share one `renderer.setAnimationLoop()` path.

There is currently no passthrough, `immersive-ar`, operator control, platform
profile, restart flow, or PICO-specific deployment integration. No physical
PICO acceptance is recorded.

## Standalone PICO Target

- Target PICO 4 and PICO 4 Enterprise.
- Run the shared TypeScript and Three.js runtime directly on the headset.
- Support passthrough onboarding, opaque VR, and passthrough offboarding.
- Prefer a verified 90 Hz profile and retain 72 Hz only as a measured fallback.

The next platform milestone is not a second renderer. It is a minimal
presentation boundary around the existing world runtime.

## Windows PCVR Target

- Render on a VR-ready Windows computer.
- Stream to PICO 4 Enterprise through USB.
- Evaluate PICO Business Streaming with OpenXR or SteamVR.
- Reuse the same runtime, world logic, shaders, presets, and content modules
  when the Windows XR host supports them reliably.
- Keep wireless streaming outside the installation baseline.

PCVR requires its own measured profile for rendering, encoding, USB transport,
headset decoding, and end-to-end latency.

## Operator Control Target

The operator will control onboarding, VR entry, offboarding, restart, and
recovery. The headset remains authoritative and confirms applied state.

The intended presentation states are:

```text
passthrough → transitioning-to-vr → vr → transitioning-to-passthrough
```

## Open Research Question

Can the shared web runtime run reliably on Windows through PICO Business
Streaming, including operator-controlled passthrough transitions, or is a
minimal native OpenXR host required?

Research must verify runtime host behavior, passthrough control, supported
refresh rates, tracking, packaging, startup, reconnect, and recovery. A native
host is justified only if the shared web runtime cannot meet those requirements.
