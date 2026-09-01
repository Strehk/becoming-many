<!--
Purpose: Explain how to build, flash, and configure the M5StickS3 controller firmware.
Context: The firmware is a PlatformIO project outside the web toolchain; humans build it.
Responsibility: Document the build, the merged-binary export for the flash page, and the serial setup channel.
Boundary: The wire contract lives in src/m5/protocol.ts; direction in docs/direction/controls-m5.md.
-->

# M5StickS3 Controller Firmware

The controller is an [M5StickS3](https://docs.m5stack.com/en/core/StickS3)
strapped to the ICAROS rig. It samples its IMU, runs the device-owned pipeline
stages (`normalize → axis-map → calibrate`), and serves the result as JSON on
`GET /state` — a plain HTTP server on the station network that clients poll.
`src/m5/protocol.ts` is the shared wire contract; keep `FirmwareVersion` in
`src/main.cpp` in sync with `M5_FIRMWARE_VERSION` there.

The StickS3 differs from the M5StickC Plus2 the previous stack used: ESP32-S3
with native USB (no UART bridge), a BMI270 IMU behind M5Unified, an M5PM1
power chip (no GPIO4 power-hold), and no PlatformIO board definition — the
generic `esp32-s3-devkitc-1` board with 8MB partitions matches the official
examples.

The platform is **pioarduino**, not the official `espressif32` platform: the
official one stopped at Arduino core 2.x before the StickS3 existed, and
M5Unified's StickS3 support (M5GFX autodetect probes the M5PM1 over I2C and
powers the LCD rail through it) is only verified against core 3.x. A build on
the official platform compiles but leaves the display black on hardware.

## Build and flash over USB

```sh
pio run                 # build
pio run -t upload       # flash a StickS3 on native USB
pio device monitor      # watch the newline-JSON serial channel
```

## Export the merged binary for the flash page

The browser flash page (`/flash.html`, esp-web-tools) installs one merged
image from `public/firmware/`. The pioarduino platform already merges
bootloader, partitions, boot_app0, and app on every build, so after a
release-worthy build the export is one copy:

```sh
pio run
cp .pio/build/m5stick-s3/firmware.factory.bin ../../public/firmware/bm-m5.bin
```

Then bump the `version` in `public/firmware/manifest.json` to match
`FirmwareVersion`. CI automation for this step is planned but not built
([Quality and Operations](../../docs/direction/quality-operations.md)).

## Serial setup channel

Newline-delimited JSON over the USB CDC serial port at 115200 baud. Commands
and answers are typed in `src/m5/protocol.ts`:

- `{"type":"configure","ssid":"…","password":"…","deviceId":"bm-station-a-m5"}`
  — optional `swapPitchRoll` / `invertPitch` / `invertRoll` booleans for the
  mount's axis map.
- `{"type":"getConfig"}` — stored state, password redacted.
- `{"type":"diagnose"}` — network and IMU self-test.
- `{"type":"calibrate"}` / `{"type":"clearCalibration"}` — adopt or clear the
  rig's rest pose as zero (persisted in NVS). Holding the front B button for
  1.5 s calibrates without a laptop.
- `{"type":"reboot"}` / `{"type":"factoryReset"}`.

## On-device diagnostics

The display shows the calibrated level pad, WiFi state, IP, device id, and how
recently a client polled `/state`. The device announces itself over mDNS as
`<deviceId>.local` with an `_http._tcp` service.
