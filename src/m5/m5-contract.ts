import type { FlightInputSource } from "../control/control-contract";
import type { M5State } from "./protocol";

export type M5DeviceStatus = "connecting" | "live" | "off";

/**
 * Read-only device facts at one timestamp. Sample storage may be shared;
 * never mutate it. Retained observations do not refresh freshness.
 */
export interface M5Observation {
  readonly host: string;
  readonly status: M5DeviceStatus;
  /** Latest parsed reply while fresh; absent after expiry or disconnection. */
  readonly sample: M5State | undefined;
  /** Last parsed reply for diagnostics, including after expiry. */
  readonly receivedState?: M5State;
}

/**
 * A direct flight source: fresh device pitch maps to forward tilt and negative
 * device roll maps to right tilt, preserving the installation's flight polarity.
 * Frame time does not transform input. Missing or stale samples yield zero axes.
 */
export interface M5Runtime extends FlightInputSource {
  /** Replace the complete host lifetime; an empty host stops polling. */
  readonly setHost: (host: string) => void;
  readonly readObservation: () => M5Observation;
  /** Abort polling and permanently end this runtime; repeated calls are safe. */
  readonly unload: () => void;
}
