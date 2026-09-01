/**
 * Purpose: Prove the /state parser accepts firmware payloads and rejects junk.
 * Context: The payload crosses the network from a device the page cannot trust.
 * Responsibility: Cover the accept path, every rejected field, and clamping.
 * Boundary: Polling, edges, and ControlFrame derivation are not parsed here.
 */

import { describe, expect, it } from "bun:test";
import {
  M5_FIRMWARE_VERSION,
  type M5State,
  parseM5State,
} from "../../src/m5/protocol";

const VALID_STATE: M5State = {
  deviceId: "bm-station-a-m5",
  firmwareVersion: M5_FIRMWARE_VERSION,
  seq: 1200,
  uptimeMs: 60_000,
  pitch: 0.25,
  roll: -0.5,
  quality: 1,
  buttonPressed: false,
  buttonPressCount: 3,
  buttonReleaseCount: 3,
  isCalibrated: true,
  rssi: -55,
};

function stateText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...VALID_STATE, ...overrides });
}

describe("parseM5State", () => {
  it("accepts a complete firmware payload", () => {
    expect(parseM5State(stateText())).toEqual(VALID_STATE);
  });

  it("rejects text that is not JSON", () => {
    expect(parseM5State("not json")).toBeNull();
  });

  it("rejects JSON that is not an object", () => {
    expect(parseM5State("42")).toBeNull();
    expect(parseM5State("null")).toBeNull();
  });

  it("rejects a missing or empty deviceId", () => {
    expect(parseM5State(stateText({ deviceId: undefined }))).toBeNull();
    expect(parseM5State(stateText({ deviceId: "" }))).toBeNull();
  });

  it("rejects non-finite control numbers", () => {
    expect(parseM5State(stateText({ pitch: "0.5" }))).toBeNull();
    expect(parseM5State(stateText({ roll: null }))).toBeNull();
    expect(parseM5State(stateText({ quality: undefined }))).toBeNull();
  });

  it("rejects missing button fields", () => {
    expect(parseM5State(stateText({ buttonPressed: undefined }))).toBeNull();
    expect(parseM5State(stateText({ buttonPressCount: undefined }))).toBeNull();
  });

  it("clamps out-of-range control values instead of rejecting them", () => {
    const state = parseM5State(stateText({ pitch: 2, roll: -2, quality: 1.5 }));
    expect(state).not.toBeNull();
    expect(state?.pitch).toBe(1);
    expect(state?.roll).toBe(-1);
    expect(state?.quality).toBe(1);
  });
});
