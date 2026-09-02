# Platforms

## Delivery Target

This repository targets one delivery topology: **Windows PC VR streamed to a
PICO headset over USB**. The target delivery chain is:

```text
Three.js/WebXR in a Windows browser
    → SteamVR
    → PICO Business Streaming
    → wired USB data connection
    → PICO headset display and tracking
```

- The station PC runs the browser application and performs rendering.
- SteamVR is the selected PC VR runtime.
- PICO Business Streaming runs on the station PC and headset in SteamVR
  streaming mode.
- USB is the installation transport. Wireless streaming is outside the
  baseline and is not a fallback to implement in this repository.
- The headset is a streamed display and tracking endpoint, not the host for
  this application's TypeScript runtime.

PICO's current Business Streaming documentation supports this topology: its PC
application requires a VR-ready Windows system, supports SteamVR streaming, and
supports wired USB streaming. The documented cable baseline is USB 3.0 or
faster, with USB-C at the headset. The exact station cable and PC port must be
validated with the installed hardware.

## Current Application Support

The application currently runs as a Vite/Three.js browser application.

- Desktop development uses pointer-lock mouse look and WASD or arrow keys.
- Three.js `VRButton` starts a user-triggered `immersive-vr` WebXR session.
- Desktop and WebXR rendering share one `renderer.setAnimationLoop()` path.

The codebase does not yet contain a verified Windows station launcher,
Business Streaming integration, automated headset-state control, or a recorded
end-to-end wired PC VR acceptance run. Those are installation tasks, not an
open platform choice. In particular, the selected browser must expose its
WebXR session through the active SteamVR/OpenXR runtime on the final station;
that compatibility remains a hardware-spike result, not an assumption.

## Standalone Fork Boundary

Standalone PICO execution is not a target of this repository. A later,
deliberately reduced PICO edition will live in its own fork. This repository
must therefore keep the shared Experience independent from PC-only operator,
diagnostic, and station composition, but it must not carry parallel platform
profiles, native Android code, or compatibility switches for that future fork.

## Acceptance Boundary

Desktop and headless measurements remain useful regression evidence. Delivery
acceptance requires the real wired chain on the selected station matrix:

- Windows and browser version;
- SteamVR version and active runtime configuration;
- PICO Business Streaming version and SteamVR streaming mode;
- headset model and PICO OS version;
- USB cable, host port, negotiated connection, and reconnect behavior;
- application frame timing plus encode, transport, decode, and displayed frame
  behavior.

Do not describe a desktop browser result as PC VR acceptance, and do not
describe a PICO result from a standalone browser as evidence for this delivery
path.

## Primary Sources

- [PICO Business Streaming 2.1/2.2 documentation](https://business.picoxr.com/us/doc/43j3qcoq)
  documents Windows, SteamVR streaming, wired USB streaming, supported device
  and OS matrices, and streaming setup.
- [PICO Business Streaming product page](https://business.picoxr.com/us/software/streaming-assistant)
  confirms that the PC application runs on Windows, requires SteamVR, and
  supports wired streaming on PICO enterprise 6DoF headsets.
- [Chromium VR platform documentation](https://chromium.googlesource.com/chromium/src/+/main/device/vr/README.md)
  documents the browser's Windows WebXR path through OpenXR. The final station
  must prove that the selected SteamVR runtime is visible to the selected
  browser.
