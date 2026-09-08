# M5 Tests

`bun test tests/m5 tests/control` checks the device boundary and its consumers:

- `protocol.test.ts`: untrusted HTTP parsing and normalized ranges.
- `runtime/`: filtering, neutralization, smoothing, eligibility and exact stale
  boundaries; observation versus effective steering; single-reader button
  events; host replacement, late responses, failed polls and permanent unload.
- `setup/`: typed serial replies, secret redaction, actual stream cancellation,
  write/close failures and device disconnection without physical hardware.
- `firmware/`: release version guards and failed builds that cannot publish
  firmware artifacts.

`bun run m5-export` performs the actual PlatformIO build and publishes the
matching merged binary/manifest locally. After that, `bun run m5-test-config`
compiles the actual C++ configuration function against the installed ArduinoJson
headers and exercises omitted and explicit mounting options. It is separate
from normal Bun tests because it requires a native compiler and the firmware
build dependencies.

The existing production browser smoke covers the operator observation and USB
setup UI, including transient synthetic credentials. The simulator and local
native checks do not establish physical controller calibration, flash success,
headset behavior or installation performance.
