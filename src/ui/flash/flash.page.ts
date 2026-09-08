import type { M5SerialCommand } from "../../m5/protocol";
import { requireElement } from "../shared/dom";

const STORAGE_KEY = "bm-m5-flash-setup";
const LOG_LINE_LIMIT = 300;
const LOG_LINE_LENGTH_LIMIT = 2_000;
const CONSOLE_COMMANDS = [
  "getConfig",
  "diagnose",
  "calibrate",
  "clearCalibration",
  "reboot",
  "factoryReset",
] as const satisfies readonly M5SerialCommand["type"][];

type Setup = Pick<
  Extract<M5SerialCommand, { type: "configure" }>,
  "ssid" | "password" | "deviceId"
>;
type StoredSetup = Pick<Setup, "ssid" | "deviceId">;
type ConnectionState = "disconnected" | "connecting" | "connected" | "closing";

interface FlashCommands {
  readonly toggleConnection: () => void;
  readonly configure: (setup: Setup) => void;
  readonly send: (
    command: Exclude<M5SerialCommand, { type: "configure" }>,
  ) => void;
}

/** The declared setup form and bounded log; connection lifetime belongs to Entry. */
export interface FlashPage {
  setConnectionState(state: ConnectionState): void;
  setSending(sending: boolean): void;
  appendLog(line: string): void;
  rememberSetup(setup: StoredSetup): void;
  unload(): void;
}

/** Bind authored HTML without owning the serial port or persisting passwords. */
export function mountFlashPage(
  container: HTMLElement,
  commands: FlashCommands,
  firmwareVersion: string,
  serialSupported: boolean,
): FlashPage {
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const form = requireElement(container, ".flash__form", HTMLFormElement);
  const ssid = requireElement(form, "[name='ssid']", HTMLInputElement);
  const password = requireElement(form, "[name='password']", HTMLInputElement);
  const deviceId = requireElement(form, "[name='deviceId']", HTMLInputElement);
  const connectButton = requireElement(
    form,
    "[data-action='connect']",
    HTMLButtonElement,
  );
  const sendButton = requireElement(
    form,
    "button[type='submit']",
    HTMLButtonElement,
  );
  const log = requireElement(container, ".flash__log", HTMLPreElement);
  const commandButtons = CONSOLE_COMMANDS.map((type) => ({
    type,
    button: requireElement(
      container,
      `[data-command='${type}']`,
      HTMLButtonElement,
    ),
  }));
  const version = requireElement(
    container,
    "[data-role='firmware-version']",
    HTMLElement,
  );
  const unsupported = requireElement(
    container,
    ".flash__unsupported",
    HTMLElement,
  );
  version.textContent = firmwareVersion;
  unsupported.hidden = serialSupported;

  const stored = loadStoredSetup();
  if (stored) {
    ssid.value = stored.ssid;
    deviceId.value = stored.deviceId;
  }
  let connection: ConnectionState = "disconnected";
  let sending = false;
  const lines: string[] = [];
  updateControls();

  for (const { type, button } of commandButtons) {
    button.addEventListener("click", () => commands.send({ type }), options);
  }
  connectButton.addEventListener("click", commands.toggleConnection, options);
  form.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      if (connection !== "connected" || sending) return;
      commands.configure({
        ssid: ssid.value.trim(),
        password: password.value,
        deviceId: deviceId.value.trim(),
      });
    },
    options,
  );

  container.inert = false;
  return {
    setConnectionState(state) {
      connection = state;
      updateControls();
    },
    setSending(nextSending) {
      sending = nextSending;
      updateControls();
    },
    appendLog(line) {
      lines.push(line.slice(0, LOG_LINE_LENGTH_LIMIT));
      if (lines.length > LOG_LINE_LIMIT) lines.shift();
      log.textContent = lines.join("\n");
      log.scrollTop = log.scrollHeight;
    },
    rememberSetup: saveStoredSetup,
    unload() {
      container.inert = true;
      listeners.abort();
      password.value = "";
      lines.length = 0;
    },
  };

  function updateControls(): void {
    const labels = {
      disconnected: "Connect console",
      connecting: "Connecting…",
      connected: "Disconnect console",
      closing: "Disconnecting…",
    };
    connectButton.textContent = labels[connection];
    connectButton.disabled =
      !serialSupported ||
      connection === "connecting" ||
      connection === "closing";
    sendButton.disabled = connection !== "connected" || sending;
    for (const { button } of commandButtons)
      button.disabled = sendButton.disabled;
  }
}

function loadStoredSetup(): StoredSetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    // Remove legacy secrets before parsing, including invalid stored records.
    localStorage.removeItem(STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const setup = {
      ssid:
        "ssid" in parsed && typeof parsed.ssid === "string" ? parsed.ssid : "",
      deviceId:
        "deviceId" in parsed && typeof parsed.deviceId === "string"
          ? parsed.deviceId
          : "",
    };
    saveStoredSetup(setup);
    return setup;
  } catch {
    return null;
  }
}

function saveStoredSetup({ ssid, deviceId }: StoredSetup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ssid, deviceId }));
  } catch {
    // Storage may be unavailable; inputs remain usable for this visit.
  }
}
