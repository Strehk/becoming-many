# Deployment: Two Stations at the Futurium

Decided in the design session of 2026-08-21. Hardware items still carry spikes —
see [Quality and Operations](quality-operations.md).

**Two identical, fully independent stations.** Each station:

- **ICAROS flight rig** with the **M5StickS3** mounted on it (built-in front
  buttons only; no external wiring).
- **Station PC** (Windows, VR-ready) with the **operator page on its second
  monitor**. Staff operate locally; no staff tablets, no remote operation.
- **PICO 4 Enterprise** headset. The enterprise OS matters: it allows the
  on-device APIs in [Headset](headset.md).
- The two stations **share only the network**. There is no central server;
  station identity (which M5, which rig profile, which room) is local config.

How the rendered experience reaches the headset — standalone on the headset vs
PC-VR streaming — is [Open Decision 1](open-decisions.md).

On the PC-VR path, one property simplifies everything: the page is served from
**`http://localhost`** on the station PC — a secure context (WebXR works) with
no mixed-content blocking, so plain `http://` polling of LAN devices is
allowed. TLS on embedded devices, relay processes, and BLE all lose their
reason to exist.

## Open venue items

1. **Network control.** Assumed: a network we control (own router, DHCP
   reservations for the M5s). House-IT client isolation would break M5→PC
   traffic — rule this out with the venue early.
2. **Station PC spec** — needed to set the station performance budget.
3. **Exact headset edition and versions.** Enterprise SDK APIs and streaming
   features bind to the tested matrix (device model, PICO OS, TobService and
   streaming-client versions). Confirm the Futurium units before the headset
   spike.
