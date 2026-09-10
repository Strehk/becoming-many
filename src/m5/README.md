# M5

M5 owns device communication and normalized input. Run owns its HTTP runtime;
Flash Entry owns its USB setup session. UI consumes public capabilities; flight
in `src/control/m5-controller.ts` consumes normalized input without device
connection details. This document is the entry point across these environments.

## Public module boundary

The public entry points are the existing files below, not every export under
`src/m5`. Consumers import these directly; there is no forwarding barrel or
second controller facade. `runtime/control-source.ts` and the filter/settings
files are private implementation. Their exports serve the runtime and focused
tests, not application consumers.

| Public entry | Inputs and output | Ownership and failure contract |
| --- | --- | --- |
| `runtime/m5.runtime.ts` | `setHost(host)` accepts hostname, host:port or origin. `consumeFrame()` produces normalized input; `readObservation()` produces device status/sample/effective input. | Run constructs it without I/O, starts polling by setting the host and calls `unload`. Poll/parse failures become neutral input after expiry. Host replacement clears history; unload permanently stops new work. |
| `control-frame.ts` | Pitch/roll in −1..1, quality in 0..1, button state and one-consumer edges. | Pure read-only device contract with no host, firmware or transport facts. `m5-controller.ts` maps pitch/roll onto Control's `forwardTilt`/`rightTilt` sample. Neutral axes preserve thrust/descent, not stop. |
| `setup/serial-setup.ts` | `openSerialSetup(events)` returns an open USB channel. `send(command)` writes one newline-delimited command; events report validated responses. | Flash Entry creates/closes the channel. Picker/open/write/close failures reject; read errors use `onError` and end the channel. No concurrent writes or command queue. Closing awaits reader/writer release; repeat close shares completion. |
| `protocol.ts` | Untrusted HTTP/serial text → validated wire values or null; serial commands and result discriminants. | Pure device contract shared by firmware tooling, simulator and adapters. Firmware implements the C++ side; export verifies the compatible version. It owns neither runtime state nor resources. |

Observations never consume button edges. `consumeFrame` has one application
reader in Control; first/reconnected samples establish the counter baseline
without replaying earlier presses. Each returned frame is a reused read-only
sample and valid only for that processing step. Retaining an observation does
not keep its freshness current; call `readObservation` again. Accepted sample
storage can be shared and must not be mutated; UI cannot obtain runtime cleanup
or the frame consumer.

Serial response callbacks observe asynchronous device replies. A completed send
is not an acknowledgement, and replies are not returned by `send`. Callbacks
must not throw. The UI must not log the outgoing command/password; the adapter
redacts echoes of the current transient password and omits unknown output.
Firmware owns normalization/calibration. Browser smoothing and rest-pose
neutralization remain at their existing owners; neither metadata nor large
pose changes impose a steering eligibility gate.

## Allowed dependencies

Fallow distinguishes public runtime, private processing, setup, normalized input,
wire protocol and device tools. Run may construct the runtime but cannot import
its private processing. Entry may construct USB setup but cannot construct the
Run-owned HTTP runtime. UI may import public observation/command types and use
provided capabilities, never concrete factories. Flight can import only the
normalized input type. Setup and runtime cannot import one another or UI. Device
tools can import the wire contract, never the browser runtime. Pure contracts
import no implementation. Type-only imports into private processing are also
forbidden across the boundary.

## Physical organization

The current roots remain intentional: `src/m5` is the browser device module,
`firmware/m5` contains the separately built device and executable tools,
`public/firmware` contains delivery artifacts, and `src/ui` contains consumers.
The common README and wire contract tie this feature together without making
its execution environments depend on each other. A single repository-level M5
package would currently move paths without removing state or indirection.
No folder-rule exception, workspace package, additional build tool or mass move
is introduced by this boundary refinement.

## Internal reading order

`runtime/m5.runtime.ts` creates one `control-source.ts` per host. The source
accepts every parsed reply from the configured host, then runs
`auto-neutralize.ts → control-smoothing.ts`. Firmware, identity, calibration and
sequence and device quality are diagnostic fields only. Effective control
quality is one for each fresh parsed reply, and zero after response expiry. A one-second response timeout handles
connection loss; no advancing sequence is required. Settings stay
in `runtime/m5-settings.ts`; flight tuning remains with Control. Private helper
exports exist for this processing chain and its focused tests only.

`readObservation` uses one timestamp: `host` is the configured address, `status`
is connection freshness, `sample` is the accepted raw pose and `control`
is effective pitch/roll/quality. Invalid/stale samples are absent and configured
input is neutral. With no host, the diagnostic control observation is undefined,
while the flight adapter still returns both neutral axes. Desktop input is read
independently and combines with M5 input in either state; there is no source
selection or priority. A live device may still have neutral effective input. The
UI must not infer steering readiness from connection status alone.

## Firmware and executable tools

Firmware owns `normalize → axis-map → calibrate`. Serial configuration preserves
omitted mounting options and replaces explicit ones. The browser does not own
persistent calibration or device storage.

- `bun run m5-sim`: typed HTTP simulator in `firmware/m5/tools`.
- `bun run m5-export`: PlatformIO build, version guard, merged binary and matching
  manifest under `public/firmware/m5-controller`.
- `bun run m5-test-config`: native execution of the actual C++ configuration
  parser after the firmware build has installed ArduinoJson.

See `firmware/m5/README.md` and `tests/m5/README.md` for prerequisites and tests.
The boundary refinement passes type checking, 101 M5/Control tests and 14 isolated
Fallow probes: five public dependencies accepted, nine forbidden dependencies
rejected, including type-only access to internals. The real import graph has no
boundary violations. No runtime behavior or folder ownership changes here;
physical USB, calibration and installation flight acceptance remain separate.
