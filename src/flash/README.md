# Flash

The operator/technician page at `/flash.html` that flashes and configures an
M5 controller over USB. Flashing installs the committed merged binary from
`public/firmware/` via esp-web-tools; configuration and diagnostics speak the
newline-JSON serial commands from `src/m5/protocol.ts` through Web Serial
(`serial-setup.ts`). The current page persists the last-used credentials in
localStorage; persisting or logging the Wi-Fi password is an open security
defect tracked in issue #12 and is not an approved long-term behavior.

Building the binary is a manual PlatformIO step documented in
`firmware/m5/README.md`.
