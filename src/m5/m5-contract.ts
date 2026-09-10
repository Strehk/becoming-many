import type { ControlFrame } from "./control-frame";
import type { M5State } from "./protocol";

export type M5DeviceStatus = "connecting" | "live" | "off";

/**
 * Read-only observation at one timestamp. Sample storage may be shared across
 * observations; never mutate it. Retained observations do not refresh freshness.
 * control contains normalized axes/quality only, never consumable button edges.
 */
export interface M5Observation {
  readonly host: string;
  readonly status: M5DeviceStatus;
  readonly sample: M5State | undefined;
  /** Last parsed reply for diagnostics only, regardless of firmware version. */
  readonly receivedState?: M5State;
  readonly control:
    | Readonly<Pick<ControlFrame, "pitch" | "roll" | "quality">>
    | undefined;
}

export interface M5Runtime {
  /** Replace the complete host lifetime; an empty host stops polling. */
  readonly setHost: (host: string) => void;
  /**
   * Exactly one render-frame reader consumes button edges. Undefined without
   * a host; stale configured input yields neutral steering. The returned frame
   * is borrowed and remains valid only until the next consume.
   */
  readonly consumeFrame: () => ControlFrame | undefined;
  readonly readObservation: () => M5Observation;
  /** Abort polling and permanently end this runtime; repeated calls are safe. */
  readonly unload: () => void;
}
