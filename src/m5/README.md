# M5

M5 owns device communication and supplies the shared `FlightInputSource`
directly. Composition connects it alongside desktop input to the one flight
model. Run owns the HTTP runtime; Flash Entry owns USB setup. Neither UI nor
Station creates another steering runtime.

## Runtime flow

```text
firmware /state -> validated M5State -> M5Runtime.readInput -> FlightControl
```

Firmware owns normalization, mounting-axis mapping and calibration. Browser
input preserves each fresh pitch value as `forwardTilt` and negates device roll
into `rightTilt`, retaining the installation's established turn polarity.
Device roll and semantic right tilt therefore have opposite signs. The source
returns both axes in −1..1 using a borrowed reusable sample.

There is no browser smoothing, rest-pose neutralization, intermediate control
frame or button-edge processing. Small held tilts remain active. Device button
counters remain wire diagnostics; no flight consumer uses them.

The configured host selects the controller. Every valid fresh response supplies
steering; firmware version, device identity, calibration status, quality and
sequence remain diagnostic. Polling allows only one request at a time, with
167 milliseconds between poll opportunities and a one-second request timeout.
A sample expires one second after receipt. Missing, disconnected or stale input
returns zero axes. Host replacement clears the sample and aborts old requests;
late replies cannot reach a replacement host's input. Unload permanently stops
polling and releases its timer.

## Public boundaries

| Entry | Contract and ownership |
| --- | --- |
| `runtime/m5.runtime.ts` | `createM5Runtime()` performs no I/O; `setHost(host)` starts or replaces polling. The host accepts a hostname, host:port or origin; an empty host disconnects. Run calls `unload()`. |
| `m5-contract.ts` | `M5Runtime` implements Control's shared flight source. UI receives only `setHost` and `readObservation`, without input or cleanup ownership. |
| `protocol.ts` | Validates HTTP and serial wire records; shared by device tooling and the browser. No runtime state. |
| `setup/serial-setup.ts` | `openSerialSetup(events)` owns one USB channel. `send(command)` writes one newline-delimited command; callbacks receive validated replies. Flash Entry calls `close()`. |

`readObservation()` returns host, connection status, the fresh sample and the
last received sample for diagnostics. It observes without changing input or
freshness. Samples can share storage and must not be mutated; retaining an
observation does not keep it fresh. Connection status is `off` without a host,
`connecting` without a fresh sample, and `live` with a fresh sample.

Serial send completion is not a device acknowledgement. Response callbacks
must not throw. The adapter redacts echoes of the current transient password
and drops unknown output; the UI must not log outgoing commands or passwords.
Repeated close shares completion, and setup rejects concurrent writes.

## Source boundaries

`src/m5` is the browser module, `firmware/m5` the separately built device and
its tools, `public/firmware` the delivery artifacts, and `src/ui` its consumers.
The runtime and USB setup do not import one another. M5's public contract uses
Control's shared input type; only Composition connects concrete implementations.
Station imports platform-neutral deployment contracts only.

## Firmware and verification

Serial configuration preserves omitted mounting flags and replaces explicit
ones. Persistent calibration and storage belong to firmware, not the browser.

- `bun run m5-sim`: typed HTTP simulator.
- `bun run m5-export`: PlatformIO build, version guard, merged binary and manifest.
- `bun run m5-test-config`: native regression tests for the C++ configuration parser.
- `bun test tests/m5`: browser protocol, direct input, request lifetime and USB tests.

See `firmware/m5/README.md` for firmware prerequisites. Physical calibration,
USB operation and installation flight acceptance require the actual device.
