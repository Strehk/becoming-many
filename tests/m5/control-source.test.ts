/**
 * Purpose: Prove polls become render frames without losing edges or trust.
 * Context: Polls arrive at ~6Hz and the render loop reads at up to 90Hz;
 *   the source bridges the rates and guards against the neighbour rig.
 * Responsibility: Cover edge diffing and latching, staleness, wrong-device
 *   rejection, the firmware-mismatch report, and the non-consuming read a
 *   second view uses.
 * Boundary: The individual pipeline stages have their own tests.
 */

import { describe, expect, it, spyOn } from "bun:test";
import { createControlSource } from "../../src/m5/control-source";
import { createM5Adapter } from "../../src/m5/m5-adapter";
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
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(
      state({ seq: 2, buttonPressCount: 1, buttonReleaseCount: 1 }),
      50,
    );

    const frame = source.readFrame(60);
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

    expect(source.readFrame(55).buttonDown).toBe(true);
    expect(source.readFrame(66).buttonDown).toBe(false);
    expect(source.readFrame(77).buttonDown).toBe(false);
  });

  it("resets host history and ignores a late response without blocking the next host", async () => {
    const lateResponse = Promise.withResolvers<Response>();
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(state({ pitch: 0.4 })))
      .mockReturnValueOnce(lateResponse.promise)
      .mockResolvedValueOnce(
        Response.json(
          state({ pitch: -0.4, buttonPressCount: 12, buttonReleaseCount: 12 }),
        ),
      );
    const adapter = createM5Adapter(BASE_STATE.deviceId);
    try {
      adapter.setHost("first.local");
      await Bun.sleep(0);
      expect(adapter.readFrame()?.pitch).toBeCloseTo(0.25);
      adapter.setHost("hanging.local");
      expect(adapter.readFrame()?.quality).toBe(0);
      expect(adapter.readLatestState()).toBeUndefined();
      adapter.setHost("next.local");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
      await Bun.sleep(0);
      const frame = adapter.readFrame();
      expect(frame?.pitch).toBeCloseTo(-0.25);
      expect(frame?.buttonDown).toBe(false);
      expect(frame?.buttonUp).toBe(false);
      lateResponse.resolve(
        Response.json(state({ pitch: 0.8, buttonPressCount: 13 })),
      );
      await Bun.sleep(0);
      expect(adapter.readLatestState()?.pitch).toBe(-0.4);
      adapter.setHost("");
      expect(adapter.readFrame()).toBeUndefined();
      expect(adapter.readOperatorStatus()).toEqual({ state: "off" });
    } finally {
      adapter.unload();
      fetchMock.mockRestore();
    }
  });

  it("discards pending edges once polls become stale", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state({ pitch: 0.4 }), 0);
    source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);

    const staleFrame = source.readFrame(50 + 1_001);
    expect(staleFrame.quality).toBe(0);
    expect(staleFrame.pitch).toBe(0);
    expect(staleFrame.buttonDown).toBe(false);
    expect(source.readDeviceReport(50 + 1_001).state).toBe("connecting");
    expect(source.readLatestState(50 + 1_001)).toBeUndefined();
    source.pushState(state({ seq: 3, buttonPressCount: 12 }), 1_052);
    expect(source.readFrame(1_053).buttonDown).toBe(false);
  });

  it("eases a live pose up from neutral instead of snapping", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state({ pitch: 0.4 }), 0);

    // One smoothing step: 0.625 of the way from 0 toward 0.4.
    expect(source.readFrame(10).pitch).toBeCloseTo(0.25);
    expect(source.readDeviceReport(10)).toEqual({
      state: "live",
      quality: 1,
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
        const frame = source.readFrame(65);
        expect(frame.quality).toBe(0);
        expect(frame.buttonDown).toBe(false);
        expect(source.readLatestState(65)).toBeUndefined();
        expect(source.readDeviceReport(65)).toEqual({
          state: reason,
          quality: 0,
        });
      }
      source.pushState(
        state({ seq: "uptimeMs" in rejected ? rejected.seq : 2 }),
        66,
      );
      expect(source.readFrame(67).quality).toBe(0);
      source.pushState(state({ seq: 4, pitch: 0.4, buttonPressCount: 12 }), 70);
      const recovered = source.readFrame(75);
      expect(recovered.pitch).toBeCloseTo(expectedId ? 0.25 : 0);
      expect(recovered.buttonDown).toBe(false);
    },
  );

  it("hands a glanceable reader the newest poll without eating an edge", () => {
    const source = createControlSource(BASE_STATE.deviceId);
    source.pushState(state(), 0);
    source.pushState(state({ seq: 2, pitch: 0.4, buttonPressCount: 1 }), 50);

    expect(source.readLatestState(60)?.pitch).toBe(0.4);
    // The raw poll, not the smoothed frame — and the press still arrives.
    expect(source.readFrame(60).buttonDown).toBe(true);
  });
});
