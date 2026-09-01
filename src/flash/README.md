# Flash

The operator/technician page at `/flash.html` that flashes and configures an
M5 controller over USB. Flashing installs the committed merged binary from
`public/firmware/` via esp-web-tools; configuration and diagnostics speak the
newline-JSON serial commands from `src/m5/protocol.ts` through Web Serial
(`serial-setup.ts`). The last-used station credentials are remembered in
localStorage — a technician convenience, not authored configuration.

Building the binary is a manual PlatformIO step documented in
`firmware/m5/README.md`.
