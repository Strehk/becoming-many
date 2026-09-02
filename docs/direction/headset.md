# PICO Headset Integration

## Decided Runtime Topology

The PICO headset is the wired display and tracking endpoint for the Windows PC
VR installation. The application does not run on the headset:

```text
Windows browser / WebXR → SteamVR → PICO Business Streaming → USB → PICO
```

PICO Business Streaming owns both ends of the streaming transport. This
repository therefore does not need an Android headset agent, an on-headset web
runtime, or a second application protocol. A later standalone PICO edition is
implemented in a separate reduced fork.

## Product Capabilities and Boundaries

PICO's Business Streaming 2.1/2.2 documentation confirms:

- SteamVR streaming on a VR-ready Windows PC;
- wired USB streaming, with USB 3.0 or faster as the documented baseline;
- PICO Business Streaming 2.2 see-through during streaming for its supported
  device and software matrix;
- a native Windows SDK that can query connection state, headset and controller
  battery, proximity state, and streaming performance data.

These are vendor capabilities, not evidence that this installation has passed.
The exact model, PICO OS, Business Streaming, SteamVR, browser, cable, host
port, and driver versions must be recorded for every acceptance result.

The browser's same-origin control channel connects only the VR and Conductor
pages on the station PC. It does not control PICO Business Streaming. The
native streaming SDK is also not directly callable from browser TypeScript.
Only add a small Windows adapter if a concrete operator requirement cannot be
met by Business Streaming's built-in UI and configuration. Do not preserve the
old station broker or add a generic transport layer for this possible adapter.

## Smallest Installation Spike

Validate the selected path on one complete station before adding integration:

1. Pin the full hardware and software matrix.
2. Make SteamVR the active XR runtime, confirm that the selected Windows
   browser exposes `immersive-vr`, and start the local experience through PICO
   Business Streaming in wired SteamVR mode.
3. Verify tracking, controllers, audio, forward direction, session start and
   exit, cable reconnect, application restart, and power-cycle recovery.
4. Verify Business Streaming 2.2 see-through during streaming on the exact
   headset matrix and document whether staff can operate it reliably.
5. Record application frame timing together with Business Streaming render,
   encode, transmit, decode, latency, and interpolation data.

If manual or built-in operation satisfies boarding and recovery, stop there.
If not, define the missing operator action first and then evaluate the smallest
Windows-side SDK adapter. An on-device agent remains out of scope.

## Provisioning and Diagnostics

- Use PICO Business Streaming's wired mode and built-in log export as the first
  operational tools.
- Use its PC SDK queries only for operator facts that have an active consumer;
  do not mirror every available metric into the application.
- Keep ADB, screenshots, and a bounded scrcpy mirror in a technician-only
  maintenance path. They are diagnostics, not runtime control.
- Keep the USB data path dedicated and tested. Any simultaneous charging,
  extension, hub, or diagnostic use must be validated with the actual cable and
  station port.

## Rejected Alternatives

- Running this repository standalone on the headset. That belongs in the later
  reduced fork.
- Wireless streaming as an installation fallback. It changes the performance
  and recovery path and is outside the accepted baseline.
- A custom Android headset agent before a demonstrated gap in the selected
  streaming product.
- A transport abstraction spanning BroadcastChannel, WebSocket, and a possible
  native SDK adapter.

## Primary Sources

- [PICO Business Streaming 2.1/2.2 documentation](https://business.picoxr.com/us/doc/43j3qcoq)
  documents Windows, SteamVR and USB streaming, supported matrices, built-in
  diagnostics, and the 2.2 see-through feature.
- [PICO Business Streaming 2.1 SDK guide](https://business.picoxr.com/doc/BusinessStreamingv2SDK)
  documents the native Windows queries for connection, battery, proximity, and
  performance data.
- [PICO Business Streaming product page](https://business.picoxr.com/us/software/streaming-assistant)
  confirms the Windows/SteamVR requirement and wired enterprise-headset
  support.
- [Chromium VR platform documentation](https://chromium.googlesource.com/chromium/src/+/main/device/vr/README.md)
  documents Chrome's Windows WebXR path through OpenXR; browser-to-SteamVR
  compatibility must still be verified on the pinned station matrix.
