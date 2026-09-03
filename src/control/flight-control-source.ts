/**
 * Purpose: Select the live flight input used by one render frame.
 * Context: A configured M5 controller takes precedence over desktop movement.
 * Responsibility: Route each frame to exactly one existing flight adapter.
 * Boundary: Polling, input capture, benchmarks, and render-loop ownership live elsewhere.
 */

import type { Object3D } from "three";
import type { ControlFrame } from "../m5/control-frame";
import { applyM5Flight } from "./m5-flight";

export interface DesktopFlightSource {
  readonly update: (deltaSeconds: number) => void;
}

export interface M5FlightSource {
  readonly readFrame: () => ControlFrame | undefined;
}

export interface FlightControlSource {
  readonly update: (deltaSeconds: number) => void;
}

export function createFlightControlSource(
  viewerRig: Object3D,
  desktop: DesktopFlightSource,
  m5: M5FlightSource,
): FlightControlSource {
  return {
    update(deltaSeconds): void {
      const controlFrame = m5.readFrame();
      if (controlFrame) {
        applyM5Flight(viewerRig, controlFrame, deltaSeconds);
        return;
      }

      desktop.update(deltaSeconds);
    },
  };
}
