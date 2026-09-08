# Controls and M5

## Current

M5 device communication and input processing are consolidated in `src/m5`.
`runtime/` owns HTTP polling and the shared validity/filter pipeline; `setup/`
owns USB communication. The shared wire contract stays in `protocol.ts`.
M5/Flash presentation belongs to `src/ui` and is connected by `src/entry`.
See [M5](../../src/m5/README.md) for the contracts and reading order.

The firmware owns normalization, mounting axes and calibration. The browser
validates identity, version, calibration, advancing sequence and freshness,
then applies safety, neutralization and smoothing before rig locomotion.
Host replacement aborts requests and replaces all derived input history.

One Run reader consumes button events. UI observes a shared snapshot with
separate device status, accepted pose and effective steering; it cannot steal
button edges. A live device can have neutral input. Quality zero preserves
the current glider behavior; keyboard input returns only without a configured
host. Physical polarity acceptance remains open.

Firmware source and its typed simulator/export tools are under `firmware/m5`.
The export command builds a merged image, checks firmware/browser compatibility
and produces the Flash manifest. Reconfiguring WiFi preserves omitted mounting
options. Serial replies distinguish completed writes from confirmed operations;
browser passwords are transient and excluded/redacted from logs.

## Physical acceptance

Technician setup remains separate from normal operation. Actual hardware must
still verify flash, configure, calibrate, reboot, reconnect, wrong/stale device,
controller removal and installation flight. Local browser and native tests do
not establish this evidence. The existing #18/#38 and installation acceptance
remain open where physical criteria are unmet.

Do not add BLE, relays, pairing infrastructure or another control protocol
without a demonstrated deployment requirement.
