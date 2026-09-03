/**
 * Purpose: Define the wire contract between the M5StickS3 firmware and every client.
 * Context: The device is a polled HTTP server on the station network; clients GET its state.
 * Responsibility: Own the state payload shape, the serial setup messages, and the parser
 *   that turns untrusted wire text into a typed state.
 * Boundary: Polling cadence, ControlFrame derivation, and flashing live elsewhere.
 */

/**
 * Must match `FirmwareVersion` in `firmware/m5/src/main.cpp`. A client that
 * sees a different value warns the operator instead of guessing at payload
 * compatibility.
 */
export const M5_FIRMWARE_VERSION = "0.3.2-bm-http";

/**
 * `GET /state` on port 80 is the one polled endpoint; everything the device
 * knows arrives in each response. The firmware samples every 50ms, so polling
 * faster only re-reads the same snapshot. The polling adapter owns its cadence
 * and staleness settings.
 *
 * Pitch and roll are already normalized, axis-mapped,
 * and calibrated on the device (-1..1), so every client agrees on zero.
 *
 * Button edges survive polling through the monotonic counters: a press-and-
 * release between two polls still advances both counters, so clients diff
 * counters against their previous poll instead of trusting `buttonPressed`
 * snapshots.
 */
export interface M5State {
  readonly deviceId: string;
  readonly firmwareVersion: string;
  /** Increments per IMU sample; a frozen value means the firmware loop stalled. */
  readonly seq: number;
  readonly uptimeMs: number;
  /** -1..1, forward-positive after axis mapping and calibration. */
  readonly pitch: number;
  /** -1..1, right-positive after axis mapping and calibration. */
  readonly roll: number;
  /** 0..1; 0 means "nothing is steering" — a normal state, not an error. */
  readonly quality: number;
  readonly buttonPressed: boolean;
  readonly buttonPressCount: number;
  readonly buttonReleaseCount: number;
  readonly isCalibrated: boolean;
  /** WiFi RSSI in dBm, 0 when disconnected. Diagnostics only. */
  readonly rssi: number;
}

/**
 * Setup messages over USB serial, one JSON object per line. The device answers
 * every command with a single JSON line carrying a matching `type`.
 */
export type M5SerialCommand =
  | {
      readonly type: "configure";
      readonly ssid: string;
      readonly password: string;
      readonly deviceId: string;
      readonly swapPitchRoll?: boolean;
      readonly invertPitch?: boolean;
      readonly invertRoll?: boolean;
    }
  /** Read back stored state; the password is redacted in the response. */
  | { readonly type: "getConfig" }
  /** Network reachability self-test plus current runtime state. */
  | { readonly type: "diagnose" }
  /** Adopt the current pose as the new zero, persisted on the device. */
  | { readonly type: "calibrate" }
  | { readonly type: "clearCalibration" }
  | { readonly type: "factoryReset" }
  | { readonly type: "reboot" };

/** Parse an untrusted `/state` response body. Returns null for anything malformed. */
export function parseM5State(text: string): M5State | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;

  if (typeof record.deviceId !== "string" || record.deviceId.length === 0) {
    return null;
  }
  if (typeof record.firmwareVersion !== "string") return null;
  if (!areFiniteNumbers(record.seq, record.uptimeMs, record.rssi)) return null;
  if (!areFiniteNumbers(record.pitch, record.roll, record.quality)) return null;
  if (!areFiniteNumbers(record.buttonPressCount, record.buttonReleaseCount)) {
    return null;
  }
  if (typeof record.buttonPressed !== "boolean") return null;
  if (typeof record.isCalibrated !== "boolean") return null;

  return {
    deviceId: record.deviceId,
    firmwareVersion: record.firmwareVersion,
    seq: record.seq as number,
    uptimeMs: record.uptimeMs as number,
    pitch: clamp(record.pitch as number, -1, 1),
    roll: clamp(record.roll as number, -1, 1),
    quality: clamp(record.quality as number, 0, 1),
    buttonPressed: record.buttonPressed,
    buttonPressCount: record.buttonPressCount as number,
    buttonReleaseCount: record.buttonReleaseCount as number,
    isCalibrated: record.isCalibrated,
    rssi: record.rssi as number,
  };
}

function areFiniteNumbers(...values: readonly unknown[]): boolean {
  return values.every(
    (value) => typeof value === "number" && Number.isFinite(value),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
