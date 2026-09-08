# M5

M5 owns device communication and the input produced by one M5StickS3. Browser
UI lives in `src/ui`; flight equations remain in `src/control/m5-flight.runtime.ts`.
Start here to follow the controller across its separate execution environments.

## Reading order and contracts

| File | Responsibility |
| --- | --- |
| `protocol.ts` | HTTP `M5State`, serial commands and validated replies. The browser's expected version must match the firmware release. |
| `control-frame.ts` | Normalized steering axes and single-reader button edges. Quality zero means neutral steering. |
| `runtime/m5.runtime.ts` | One host-bound poll lifetime, cancellation, `consumeFrame` and `readObservation`. Run creates and unloads it. |
| `runtime/control-source.ts` | Identity, version, calibration, sequence and freshness gate; compose safety, neutralization, smoothing and button latching. No network or timers. |
| `runtime/m5-settings.ts` | Existing poll, safety and filtering parameters. Flight-model tuning stays outside M5. |
| `setup/serial-setup.ts` | USB port, reader, writer, bounded line framing and awaited cleanup. Flash Entry connects it to the UI independently of Run. |

`runtime/control-safety.ts`, `auto-neutralize.ts` and `control-smoothing.ts`
keep the existing domain algorithms separate. The device itself owns
`normalize → axis-map → calibrate`; browser filtering does not recalibrate it.

## Runtime observations and lifetime

Entry resolves deployment host/device identity and supplies commands to the
operator UI. `setHost` replaces the entire poll and processing lifetime;
late responses cannot publish into a replacement host. An empty host stops.
`unload` aborts polling permanently and is safe to repeat.

Only Run calls `consumeFrame`, once per render frame. No host returns
`undefined` and lets desktop input steer. A configured invalid/stale device
returns a neutral frame; the existing glider continues its forward glide and
descent. This is not a safety hold or automatic keyboard takeover.

`readObservation` samples one time without consuming events or polling again:

- `host`: the runtime's configured address.
- `status`: device eligibility/freshness, including `off` without a host.
- `sample`: latest accepted device pose, absent when rejected or stale.
- `control`: effective filtered pitch/roll/quality, neutral while configured
  input is invalid and absent only without a host. It exposes no button edges.

A live device may have neutral effective input. UI must distinguish these
facts instead of deriving steering readiness from `status === "live"`.
Observations are read-only; consumers must never mutate the accepted sample.

## Setup, firmware and tools

The Flash page is `src/ui/flash/flash.page.ts`, connected by
`src/entry/flash.entry.ts`. Sending a command confirms only a completed write;
the typed device result confirms whether the operation succeeded. Configuration
preserves omitted axis-mount options and replaces explicitly provided options.
Passwords stay transient in the browser and are excluded/redacted from replies
and logs. USB close cancels the owned reader before releasing the port.

`firmware/m5/` contains device source and the independent Bun tools:

- `bun run m5-sim`: typed HTTP simulator; no Station or browser runtime import.
- `bun run m5-export`: build with PlatformIO, enforce compatible versions and
  export the merged binary plus manifest to `public/firmware/m5-controller/`.
- `bun run m5-test-config`: compile and execute the actual firmware configuration
  logic locally after its ArduinoJson dependency has been installed by the build.

See `firmware/m5/README.md` for build prerequisites and `tests/m5/README.md`
for verification. Physical USB, calibration and installation flight acceptance
remain separate from local software tests.
