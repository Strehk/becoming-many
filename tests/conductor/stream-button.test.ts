/**
 * Purpose: Pin what the headset button offers to the XR session state.
 * Context: One button answers "can I start the headset picture right now".
 * Responsibility: Cover the whole availability × session matrix.
 * Boundary: The word for each action lives in the conductor copy; the DOM
 *   around it lives in the session bar. Both untested by design.
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
    ).toEqual({ action: "start", isEnabled: true });
  });

  test("offers the stop while a session runs", () => {
    expect(
      resolveStreamButton({ availability: "available", isSessionActive: true }),
    ).toEqual({ action: "stop", isEnabled: true });
  });

  test("keeps the stop even if availability drops mid-session", () => {
    expect(
      resolveStreamButton({
        availability: "unsupported",
        isSessionActive: true,
      }),
    ).toEqual({ action: "stop", isEnabled: true });
  });

  test("disables itself without a runtime", () => {
    expect(
      resolveStreamButton({
        availability: "unsupported",
        isSessionActive: false,
      }),
    ).toEqual({ action: "unavailable", isEnabled: false });
  });

  test("reads as unavailable while the support check is still out", () => {
    expect(
      resolveStreamButton({ availability: "unknown", isSessionActive: false }),
    ).toEqual({ action: "unavailable", isEnabled: false });
  });
});
