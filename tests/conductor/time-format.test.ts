/**
 * Purpose: Verify the readouts an operator scans during a performance.
 * Context: The same seconds appear as a clock everywhere on the page, and
 *   every cue id appears as a chapter name.
 * Responsibility: Cover padding, rounding, how a negative value reads, and
 *   the chapter naming.
 * Boundary: Layout and typography belong to the page.
 */

import { describe, expect, test } from "bun:test";
import {
  cueDisplayName,
  formatShowTime,
} from "../../src/conductor/time-format";

describe("formatShowTime", () => {
  test("pads the seconds to two digits", () => {
    expect(formatShowTime(0)).toBe("0:00");
    expect(formatShowTime(9)).toBe("0:09");
    expect(formatShowTime(70)).toBe("1:10");
  });

  test("writes the length of the piece", () => {
    expect(formatShowTime(521)).toBe("8:41");
  });

  test("truncates rather than rounding up to a second that has not come", () => {
    expect(formatShowTime(59.9)).toBe("0:59");
  });

  test("reads a negative instant as the start", () => {
    expect(formatShowTime(-4)).toBe("0:00");
  });
});

describe("cueDisplayName", () => {
  test("reads a cue id as a chapter name", () => {
    expect(cueDisplayName("prologue")).toBe("Prologue");
    expect(cueDisplayName("return")).toBe("Return");
  });
});
