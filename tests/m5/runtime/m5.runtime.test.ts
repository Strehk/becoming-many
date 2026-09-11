import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  spyOn,
} from "bun:test";
import type { M5Runtime } from "../../../src/m5/m5-contract";
import { M5_FIRMWARE_VERSION, type M5State } from "../../../src/m5/protocol";
import { createM5Runtime } from "../../../src/m5/runtime/m5.runtime";
import { M5_SETTINGS } from "../../../src/m5/runtime/m5-settings";

const BASE_STATE: M5State = {
  deviceId: "bm-station-a-m5",
  firmwareVersion: M5_FIRMWARE_VERSION,
  seq: 1,
  uptimeMs: 1_000,
  pitch: 0,
  roll: 0,
  quality: 1,
  buttonPressed: false,
  buttonPressCount: 0,
  buttonReleaseCount: 0,
  isCalibrated: true,
  rssi: -50,
};
const NEUTRAL_INPUT = { forwardTilt: 0, rightTilt: 0 };

let now: number;
let poll: () => void;
let runtime: M5Runtime;
let fetchMock: Mock<
  (...parameters: Parameters<typeof fetch>) => ReturnType<typeof fetch>
>;
let clockMock: ReturnType<typeof spyOn<typeof Date, "now">>;
let intervalMock: ReturnType<typeof spyOn<typeof globalThis, "setInterval">>;
let clearIntervalMock: ReturnType<
  typeof spyOn<typeof globalThis, "clearInterval">
>;

beforeEach(() => {
  now = 1_000;
  fetchMock = spyOn(globalThis, "fetch");
  clockMock = spyOn(Date, "now").mockImplementation(() => now);
  intervalMock = spyOn(globalThis, "setInterval").mockImplementation(((
    callback: () => void,
  ) => {
    poll = callback;
    return 1;
  }) as typeof setInterval);
  clearIntervalMock = spyOn(globalThis, "clearInterval").mockImplementation(
    () => {},
  );
  runtime = createM5Runtime();
});

afterEach(() => {
  runtime.unload();
  fetchMock.mockRestore();
  clockMock.mockRestore();
  intervalMock.mockRestore();
  clearIntervalMock.mockRestore();
});

/** Flush the asynchronous fetch and body reads without advancing the sample clock. */
async function flushResponse(): Promise<void> {
  await Bun.sleep(0);
}

function reply(overrides: Partial<M5State> = {}): Response {
  return Response.json({ ...BASE_STATE, ...overrides });
}

describe("M5 direct flight source", () => {
  it("passes axes through immediately and preserves the established roll polarity", async () => {
    fetchMock.mockResolvedValue(reply({ pitch: 0.8, roll: -0.4 }));
    runtime.setHost("controller.local");
    await flushResponse();
    const input = runtime.readInput(0);
    expect(input).toEqual({ forwardTilt: 0.8, rightTilt: 0.4 });
    runtime.readObservation();
    expect(runtime.readInput(0)).toBe(input);
    fetchMock.mockResolvedValue(reply({ pitch: -0.7, roll: 0.3 }));
    poll();
    await flushResponse();
    expect(runtime.readInput(0)).toEqual({
      forwardTilt: -0.7,
      rightTilt: -0.3,
    });
    fetchMock.mockResolvedValue(reply());
    poll();
    await flushResponse();
    expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
  });

  it("retains a small held deflection across more than five seconds", async () => {
    fetchMock.mockImplementation(async () =>
      reply({ pitch: 0.02, roll: 0.03 }),
    );
    runtime.setHost("controller.local");
    await flushResponse();
    for (let frame = 0; frame < 40; frame += 1) {
      now += M5_SETTINGS.pollIntervalMilliseconds;
      poll();
      await flushResponse();
      expect(runtime.readInput(0)).toEqual({
        forwardTilt: 0.02,
        rightTilt: -0.03,
      });
    }
    expect(now).toBeGreaterThan(6_000);
  });

  it("keeps firmware, identity, calibration, quality and sequence diagnostic", async () => {
    const sample = {
      ...BASE_STATE,
      firmwareVersion: "0.3.2-bm-http",
      deviceId: "another-device",
      isCalibrated: false,
      quality: 0,
      pitch: 0.8,
    };
    fetchMock.mockImplementation(async () => Response.json(sample));
    runtime.setHost("controller.local");
    await flushResponse();
    now += 700;
    poll();
    await flushResponse();
    now += 700;
    expect(runtime.readInput(0).forwardTilt).toBe(0.8);
    expect(runtime.readObservation()).toMatchObject({
      status: "live",
      sample,
      receivedState: sample,
    });
  });

  it("expires steering while retaining diagnostics and reconnects without easing", async () => {
    fetchMock.mockResolvedValue(reply({ pitch: 0.7 }));
    runtime.setHost("rig.local");
    await flushResponse();
    now += M5_SETTINGS.staleAfterMilliseconds;
    expect(runtime.readInput(0).forwardTilt).toBe(0.7);
    now += 1;
    expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
    expect(runtime.readObservation()).toMatchObject({
      status: "connecting",
      sample: undefined,
      receivedState: { pitch: 0.7 },
    });
    fetchMock.mockResolvedValue(reply({ pitch: -0.9 }));
    poll();
    await flushResponse();
    expect(runtime.readInput(0).forwardTilt).toBe(-0.9);
    expect(runtime.readObservation().status).toBe("live");
  });

  it("resets host history and discards a late response from the previous host", async () => {
    const lateResponse = Promise.withResolvers<Response>();
    fetchMock
      .mockResolvedValueOnce(reply({ pitch: 0.4 }))
      .mockReturnValueOnce(lateResponse.promise)
      .mockResolvedValueOnce(reply({ pitch: -0.4 }));
    runtime.setHost("first.local");
    await flushResponse();
    expect(runtime.readInput(0).forwardTilt).toBe(0.4);
    runtime.setHost("hanging.local");
    expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
    expect(runtime.readObservation().receivedState).toBeUndefined();
    runtime.setHost("next.local");
    expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    await flushResponse();
    expect(runtime.readInput(0).forwardTilt).toBe(-0.4);
    lateResponse.resolve(reply({ pitch: 0.8 }));
    await flushResponse();
    expect(runtime.readInput(0).forwardTilt).toBe(-0.4);
    expect(runtime.readObservation().sample?.pitch).toBe(-0.4);
  });

  it("neutralizes an empty host and permanently cancels pending work on unload", async () => {
    const response = Promise.withResolvers<Response>();
    fetchMock.mockReturnValue(response.promise);
    expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
    expect(runtime.readObservation()).toEqual({
      host: "",
      status: "off",
      sample: undefined,
    });
    runtime.setHost(" https://rig.local:443/ ");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://rig.local:443/state");
    expect(runtime.readObservation().status).toBe("connecting");
    runtime.setHost("");
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
    runtime.unload();
    runtime.unload();
    response.resolve(reply({ pitch: 0.4 }));
    await flushResponse();
    runtime.setHost("revive.local");
    expect(runtime.readObservation()).toEqual({
      host: "",
      status: "off",
      sample: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["malformed JSON", () => Promise.resolve(new Response("broken"))],
    ["invalid sample", () => Promise.resolve(reply({ pitch: Number.NaN }))],
    [
      "HTTP failure",
      () => Promise.resolve(new Response("unavailable", { status: 503 })),
    ],
    ["network failure", () => Promise.reject(new Error("offline"))],
  ] as const)(
    "lets the last valid sample expire after %s",
    async (_reason, respond) => {
      fetchMock
        .mockResolvedValueOnce(reply({ pitch: 0.6 }))
        .mockImplementation(respond);
      runtime.setHost("rig.local");
      await flushResponse();
      now += 500;
      poll();
      await flushResponse();
      expect(runtime.readInput(0).forwardTilt).toBe(0.6);
      now += 501;
      expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
      expect(runtime.readObservation().status).toBe("connecting");
    },
  );

  it("prevents overlapping requests and stops its timer on unload", async () => {
    const response = Promise.withResolvers<Response>();
    fetchMock.mockReturnValue(response.promise);
    runtime.setHost("rig.local");
    poll();
    poll();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    runtime.unload();
    expect(clearIntervalMock).toHaveBeenCalledTimes(1);
    poll();
    response.resolve(reply());
    await flushResponse();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(runtime.readObservation().status).toBe("off");
  });

  it("aborts timed-out requests and rejects their late bodies", async () => {
    const timeout = new AbortController();
    const timeoutMock = spyOn(AbortSignal, "timeout").mockReturnValue(
      timeout.signal,
    );
    const response = Promise.withResolvers<Response>();
    fetchMock
      .mockReturnValueOnce(response.promise)
      .mockResolvedValueOnce(reply({ pitch: 0.4 }));
    try {
      runtime.setHost("rig.local");
      expect(timeoutMock).toHaveBeenCalledWith(
        M5_SETTINGS.staleAfterMilliseconds,
      );
      timeout.abort();
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      response.resolve(reply({ pitch: 0.9 }));
      await flushResponse();
      expect(runtime.readInput(0)).toEqual(NEUTRAL_INPUT);
      timeoutMock.mockRestore();
      poll();
      await flushResponse();
      expect(runtime.readInput(0).forwardTilt).toBe(0.4);
    } finally {
      timeoutMock.mockRestore();
    }
  });
});
