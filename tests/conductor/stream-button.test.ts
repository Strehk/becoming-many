/**
 * Purpose: Pin the stream button's label to the XR session state.
 * Context: One label answers "can I start the headset stream right now".
 * Responsibility: Cover the whole availability × session matrix.
 * Boundary: The DOM around the label lives in the stage panel, untested by design.
 */

import { describe, expect, test } from "bun:test";
import { resolveStreamButton } from "../../src/conductor/stream-button";

describe("resolveStreamButton", () => {
  test("offers the start while a headset runtime is available", () => {
    expect(
      resolveStreamButton({
        availability: "available",
        isSessionActive: false,
      }),
    ).toEqual({ label: "Start Stream", isEnabled: true });
  });

  test("offers the stop while a session runs", () => {
    expect(
      resolveStreamButton({ availability: "available", isSessionActive: true }),
    ).toEqual({ label: "Stop Stream", isEnabled: true });
  });

  test("keeps the stop even if availability drops mid-session", () => {
    expect(
      resolveStreamButton({
        availability: "unsupported",
        isSessionActive: true,
      }),
    ).toEqual({ label: "Stop Stream", isEnabled: true });
  });

  test("disables itself without a runtime", () => {
    expect(
      resolveStreamButton({
        availability: "unsupported",
        isSessionActive: false,
      }),
    ).toEqual({ label: "No Stream Available", isEnabled: false });
  });

  test("reads as unavailable while the support check is still out", () => {
    expect(
      resolveStreamButton({ availability: "unknown", isSessionActive: false }),
    ).toEqual({ label: "No Stream Available", isEnabled: false });
  });
});
