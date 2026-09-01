/**
 * Purpose: Verify the readouts an operator scans during a performance.
 * Context: The same seconds appear as a clock, a cue length, and headroom.
 * Responsibility: Cover padding, rounding, and how a negative value reads.
 * Boundary: Layout and typography belong to the page.
 */

import { describe, expect, test } from "bun:test";
import {
  formatDurationSeconds,
  formatHeadroomSeconds,
  formatShowTime,
} from "../../src/conductor/time-format";

describe("formatShowTime", () => {
  test("pads the seconds to two digits", () => {
    expect(formatShowTime(0)).toBe("0:00");
    expect(formatShowTime(9)).toBe("0:09");
    expect(formatShowTime(70)).toBe("1:10");
  });

  test("writes the length of the piece", () => {
    expect(formatShowTime(516)).toBe("8:36");
  });

  test("truncates rather than rounding up to a second that has not come", () => {
    expect(formatShowTime(59.9)).toBe("0:59");
  });

  test("reads a negative instant as the start", () => {
    expect(formatShowTime(-4)).toBe("0:00");
  });
});

describe("formatDurationSeconds", () => {
  test("keeps the tenth that distinguishes two takes", () => {
    expect(formatDurationSeconds(72.37)).toBe("72.4 s");
  });
});

describe("formatHeadroomSeconds", () => {
  test("marks silence before the next cue as a surplus", () => {
    expect(formatHeadroomSeconds(4.63)).toBe("+4.6 s");
  });

  test("marks a recording that outlasts its slot as a shortfall", () => {
    expect(formatHeadroomSeconds(-3.1)).toBe("−3.1 s");
  });
});
