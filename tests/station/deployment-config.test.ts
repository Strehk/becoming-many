/**
 * Purpose: Prove the deployment config parser degrades to "not configured".
 * Context: The same parser reads the server's env vars and the pages' /config
 *   response; both sides rely on absent meaning absent.
 * Responsibility: Cover accepted fields, rejected shapes, and trimming.
 * Boundary: Fetching /config is an untested IO shell by repo convention.
 */

import { describe, expect, test } from "bun:test";
import { parseDeploymentConfig } from "../../src/station/deployment-config";

describe("parseDeploymentConfig", () => {
  test("keeps every named field", () => {
    expect(
      parseDeploymentConfig({
        m5Host: "bm-station-a-m5.local",
        m5DeviceId: "bm-a-m5",
        stationName: "Station A",
      }),
    ).toEqual({
      m5Host: "bm-station-a-m5.local",
      m5DeviceId: "bm-a-m5",
      stationName: "Station A",
    });
  });

  test("an empty or whitespace value means not configured", () => {
    expect(parseDeploymentConfig({ m5Host: "", stationName: "   " })).toEqual(
      {},
    );
  });

  test("trims the values it keeps", () => {
    expect(parseDeploymentConfig({ m5Host: " 192.168.1.50 " })).toEqual({
      m5Host: "192.168.1.50",
    });
  });

  test("drops non-string values and unknown keys", () => {
    expect(
      parseDeploymentConfig({ m5Host: 7823, stationPassword: "nope" }),
    ).toEqual({});
  });

  test("a payload that is not an object reads as empty", () => {
    expect(parseDeploymentConfig(null)).toEqual({});
    expect(parseDeploymentConfig("Station A")).toEqual({});
    expect(parseDeploymentConfig(undefined)).toEqual({});
  });
});
