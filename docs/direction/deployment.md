# Deployment Direction

## Current

The repository builds one station container containing the static browser
pages and a Bun server. The server exposes `/health` and `/config`; the
Conductor page hosts and controls the show in-process. Per-station values are
provided through environment variables for M5 host, expected device id, station
name, and port. A Windows kiosk launcher is present.

The current package can run as one independent station. It has not completed a
Futurium venue acceptance test.

## Planned

The intended installation consists of two identical independent stations. Each
has an ICAROS rig, its own M5StickS3, a station PC, a local operator display,
and a PICO 4 Enterprise headset. Stations share network infrastructure but no
show state or central runtime service.

Local station identity and hardware binding remain local deployment facts. A
failure at one station must not stop the other.

## Open

- Final delivery path: standalone PICO or wired Windows PCVR.
- Exact station PC, headset edition, OS, browser/runtime, streaming-client, and
  driver versions.
- Venue network behavior, including client isolation and stable addressing.
- Recovery procedure and acceptance results for repeated sessions.

These are evidence tasks, not reasons to add a generic coordination service.
