/**
 * Purpose: Prove polls become render frames without losing edges or trust.
 * Context: Polls arrive at ~6Hz and the render loop reads at up to 90Hz;
 *   the source bridges the rates and guards against the neighbour rig.
 * Responsibility: Cover edge diffing and latching, staleness, wrong-device
 *   rejection, the firmware-mismatch report, and the non-consuming read a
 *   second view uses.
 * Boundary: The individual pipeline stages have their own tests.
 */

import { describe, expect, it } from "bun:test";
import { M5_FIRMWARE_VERSION, type M5State } from "../../../src/m5/protocol";
import { createControlSource } from "../../../src/m5/runtime/control-source";
import { M5_SETTINGS } from "../../../src/m5/runtime/m5-settings";

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
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(
      state({ seq: 2, buttonPressCount: 1, buttonReleaseCount: 1 }),
      50,
    );

    const frame = source.consumeFrame(60);
    expect(frame.buttonDown).toBe(true);
    expect(frame.buttonUp).toBe(true);
  });

  it("delivers a latched edge exactly once across many render frames", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(
      state({ seq: 2, buttonPressCount: 1, buttonPressed: true }),
      50,
    );

    expect(source.consumeFrame(55).buttonDown).toBe(true);
    expect(source.consumeFrame(66).buttonDown).toBe(false);
    expect(source.consumeFrame(77).buttonDown).toBe(false);
  });

  it("discards pending edges once polls become stale", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state({ pitch: 0.4 }), 0);
    source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);

    const staleFrame = source.consumeFrame(50 + 1_001);
    expect(staleFrame.quality).toBe(0);
    expect(staleFrame.pitch).toBe(0);
    expect(staleFrame.buttonDown).toBe(false);
    expect(source.readObservation(50 + 1_001).status).toBe("connecting");
    expect(source.readObservation(50 + 1_001).sample).toBeUndefined();
    source.pushState(state({ seq: 3, buttonPressCount: 12 }), 1_052);
    expect(source.consumeFrame(1_053).buttonDown).toBe(false);
  });

  it("eases a live pose up from neutral instead of snapping", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state({ pitch: 0.4 }), 0);

    // One smoothing step: 0.625 of the way from 0 toward 0.4.
    expect(source.consumeFrame(10).pitch).toBeCloseTo(0.25);
    expect(source.readObservation(10)).toEqual({
      status: "live",
      sample: state({ pitch: 0.4 }),
      control: { pitch: 0.25, roll: 0, quality: 1 },
    });
  });

  it.each([
    ["missing-id", {}, ""],
    ["wrong-device", { deviceId: "other-rig" }, BASE_STATE.deviceId],
    ["incompatible-firmware", { firmwareVersion: "old" }, BASE_STATE.deviceId],
    ["uncalibrated", { isCalibrated: false }, BASE_STATE.deviceId],
    ["stalled", { seq: 2 }, BASE_STATE.deviceId],
    ["stalled", { seq: 1 }, BASE_STATE.deviceId],
    ["stalled", { seq: 1, uptimeMs: 10 }, BASE_STATE.deviceId],
  ] as const)(
    "neutralizes %s and recovers without old edges",
    (reason, rejected, expectedId) => {
      const source = createControlSource(expectedId);
      source.pushState(state({ pitch: 0.4 }), 0);
      source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);
      for (let poll = 0; poll < 3; poll++) {
        source.pushState(state({ seq: 3, ...rejected }), 60 + poll);
        const frame = source.consumeFrame(65);
        expect(frame.quality).toBe(0);
        expect(frame.buttonDown).toBe(false);
        expect(source.readObservation(65)).toEqual({
          status: reason,
          sample: undefined,
          control: { pitch: 0, roll: 0, quality: 0 },
        });
      }
      source.pushState(
        state({ seq: "uptimeMs" in rejected ? rejected.seq : 2 }),
        66,
      );
      expect(source.consumeFrame(67).quality).toBe(0);
      source.pushState(state({ seq: 4, pitch: 0.4, buttonPressCount: 12 }), 70);
      const recovered = source.consumeFrame(75);
      expect(recovered.pitch).toBeCloseTo(expectedId ? 0.25 : 0);
      expect(recovered.buttonDown).toBe(false);
    },
  );

  it("hands a glanceable reader the newest poll without eating an edge", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);

    const observed = source.readObservation(60);
    expect(observed.sample?.pitch).toBe(0.4);
    expect(observed.control.pitch).toBe(0.25);
    for (let frame = 60; frame < 100; frame++) {
      expect(source.readObservation(frame)).toEqual(observed);
    }
    expect(source.consumeFrame(100).buttonDown).toBe(true);
    expect(source.readObservation(100)).toEqual(observed);
    expect(source.consumeFrame(101).buttonDown).toBe(false);
  });

  it("shows a valid extreme sample separately from safety-neutralized steering", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state({ pitch: 0.9 }), 0);
    expect(source.readObservation(10)).toEqual({
      status: "live",
      sample: state({ pitch: 0.9 }),
      control: { pitch: 0, roll: 0, quality: 0 },
    });
    source.pushState(state({ seq: 2, pitch: 0.9, buttonPressCount: 1 }), 50);
    expect(source.readObservation(60).control.quality).toBe(0);
    expect(source.consumeFrame(60).buttonDown).toBe(true);
    expect(source.consumeFrame(61).buttonDown).toBe(false);
    source.pushState(state({ seq: 3, pitch: 0.4, buttonPressCount: 1 }), 100);
    expect(source.readObservation(110).control).toEqual({
      pitch: 0.25,
      roll: 0,
      quality: 1,
    });
  });

  it("observes the exact freshness boundary consistently without consuming pending edges", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);
    const lastFresh = 50 + M5_SETTINGS.staleAfterMilliseconds;
    expect(source.readObservation(lastFresh).status).toBe("live");
    expect(source.readObservation(lastFresh).control.pitch).toBe(0.25);
    expect(source.readObservation(lastFresh + 1)).toEqual({
      status: "connecting",
      sample: undefined,
      control: { pitch: 0, roll: 0, quality: 0 },
    });
    source.pushState(
      state({ seq: 3, pitch: -0.4, buttonPressCount: 15 }),
      lastFresh + 2,
    );
    expect(source.consumeFrame(lastFresh + 3)).toMatchObject({
      pitch: -0.25,
      quality: 1,
      buttonDown: false,
      buttonUp: false,
    });
  });

  it("resets a rebooted device's counter baseline and accepts only subsequent progress", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(
      state({ seq: 50, uptimeMs: 9_000, buttonPressCount: 8 }),
      0,
    );
    source.pushState(state({ seq: 1, uptimeMs: 10, buttonPressCount: 0 }), 50);
    expect(source.readObservation(60).status).toBe("stalled");
    source.pushState(state({ seq: 2, uptimeMs: 60, buttonPressCount: 1 }), 100);
    expect(source.readObservation(110).status).toBe("live");
    expect(source.consumeFrame(110).buttonDown).toBe(false);
    source.pushState(
      state({ seq: 3, uptimeMs: 110, buttonPressCount: 2 }),
      150,
    );
    expect(source.consumeFrame(160).buttonDown).toBe(true);
  });

  it("keeps a stable rig at exact zero across render reads and releases on movement", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    const stableUntil = M5_SETTINGS.stableDurationMilliseconds;
    for (let now = 0; now <= stableUntil; now += 100) {
      source.pushState(
        state({
          seq: now + 1,
          uptimeMs: now + 1_000,
          pitch: 0.02,
          roll: -0.02,
        }),
        now,
      );
    }
    for (let now = stableUntil; now < stableUntil + 100; now++) {
      expect(source.readObservation(now).control).toEqual({
        pitch: 0,
        roll: 0,
        quality: 1,
      });
      expect(source.consumeFrame(now)).toMatchObject({
        pitch: 0,
        roll: 0,
        quality: 1,
      });
    }
    source.pushState(
      state({
        seq: stableUntil + 101,
        uptimeMs: stableUntil + 1_100,
        pitch: 0.4,
      }),
      stableUntil + 100,
    );
    const released = source.consumeFrame(stableUntil + 110);
    expect(released.pitch).toBeGreaterThan(0);
    expect(released.pitch).toBeLessThan(0.4);
    expect(released.quality).toBe(1);
  });
});
