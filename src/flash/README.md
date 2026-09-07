# Flash

The operator/technician page at `/flash.html` that flashes and configures an
M5 controller over USB. Flashing installs the committed merged binary from
`public/firmware/m5-controller/` via esp-web-tools; configuration and diagnostics speak the
newline-JSON serial commands from `src/m5/protocol.ts` through Web Serial
(`serial-setup.ts`). The page remembers only SSID and device ID in localStorage
and removes any legacy stored password on load, including malformed entries.
Enter the password for each visit; it is sent to the device but redacted in the
page log.

Building the binary is a manual PlatformIO step documented in
`firmware/m5/README.md`.


## UI and device boundary

The browser entry connects Flash UI to the existing serial setup adapter;
Flash has no Experience Run. UI owns forms/status and its DOM, while the serial
adapter owns device communication and cleanup. `src/flash.entry.ts` mounts
`flash.page.ts` and imports `src/app.css`, preserving scrolling and esp-web-tools' Shadow DOM
and body-mounted dialogs. Project UI conventions do not change the external
firmware protocol or permit secret persistence.
