<!--
Purpose: Define the PICO headset role and the smallest installation-validation path.
Context: Becoming Many renders on a Windows station PC and streams through SteamVR.
Responsibility: Separate verified vendor capability, required station evidence, and optional integration work.
Boundary: This repository does not contain a standalone PICO runtime or Android headset agent.
-->

# PICO Headset Integration

## Decided Runtime Topology

The PICO headset is the wired display and tracking endpoint for the Windows
PCVR installation. The application does not run on the headset.

```text
Windows browser / WebXR → SteamVR → PICO Business Streaming → USB → PICO
```

PICO Business Streaming owns the PC-to-headset transport. Its current product
documentation confirms a VR-ready Windows PC, SteamVR, and wired streaming for
enterprise 6DoF headsets. This repository therefore does not need an Android
headset agent, an on-headset web runtime, or a second application protocol. A
later standalone PICO edition belongs in a separate reduced fork.

Vendor capability is not installation evidence. Every result must record the
exact Windows, browser, GPU driver, SteamVR, PICO Business Streaming, headset,
PICO OS, USB cable, and host-port matrix used for the run.

## Integration Boundary

The Conductor hosts the show and WebXR session in one browser window. There is
no show-to-Conductor transport and no headset-control channel in the browser.

Use PICO Business Streaming's built-in controls and diagnostics first. Add a
small Windows-side adapter only when the installation spike identifies one
concrete operator action or status fact that the product cannot provide. Such
an adapter must have a narrow typed contract and must not revive the deleted
station broker or introduce a generic transport layer.

## Smallest Installation Spike

Validate one complete station before adding integration code:

1. Pin the complete hardware and software matrix.
2. Confirm that the selected Windows browser exposes `immersive-vr` through the
   active SteamVR runtime and starts the local production build through PICO
   Business Streaming in wired mode.
3. Verify tracking, audio, forward direction, ICAROS locomotion, session start
   and exit, cable reconnect, application restart, and power-cycle recovery.
4. Evaluate boarding, safety exit, and any available see-through behavior on
   the exact installed product matrix; record what staff can operate reliably.
5. Record application frame timing together with the available streaming and
   presentation diagnostics.

If manual or built-in operation satisfies boarding and recovery, stop there.
If it does not, define the missing operator requirement before evaluating a
Windows-side adapter. An on-device agent remains out of scope.

## Provisioning and Diagnostics

- Use PICO Business Streaming's wired mode and built-in diagnostics first.
- Collect only facts with an active operator or acceptance consumer; do not
  mirror every available metric into the application.
- Keep ADB, screenshots, and any bounded mirror in a technician-only
  maintenance path. They are diagnostics, not runtime control.
- Validate simultaneous charging, extensions, hubs, and diagnostic use with
  the actual cable and station port before relying on them.

## Rejected Alternatives

- Running this repository standalone on the headset. That belongs in the later
  reduced fork.
- Wireless streaming as an installation fallback. It changes the performance
  and recovery path and is outside the selected baseline.
- A custom Android headset agent before a demonstrated gap in the selected
  streaming product.
- A transport abstraction spanning browser messaging, WebSocket, and a
  possible native adapter.

## Primary Source

- [PICO Business Streaming product documentation](https://business.picoxr.com/us/software/streaming-assistant)
  confirms the Windows and SteamVR requirements and wired enterprise-headset
  support.
