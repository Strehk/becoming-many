import { describe, expect, it, spyOn } from "bun:test";
import { createNeutralControl } from "../../../src/m5/control-frame";
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

function state(overrides: Partial<M5State> = {}): M5State {
  return { ...BASE_STATE, ...overrides };
}

describe("M5 runtime", () => {
  it("retains a rejected reply for kiosk diagnostics without admitting its controls", async () => {
    const reply = state({ firmwareVersion: "0.3.2-bm-http", pitch: 0.8 });
    const fetchMock = spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(reply),
    );
    const runtime = createM5Runtime(BASE_STATE.deviceId);
    try {
      runtime.setHost("controller.local");
      await Bun.sleep(0);
      expect(runtime.readObservation().status).toBe("incompatible-firmware");
      expect(runtime.readObservation().receivedState).toEqual(reply);
      expect(runtime.readObservation().sample).toBeUndefined();
      expect(runtime.consumeFrame()?.quality).toBe(0);
      runtime.setHost("");
      expect(runtime.readObservation().receivedState).toBeUndefined();
    } finally {
      runtime.unload();
      fetchMock.mockRestore();
    }
  });

  it("resets host history and ignores a late response without blocking the next host", async () => {
    const lateResponse = Promise.withResolvers<Response>();
    const fetchMock = spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(state({ pitch: 0.4 })))
      .mockReturnValueOnce(lateResponse.promise)
      .mockResolvedValueOnce(
        Response.json(
          state({ pitch: -0.4, buttonPressCount: 12, buttonReleaseCount: 12 }),
        ),
      );
    const runtime = createM5Runtime(BASE_STATE.deviceId);
    try {
      runtime.setHost("first.local");
      await Bun.sleep(0);
      expect(runtime.consumeFrame()?.pitch).toBeCloseTo(0.25);
      runtime.setHost("hanging.local");
      expect(runtime.consumeFrame()?.quality).toBe(0);
      expect(runtime.readObservation().sample).toBeUndefined();
      runtime.setHost("next.local");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
      await Bun.sleep(0);
      const frame = runtime.consumeFrame();
      expect(frame?.pitch).toBeCloseTo(-0.25);
      expect(frame?.buttonDown).toBe(false);
      expect(frame?.buttonUp).toBe(false);
      lateResponse.resolve(
        Response.json(state({ pitch: 0.8, buttonPressCount: 13 })),
      );
      await Bun.sleep(0);
      expect(runtime.readObservation().sample?.pitch).toBe(-0.4);
      runtime.setHost("");
      expect(runtime.consumeFrame()).toBeUndefined();
      expect(runtime.readObservation().status).toBe("off");
      runtime.unload();
      runtime.setHost("after-end.local");
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(runtime.consumeFrame()).toBeUndefined();
    } finally {
      runtime.unload();
      fetchMock.mockRestore();
    }
  });

  it("distinguishes an absent host from neutral configured input", async () => {
    const response = Promise.withResolvers<Response>();
    const fetchMock = spyOn(globalThis, "fetch").mockReturnValue(
      response.promise,
    );
    const runtime = createM5Runtime(BASE_STATE.deviceId);
    try {
      expect(runtime.consumeFrame()).toBeUndefined();
      expect(runtime.readObservation()).toEqual({
        host: "",
        status: "off",
        sample: undefined,
        control: undefined,
      });
      runtime.setHost(" https://rig.local:443/ ");
      expect(fetchMock.mock.calls[0]?.[0]).toBe("https://rig.local:443/state");
      expect(runtime.readObservation()).toEqual({
        host: "https://rig.local:443/",
        status: "connecting",
        sample: undefined,
        control: { pitch: 0, roll: 0, quality: 0 },
      });
      expect(runtime.consumeFrame()).toEqual(createNeutralControl());
      runtime.unload();
      runtime.unload();
      expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      response.resolve(Response.json(state({ pitch: 0.4 })));
      await Bun.sleep(0);
      runtime.setHost("revive.local");
      expect(runtime.readObservation().status).toBe("off");
      expect(runtime.consumeFrame()).toBeUndefined();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      runtime.unload();
      fetchMock.mockRestore();
    }
  });

  it.each([
    ["malformed JSON", () => Promise.resolve(new Response("broken"))],
    [
      "invalid sample",
      () => Promise.resolve(Response.json(state({ pitch: Number.NaN }))),
    ],
    [
      "HTTP failure",
      () => Promise.resolve(new Response("unavailable", { status: 503 })),
    ],
    ["network failure", () => Promise.reject(new Error("offline"))],
  ] as const)(
    "keeps %s neutral at the network boundary",
    async (_reason, respond) => {
      const fetchMock = spyOn(globalThis, "fetch").mockReturnValue(respond());
      const runtime = createM5Runtime(BASE_STATE.deviceId);
      try {
        runtime.setHost("rig.local");
        await Bun.sleep(0);
        expect(runtime.readObservation().status).toBe("connecting");
        expect(runtime.readObservation().sample).toBeUndefined();
        expect(runtime.consumeFrame()).toEqual(createNeutralControl());
      } finally {
        runtime.unload();
        fetchMock.mockRestore();
      }
    },
  );

  it("runs only one request at a time and stops its poll interval on unload", async () => {
    const response = Promise.withResolvers<Response>();
    const fetchMock = spyOn(globalThis, "fetch").mockReturnValue(
      response.promise,
    );
    const runtime = createM5Runtime(BASE_STATE.deviceId);
    try {
      runtime.setHost("rig.local");
      await Bun.sleep(M5_SETTINGS.pollIntervalMilliseconds * 2 + 10);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      response.resolve(Response.json(state()));
      await Bun.sleep(0);
      expect(runtime.readObservation().status).toBe("live");
      runtime.unload();
      await Bun.sleep(M5_SETTINGS.pollIntervalMilliseconds + 10);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(runtime.readObservation().status).toBe("off");
    } finally {
      runtime.unload();
      fetchMock.mockRestore();
    }
  });
});
