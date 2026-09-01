/**
 * Purpose: Verify the station wire contract survives a round trip and rejects junk.
 * Context: Both pages act on messages arriving from a socket they do not control.
 * Responsibility: Cover every message kind and the ways a malformed one is refused.
 * Boundary: Reconnection and broker relay behavior are verified by running them.
 */

import { describe, expect, test } from "bun:test";
import {
  parseStationMessage,
  type StationMessage,
  serializeStationMessage,
} from "../../src/station/station-protocol";

const STATUS: StationMessage = {
  kind: "status",
  showTimeSeconds: 192.5,
  isPlaying: true,
  timeScale: 1,
  language: "de",
  levelName: "test",
  audioState: "running",
  framesPerSecond: 88.4,
  p95Milliseconds: 12.7,
};

const MESSAGES: readonly StationMessage[] = [
  { kind: "play" },
  { kind: "pause" },
  { kind: "resetShow" },
  { kind: "resetFlight" },
  { kind: "reloadShow" },
  { kind: "seekTo", showTimeSeconds: 0 },
  { kind: "seekTo", showTimeSeconds: 341.25 },
  { kind: "seekBy", offsetSeconds: -30 },
  { kind: "setTimeScale", timeScale: 0.5 },
  { kind: "setLanguage", language: "en" },
  { kind: "setLanguage", language: "de" },
  STATUS,
  { kind: "presence", role: "show", isConnected: false },
  { kind: "presence", role: "conductor", isConnected: true },
];

describe("station message round trip", () => {
  for (const message of MESSAGES) {
    test(`carries ${message.kind}`, () => {
      expect(parseStationMessage(serializeStationMessage(message))).toEqual(
        message,
      );
    });
  }

  test("drops fields the contract does not name", () => {
    const raw = JSON.stringify({ kind: "play", showTimeSeconds: 12 });
    expect(parseStationMessage(raw)).toEqual({ kind: "play" });
  });
});

describe("parseStationMessage refuses", () => {
  test("text that is not JSON", () => {
    expect(parseStationMessage("")).toBeUndefined();
    expect(parseStationMessage("{")).toBeUndefined();
    expect(parseStationMessage("play")).toBeUndefined();
  });

  test("JSON that is not a message object", () => {
    expect(parseStationMessage("null")).toBeUndefined();
    expect(parseStationMessage("7")).toBeUndefined();
    expect(parseStationMessage('"play"')).toBeUndefined();
    expect(parseStationMessage('[{"kind":"play"}]')).toBeUndefined();
  });

  test("an unknown or missing kind", () => {
    expect(parseStationMessage("{}")).toBeUndefined();
    expect(parseStationMessage('{"kind":"stop"}')).toBeUndefined();
    expect(parseStationMessage('{"kind":42}')).toBeUndefined();
  });

  test("a seek without a finite target", () => {
    expect(parseStationMessage('{"kind":"seekTo"}')).toBeUndefined();
    expect(
      parseStationMessage('{"kind":"seekTo","showTimeSeconds":"3"}'),
    ).toBeUndefined();
    expect(
      parseStationMessage('{"kind":"seekBy","offsetSeconds":null}'),
    ).toBeUndefined();
  });

  test("a time scale the clock would throw on", () => {
    expect(
      parseStationMessage('{"kind":"setTimeScale","timeScale":0}'),
    ).toBeUndefined();
    expect(
      parseStationMessage('{"kind":"setTimeScale","timeScale":-1}'),
    ).toBeUndefined();
  });

  test("a language outside the shipped pair", () => {
    expect(
      parseStationMessage('{"kind":"setLanguage","language":"fr"}'),
    ).toBeUndefined();
  });

  test("a status missing a required field", () => {
    const optional = new Set(["framesPerSecond", "p95Milliseconds"]);
    for (const field of Object.keys(STATUS)) {
      if (field === "kind" || optional.has(field)) continue;

      const { [field]: _removed, ...partial } = STATUS as unknown as Record<
        string,
        unknown
      >;
      expect(parseStationMessage(JSON.stringify(partial))).toBeUndefined();
    }
  });

  test("a status whose metrics have not been measured yet", () => {
    const { framesPerSecond, p95Milliseconds, ...pending } = STATUS as Extract<
      StationMessage,
      { kind: "status" }
    >;
    const parsed = parseStationMessage(JSON.stringify(pending));

    expect(parsed).toBeDefined();
    expect(parsed).toMatchObject({ kind: "status", levelName: "test" });
  });

  test("a status carrying an unusable number", () => {
    const raw = JSON.stringify({ ...STATUS, showTimeSeconds: "192.5" });
    expect(parseStationMessage(raw)).toBeUndefined();
  });

  test("a presence without a known role", () => {
    expect(
      parseStationMessage('{"kind":"presence","role":"m5","isConnected":true}'),
    ).toBeUndefined();
    expect(
      parseStationMessage('{"kind":"presence","role":"show"}'),
    ).toBeUndefined();
  });
});
