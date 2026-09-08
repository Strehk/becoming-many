import { describe, expect, it } from "bun:test";
import {
  type M5SerialResponse,
  parseM5SerialResponse,
} from "../../../src/m5/protocol";

const IDENTITY = { deviceId: "station-m5", firmwareVersion: "test" };
const CONFIG = {
  ...IDENTITY,
  type: "config",
  ssid: "station",
  hasPassword: true,
  swapPitchRoll: true,
  invertPitch: false,
  invertRoll: true,
  isCalibrated: true,
  pitchOffset: 0.2,
  rollOffset: -0.1,
} satisfies M5SerialResponse;
const DIAGNOSIS = {
  ...IDENTITY,
  type: "diagnoseResult",
  hasConfig: true,
  wifiStatus: 3,
  localIp: "192.168.1.5",
  rssi: -55,
  mdnsRunning: true,
  httpPort: 80,
  imuPresent: true,
  lastPollAgeMs: -1,
  isCalibrated: true,
} satisfies M5SerialResponse;

describe("M5 serial response contract", () => {
  it.each([
    "configureResult",
    "calibrateResult",
    "factoryResetResult",
    "rebootResult",
    "commandResult",
  ] as const)(
    "accepts the real firmware result discriminant %s with true or false status",
    (type) => {
      for (const ok of [true, false]) {
        const response = { ...IDENTITY, type, ok, message: "Device result" };
        expect(parseM5SerialResponse(JSON.stringify(response))).toEqual(
          response,
        );
      }
    },
  );

  it("accepts config and diagnostics without inventing command acknowledgements", () => {
    expect(parseM5SerialResponse(JSON.stringify(CONFIG))).toEqual(CONFIG);
    expect(parseM5SerialResponse(JSON.stringify(DIAGNOSIS))).toEqual(DIAGNOSIS);
    expect(
      parseM5SerialResponse(
        JSON.stringify({ ...IDENTITY, type: "configure", ok: true }),
      ),
    ).toBeNull();
  });

  it("strips arbitrary and credential fields from otherwise valid responses", () => {
    expect(
      parseM5SerialResponse(
        JSON.stringify({
          ...CONFIG,
          password: "secret",
          nested: { password: "secret" },
        }),
      ),
    ).toEqual(CONFIG);
  });

  it("redacts every public string field while retaining useful result details", () => {
    expect(
      parseM5SerialResponse(
        JSON.stringify({
          ...CONFIG,
          ssid: "secret-station",
          deviceId: "secret-m5",
          firmwareVersion: "secret-version",
        }),
        "secret",
      ),
    ).toEqual({
      ...CONFIG,
      ssid: "[redacted]-station",
      deviceId: "[redacted]-m5",
      firmwareVersion: "[redacted]-version",
    });
    expect(
      parseM5SerialResponse(
        JSON.stringify({ ...DIAGNOSIS, localIp: "secret" }),
        "secret",
      ),
    ).toEqual({ ...DIAGNOSIS, localIp: "[redacted]" });
  });

  it("rejects missing fields in both diagnostic contracts", () => {
    for (const response of [CONFIG, DIAGNOSIS]) {
      for (const field of Object.keys(response)) {
        expect(
          parseM5SerialResponse(
            JSON.stringify({ ...response, [field]: undefined }),
          ),
        ).toBeNull();
      }
    }
  });

  it("rejects wrong field types and non-finite numbers", () => {
    expect(
      parseM5SerialResponse(JSON.stringify({ ...CONFIG, invertPitch: 1 })),
    ).toBeNull();
    expect(
      parseM5SerialResponse(
        JSON.stringify({ ...CONFIG, pitchOffset: Infinity }),
      ),
    ).toBeNull();
    expect(
      parseM5SerialResponse(JSON.stringify({ ...DIAGNOSIS, rssi: "-55" })),
    ).toBeNull();
    expect(
      parseM5SerialResponse(
        JSON.stringify({
          ...IDENTITY,
          type: "configureResult",
          ok: "false",
          message: "no",
        }),
      ),
    ).toBeNull();
  });

  it.each(["boot output", "null", "[]", "42", '{"password":"secret"}'])(
    "rejects noise %s",
    (text) => {
      expect(parseM5SerialResponse(text)).toBeNull();
    },
  );
});
