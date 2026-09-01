/**
 * Purpose: Verify the command line a benchmark run is started from.
 * Context: A mistyped flag must fail immediately, not after minutes of work.
 * Responsibility: Cover level selection, skipping, defaults, and rejections.
 * Boundary: Browser driving and report summarizing stay outside this test.
 */

import { describe, expect, test } from "bun:test";
import { LEVEL_NAMES } from "../../src/levels/level-catalog";
import { describeUsage, readOptions, wantsHelp } from "./benchmark-options";

describe("readOptions", () => {
  test("measures every level when none is named", () => {
    expect(readOptions([]).levelNames).toEqual(LEVEL_NAMES);
  });

  test("measures only the named levels", () => {
    const options = readOptions(["--level", "magnetic", "--level", "echo"]);

    expect(options.levelNames).toEqual(["magnetic", "echo"]);
  });

  test("leaves the skipped levels out of a full run", () => {
    const options = readOptions([
      "--skip-level",
      "test",
      "--skip-level",
      "design-test",
    ]);

    expect(options.levelNames).not.toContain("test");
    expect(options.levelNames).not.toContain("design-test");
    expect(options.levelNames).toContain("connections");
  });

  test("skipping wins over naming", () => {
    const options = readOptions([
      "--level",
      "magnetic",
      "--level",
      "echo",
      "--skip-level",
      "echo",
    ]);

    expect(options.levelNames).toEqual(["magnetic"]);
  });

  test("refuses a run with nothing left to measure", () => {
    const argv = LEVEL_NAMES.flatMap((name) => ["--skip-level", name]);

    expect(() => readOptions(argv)).toThrow(/nothing to measure/);
  });

  test("rejects an unknown level, named or skipped", () => {
    expect(() => readOptions(["--level", "smell"])).toThrow(/Unknown level/);
    expect(() => readOptions(["--skip-level", "smell"])).toThrow(
      /Unknown level/,
    );
  });

  test("rejects an unknown profile", () => {
    expect(() => readOptions(["--profile", "coarse"])).toThrow(
      /Unknown profile/,
    );
  });

  test("resolves the remaining defaults", () => {
    const options = readOptions([]);

    expect(options.profileName).toBe("full");
    expect(options.outputDirectory).toBe("benchmark-results");
    expect(options.levelTimeoutMilliseconds).toBe(600_000);
    expect(options.baseUrl).toBeUndefined();
    expect(options.isHeaded).toBe(false);
    expect(options.shouldCheck).toBe(false);
    expect(options.shouldUpdate).toBe(false);
  });

  test("reads the value flags and the switches", () => {
    const options = readOptions([
      "--profile",
      "quick",
      "--out",
      "tmp/results",
      "--timeout",
      "30",
      "--base-url",
      "http://127.0.0.1:5173",
      "--headed",
      "--check",
      "--update",
    ]);

    expect(options.profileName).toBe("quick");
    expect(options.outputDirectory).toBe("tmp/results");
    expect(options.levelTimeoutMilliseconds).toBe(30_000);
    expect(options.baseUrl).toBe("http://127.0.0.1:5173");
    expect(options.isHeaded).toBe(true);
    expect(options.shouldCheck).toBe(true);
    expect(options.shouldUpdate).toBe(true);
  });
});

describe("wantsHelp", () => {
  test("recognizes both spellings and nothing else", () => {
    expect(wantsHelp(["--help"])).toBe(true);
    expect(wantsHelp(["--level", "echo", "-h"])).toBe(true);
    expect(wantsHelp(["--headed"])).toBe(false);
  });
});

describe("describeUsage", () => {
  test("names every flag and every level", () => {
    const usage = describeUsage();

    for (const flag of [
      "--profile",
      "--level",
      "--skip-level",
      "--headed",
      "--out",
      "--timeout",
      "--check",
      "--update",
      "--base-url",
      "--help",
    ]) {
      expect(usage).toContain(flag);
    }
    for (const name of LEVEL_NAMES) expect(usage).toContain(name);
  });
});
