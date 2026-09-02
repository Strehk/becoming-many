/**
 * Purpose: Prove polls become render frames without losing edges or trust.
 * Context: Polls arrive at ~20Hz and the render loop reads at up to 90Hz;
 *   the source bridges the rates and guards against the neighbour rig.
 * Responsibility: Cover edge diffing and latching, staleness, wrong-device
 *   rejection, and the firmware-mismatch report.
 * Boundary: The individual pipeline stages have their own tests.
 */

import { describe, expect, it } from "bun:test";
import { createControlSource } from "../../src/m5/control-source";
import { M5_FIRMWARE_VERSION, type M5State } from "../../src/m5/protocol";

const BASE_STATE: M5State = {
  deviceId: "bm-station-a-m5",
  firmwareVersion: M5_FIRMWARE_VERSION,
  seq: 1,
  uptimeMs: 1_000,
  pitch: 0,
  roll: 0,
  quality: 1,
  buttonPressed: false,
  buttonPressCount: 0,
  buttonReleaseCount: 0,
  isCalibrated: true,
  rssi: -50,
};

function state(overrides: Partial<M5State> = {}): M5State {
  return { ...BASE_STATE, ...overrides };
}

describe("control source", () => {
  it("derives both edges from a press-and-release between two polls", () => {
    const source = createControlSource();
    source.pushState(state(), 0);
    source.pushState(state({ buttonPressCount: 1, buttonReleaseCount: 1 }), 50);

    const frame = source.readFrame(60);
    expect(frame.buttonDown).toBe(true);
    expect(frame.buttonUp).toBe(true);
  });

  it("delivers a latched edge exactly once across many render frames", () => {
    const source = createControlSource();
    source.pushState(state(), 0);
    source.pushState(state({ buttonPressCount: 1, buttonPressed: true }), 50);

    expect(source.readFrame(55).buttonDown).toBe(true);
    expect(source.readFrame(66).buttonDown).toBe(false);
    expect(source.readFrame(77).buttonDown).toBe(false);
  });

  it("reads counters on the first poll as history, not as presses", () => {
    const source = createControlSource();
    source.pushState(
      state({ buttonPressCount: 12, buttonReleaseCount: 12 }),
      0,
    );

    const frame = source.readFrame(10);
    expect(frame.buttonDown).toBe(false);
    expect(frame.buttonUp).toBe(false);
  });

  it("goes neutral once polls stop, still delivering a pending edge", () => {
    const source = createControlSource();
    source.pushState(state({ pitch: 0.4 }), 0);
    source.pushState(state({ pitch: 0.4, buttonPressCount: 1 }), 50);

    const staleFrame = source.readFrame(50 + 1_001);
    expect(staleFrame.quality).toBe(0);
    expect(staleFrame.pitch).toBe(0);
    expect(staleFrame.buttonDown).toBe(true);
    expect(source.readDeviceReport(50 + 1_001).state).toBe("connecting");
  });

  it("eases a live pose up from neutral instead of snapping", () => {
    const source = createControlSource();
    source.pushState(state({ pitch: 0.4 }), 0);

    // One smoothing step: 0.25 of the way from 0 toward 0.4.
    expect(source.readFrame(10).pitch).toBeCloseTo(0.1);
    expect(source.readDeviceReport(10)).toEqual({
      state: "live",
      quality: 1,
      hasFirmwareMismatch: false,
    });
  });

  it("never steers from a wrong device and reports it", () => {
    const source = createControlSource("bm-station-a-m5");
    source.pushState(state({ deviceId: "bm-station-b-m5", pitch: 0.5 }), 0);

    const frame = source.readFrame(10);
    expect(frame.quality).toBe(0);
    expect(frame.pitch).toBe(0);
    expect(source.readDeviceReport(10).state).toBe("wrong-device");
  });

  it("flags a firmware mismatch while continuing to steer", () => {
    const source = createControlSource();
    source.pushState(state({ firmwareVersion: "9.9.9-other" }), 0);

    expect(source.readDeviceReport(10)).toEqual({
      state: "live",
      quality: 1,
      hasFirmwareMismatch: true,
    });
  });
});
