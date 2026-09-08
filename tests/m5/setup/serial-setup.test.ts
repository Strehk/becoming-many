import { afterEach, describe, expect, it, mock } from "bun:test";
import type { M5SerialResponse } from "../../../src/m5/protocol";
import { openSerialSetup } from "../../../src/m5/setup/serial-setup";

const originalNavigator = Object.getOwnPropertyDescriptor(
  globalThis,
  "navigator",
);

afterEach(() => {
  if (originalNavigator)
    Object.defineProperty(globalThis, "navigator", originalNavigator);
  else Reflect.deleteProperty(globalThis, "navigator");
});

function createDevice(
  options: {
    write?: (chunk: Uint8Array) => Promise<void>;
    closeError?: boolean;
  } = {},
) {
  let incoming!: ReadableStreamDefaultController<Uint8Array>;
  const writes: string[] = [];
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      incoming = controller;
    },
  });
  const writable = new WritableStream<Uint8Array>({
    async write(chunk) {
      writes.push(new TextDecoder().decode(chunk));
      await options.write?.(chunk);
    },
  });
  const port = {
    readable,
    writable,
    open: mock(async () => {}),
    close: mock(async () => {
      expect(readable.locked).toBe(false);
      expect(writable.locked).toBe(false);
      if (options.closeError) throw new Error("native close failed");
    }),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { serial: { requestPort: async () => port } },
  });
  const messages: M5SerialResponse[] = [];
  const notices: string[] = [];
  const errors: Error[] = [];
  const events = {
    onMessage: (message: M5SerialResponse) => {
      messages.push(message);
    },
    onNotice: (notice: string) => {
      notices.push(notice);
    },
    onError: (error: Error) => {
      errors.push(error);
    },
    onClosed: mock(() => {}),
  };
  return {
    port,
    writes,
    messages,
    notices,
    errors,
    events,
    emit(text: string) {
      incoming.enqueue(new TextEncoder().encode(text));
    },
    unplug() {
      incoming.error(new Error("USB removed"));
    },
  };
}

const RESULT = {
  type: "configureResult",
  ok: true,
  message: "Configuration saved",
  firmwareVersion: "test",
  deviceId: "station-m5",
} satisfies M5SerialResponse;

async function flushReads(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("serial setup lifetime", () => {
  it("cancels a pending read and closes only after releasing the streams", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    expect(device.port.open).toHaveBeenCalledWith({ baudRate: 115200 });
    expect(device.port.readable.locked).toBe(true);
    await Promise.all([channel.close(), channel.close()]);
    expect(channel.isOpen).toBe(false);
    expect(device.port.close).toHaveBeenCalledTimes(1);
    expect(device.events.onClosed).toHaveBeenCalledTimes(1);
    await expect(channel.send({ type: "diagnose" })).rejects.toThrow(
      "disconnected",
    );
  });

  it("cleans up after unplug and opens a fresh independent connection", async () => {
    const first = createDevice();
    const channel = await openSerialSetup(first.events);
    first.unplug();
    await flushReads();
    expect(channel.isOpen).toBe(false);
    expect(first.errors.map((error) => error.message)).toEqual([
      "Serial device read failed",
    ]);
    expect(first.port.close).toHaveBeenCalledTimes(1);
    const second = createDevice();
    const reconnected = await openSerialSetup(second.events);
    await reconnected.send({ type: "diagnose" });
    expect(second.writes).toEqual(['{"type":"diagnose"}\n']);
    await reconnected.close();
  });

  it("waits for an active write before closing the port", async () => {
    let finishWrite!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const device = createDevice({ write: () => pending });
    const channel = await openSerialSetup(device.events);
    const sent = channel.send({ type: "reboot" });
    const closed = channel.close();
    await flushReads();
    expect(device.port.close).not.toHaveBeenCalled();
    finishWrite();
    await Promise.all([sent, closed]);
    expect(device.port.close).toHaveBeenCalledTimes(1);
  });

  it("rejects concurrent writes without retaining an unbounded command queue", async () => {
    let finishWrite!: () => void;
    const pending = new Promise<void>((resolve) => {
      finishWrite = resolve;
    });
    const device = createDevice({ write: () => pending });
    const channel = await openSerialSetup(device.events);
    const sent = channel.send({ type: "diagnose" });
    await expect(channel.send({ type: "reboot" })).rejects.toThrow(
      "still being sent",
    );
    finishWrite();
    await sent;
    await channel.close();
  });

  it("reports write failure without exposing the command password and releases the writer", async () => {
    const device = createDevice({
      write: async () => {
        throw new Error("payload: private-password");
      },
    });
    const channel = await openSerialSetup(device.events);
    await expect(
      channel.send({
        type: "configure",
        ssid: "station",
        deviceId: "m5",
        password: "private-password",
      }),
    ).rejects.toThrow("Serial command could not be written");
    expect(device.port.writable.locked).toBe(false);
    await channel.close();
  });

  it("rejects cleanup failure and still announces the ended connection once", async () => {
    const device = createDevice({ closeError: true });
    const channel = await openSerialSetup(device.events);
    await expect(channel.close()).rejects.toThrow("could not be closed");
    expect(device.events.onClosed).toHaveBeenCalledTimes(1);
    expect(channel.isOpen).toBe(false);
  });
});

describe("serial setup messages", () => {
  it("writing bytes does not fabricate a device confirmation", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    await channel.send({
      type: "configure",
      ssid: "station",
      deviceId: "m5",
      password: "private-password",
    });
    expect(device.messages).toEqual([]);
    expect(JSON.parse(device.writes[0] ?? "").password).toBe(
      "private-password",
    );
    device.emit(`${JSON.stringify(RESULT)}\n`);
    await flushReads();
    expect(device.messages).toEqual([RESULT]);
    await channel.close();
  });

  it("frames split and batched replies, including CRLF", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    const text = JSON.stringify(RESULT);
    device.emit(text.slice(0, 20));
    device.emit(`${text.slice(20)}\r\n\n${text}\n`);
    await flushReads();
    expect(device.messages).toEqual([RESULT, RESULT]);
    await channel.close();
  });

  it("omits unknown JSON and boot noise instead of leaking credentials", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    device.emit(
      'password=private-password\n{"type":"configure","password":"private-password"}\n',
    );
    await flushReads();
    expect(device.messages).toEqual([]);
    expect(device.notices).toHaveLength(2);
    expect(JSON.stringify(device.notices)).not.toContain("private-password");
    await channel.close();
  });

  it("redacts password echoes even inside valid typed response fields", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    const password = 'private"password\\secret';
    await channel.send({
      type: "configure",
      ssid: "station",
      deviceId: "m5",
      password,
    });
    device.emit(
      `${JSON.stringify({ ...RESULT, deviceId: password, message: `Rejected ${password}`, password })}\n`,
    );
    await flushReads();
    expect(device.messages).toEqual([
      { ...RESULT, deviceId: "[redacted]", message: "Rejected [redacted]" },
    ]);
    await channel.close();
  });

  it("discards the entire oversized line and recovers at the next newline", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    device.emit("x".repeat(5000));
    device.emit(`${JSON.stringify(RESULT)}\n${JSON.stringify(RESULT)}\n`);
    await flushReads();
    expect(device.notices).toEqual(["Oversized device line discarded"]);
    expect(device.messages).toEqual([RESULT]);
    await channel.close();
  });

  it("does not emit buffered device data after cleanup begins", async () => {
    const device = createDevice();
    const channel = await openSerialSetup(device.events);
    device.emit(`${JSON.stringify(RESULT)}\n`);
    await channel.close();
    expect(device.messages).toEqual([]);
  });
});
