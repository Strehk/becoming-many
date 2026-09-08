import {
  type M5SerialCommand,
  type M5SerialResponse,
  parseM5SerialResponse,
  parseM5State,
} from "../protocol";

export interface SerialSetupChannel {
  readonly isOpen: boolean;
  /** Resolves after bytes are written; only a device response confirms application. */
  send(command: M5SerialCommand): Promise<void>;
  /** Cancels the held reader, awaits stream release, then closes the port. */
  close(): Promise<void>;
}

export interface SerialSetupEvents {
  readonly onMessage: (response: M5SerialResponse) => void;
  /** Fixed diagnostic text only: raw boot output and unknown JSON may contain secrets. */
  readonly onNotice: (notice: string) => void;
  readonly onError: (error: Error) => void;
  readonly onClosed: () => void;
}

const BAUD_RATE = 115200;
const LINE_LENGTH_LIMIT = 4096;

export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

/** Prompt from a user gesture. This adapter owns every acquired stream and the port. */
export async function openSerialSetup(
  events: SerialSetupEvents,
): Promise<SerialSetupChannel> {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: BAUD_RATE });
  if (!port.readable || !port.writable) {
    await port.close();
    throw new Error("Serial port has no readable or writable stream");
  }

  const reader = port.readable.getReader();
  let open = true;
  let activeWrite: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let password = "";
  const reading = readLines(
    reader,
    events,
    () => open,
    () => password,
  );

  // Read failure or unplug must release the port even without another UI action.
  void reading.then(() => close()).catch(events.onError);

  return {
    get isOpen() {
      return open;
    },
    async send(command) {
      if (!open) throw new Error("Serial console is disconnected");
      if (activeWrite)
        throw new Error("Another serial command is still being sent");
      const writer = port.writable?.getWriter();
      if (!writer) throw new Error("Serial port is not writable");
      if (command.type === "configure") password = command.password;
      activeWrite = writeCommand(writer, command);
      try {
        await activeWrite;
      } finally {
        activeWrite = undefined;
      }
    },
    close,
  };

  function close(): Promise<void> {
    if (closing) return closing;
    open = false;
    closing = closePort();
    return closing;
  }

  async function closePort(): Promise<void> {
    try {
      // Calling cancel on the locked stream itself would reject. Cancel its owner.
      await reader.cancel();
    } catch {
      // The reader has already ended/released, or the device was unplugged.
    }
    await reading;
    // send() reports write failure to its caller; cleanup still releases the port.
    await activeWrite?.catch(() => {});
    try {
      await port.close();
    } catch {
      throw new Error("Serial port could not be closed");
    } finally {
      password = "";
      events.onClosed();
    }
  }
}

async function writeCommand(
  writer: WritableStreamDefaultWriter<Uint8Array>,
  command: M5SerialCommand,
): Promise<void> {
  try {
    await writer.write(
      new TextEncoder().encode(`${JSON.stringify(command)}\n`),
    );
  } catch {
    // Transport errors can embed the written payload, including its password.
    throw new Error("Serial command could not be written");
  } finally {
    writer.releaseLock();
  }
}

async function readLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  events: SerialSetupEvents,
  isOpen: () => boolean,
  readPassword: () => string,
): Promise<void> {
  const decoder = new TextDecoder();
  let line = "";
  let discarding = false;
  try {
    while (isOpen()) {
      const chunk = await reader.read();
      if (chunk.done) break;
      for (const character of decoder.decode(chunk.value, { stream: true })) {
        if (!isOpen()) return;
        if (character === "\n") {
          if (!discarding) emitLine(line.trim(), events, readPassword());
          line = "";
          discarding = false;
        } else if (!discarding) {
          if (line.length < LINE_LENGTH_LIMIT) line += character;
          else {
            line = "";
            discarding = true;
            events.onNotice("Oversized device line discarded");
          }
        }
      }
    }
  } catch {
    if (isOpen()) events.onError(new Error("Serial device read failed"));
  } finally {
    reader.releaseLock();
  }
}

function emitLine(
  line: string,
  events: SerialSetupEvents,
  password: string,
): void {
  if (!line) return;
  const response = parseM5SerialResponse(line, password);
  if (response) events.onMessage(response);
  else if (!parseM5State(line))
    events.onNotice("Unrecognized device output omitted");
}
