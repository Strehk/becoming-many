# Deployment: Two Stations at the Futurium

Decided in the design session of 2026-08-21. Hardware items still carry spikes —
see [Quality and Operations](quality-operations.md).

**Two identical, fully independent stations.** Each station:

- **ICAROS flight rig** with the **M5StickS3** mounted on it (built-in front
  buttons only; no external wiring).
- **Station PC** (Windows, VR-ready) with the **operator page on its second
  monitor**. Staff operate locally; no staff tablets, no remote operation.
- **PICO 4 Enterprise** headset connected to the station PC through a wired USB
  data link. PICO Business Streaming carries the SteamVR session to it.
- The two stations **share only the network**. There is no central server;
  station identity (which M5, which rig profile, which room) is local config.

The application runs and renders only on the Windows station PC. A later
standalone PICO edition is a separate reduced fork, not a second target carried
by this repository.

One property of the selected path simplifies browser integration: the page is
served from **`http://localhost`** on the station PC — a secure context (WebXR
works) with no mixed-content blocking, so plain `http://` polling of LAN
devices is allowed. TLS on embedded devices, relay processes, and BLE all lose
their reason to exist.

## Open venue items

1. **Network control.** Assumed: a network we control (own router, DHCP
   reservations for the M5s). House-IT client isolation would break M5→PC
   traffic — rule this out with the venue early.
2. **Station PC spec** — needed to set the station performance budget.
3. **Exact streaming matrix.** Confirm the headset edition, PICO OS, PICO
   Business Streaming, SteamVR, browser, GPU driver, USB cable, and station PC
   port before the headset spike. Streaming and see-through behavior bind to
   that complete tested matrix.
