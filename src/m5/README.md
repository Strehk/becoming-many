# M5

The wire contract between the M5StickS3 controller firmware and every browser
client. `protocol.ts` owns the `GET /state` payload shape, the USB serial setup
commands, and the parser for untrusted payloads. `M5_FIRMWARE_VERSION` must
match `FirmwareVersion` in `firmware/m5/src/main.cpp`.

The polling adapter that turns `/state` into ControlFrames will live beside
the contract when it lands ([Controls and M5](../../docs/direction/controls-m5.md)).
