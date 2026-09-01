/**
 * Purpose: The operator/technician page that flashes and configures an M5 controller.
 * Context: Reached at /flash.html on localhost or another secure context; Web
 *   Serial needs Chrome or Edge.
 * Responsibility: Render the flashing button, the setup form, and the device
 *   log; remember the last-used station credentials in localStorage.
 * Boundary: Flashing is esp-web-tools' job; the serial channel is
 *   serial-setup.ts; the wire contract is src/m5/protocol.ts.
 */

// Side-effect import: registers the <esp-web-install-button> custom element.
import "esp-web-tools";

import { M5_FIRMWARE_VERSION, type M5SerialCommand } from "../m5/protocol";
import "./flash.css";
import {
  isWebSerialSupported,
  openSerialSetup,
  type SerialSetupChannel,
} from "./serial-setup";

const MANIFEST_URL = "/firmware/manifest.json";
// The last-used credentials are a technician convenience on the station
// machine, not authored configuration — hence localStorage, not a settings file.
const STORAGE_KEY = "bm-m5-flash-setup";
const LOG_LINE_LIMIT = 300;

interface StoredSetup {
  readonly ssid: string;
  readonly password: string;
  readonly deviceId: string;
}

export function startFlashPage(container: Element | null): void {
  if (!container) throw new Error("Flash page container is missing");
  container.innerHTML = renderPage();

  const log = createLog(query(container, ".flash__log"));
  const form = bindSetupForm(container);
  bindSerialConsole(container, form, log);

  if (!isWebSerialSupported()) {
    query(container, ".flash__unsupported").hidden = false;
  }
}

function renderPage(): string {
  return `
    <header class="flash__header">
      <h1>M5 Controller — Flash &amp; Setup</h1>
      <p class="flash__hint">
        Expected firmware <code>${M5_FIRMWARE_VERSION}</code> for the
        M5StickS3. Connect the device over USB-C.
      </p>
      <p class="flash__unsupported" hidden>
        This browser has no Web Serial — use Chrome or Edge.
      </p>
    </header>

    <section class="flash__panel">
      <h2>1 · Flash firmware</h2>
      <p class="flash__hint">
        Disconnect the setup console below first — flashing needs the serial
        port for itself.
      </p>
      <esp-web-install-button manifest="${MANIFEST_URL}"></esp-web-install-button>
    </section>

    <section class="flash__panel">
      <h2>2 · Configure</h2>
      <form class="flash__form">
        <label>Station WiFi SSID
          <input name="ssid" autocomplete="off" required />
        </label>
        <label>Station WiFi password
          <input name="password" type="password" autocomplete="off" />
        </label>
        <label>Device id
          <input name="deviceId" autocomplete="off" required
            placeholder="bm-station-a-m5" />
        </label>
        <div class="flash__actions">
          <button type="button" data-action="connect">Connect console</button>
          <button type="submit" disabled>Send configuration</button>
        </div>
      </form>
      <div class="flash__actions" data-role="commands">
        <button type="button" disabled data-command="getConfig">Read config</button>
        <button type="button" disabled data-command="diagnose">Diagnose</button>
        <button type="button" disabled data-command="calibrate">Calibrate</button>
        <button type="button" disabled data-command="clearCalibration">Clear calibration</button>
        <button type="button" disabled data-command="reboot">Reboot</button>
        <button type="button" disabled data-command="factoryReset">Factory reset</button>
      </div>
    </section>

    <section class="flash__panel">
      <h2>3 · Device log</h2>
      <pre class="flash__log" aria-live="polite"></pre>
    </section>
  `;
}

// --- Setup form with remembered credentials --------------------------------

interface SetupForm {
  readonly element: HTMLFormElement;
  read(): StoredSetup;
}

function bindSetupForm(container: Element): SetupForm {
  const element = query<HTMLFormElement>(container, ".flash__form");
  const stored = loadStoredSetup();
  if (stored) {
    fieldOf(element, "ssid").value = stored.ssid;
    fieldOf(element, "password").value = stored.password;
    fieldOf(element, "deviceId").value = stored.deviceId;
  }

  return {
    element,
    read() {
      const setup: StoredSetup = {
        ssid: fieldOf(element, "ssid").value.trim(),
        password: fieldOf(element, "password").value,
        deviceId: fieldOf(element, "deviceId").value.trim(),
      };
      saveStoredSetup(setup);
      return setup;
    },
  };
}

function loadStoredSetup(): StoredSetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    return {
      ssid: typeof record.ssid === "string" ? record.ssid : "",
      password: typeof record.password === "string" ? record.password : "",
      deviceId: typeof record.deviceId === "string" ? record.deviceId : "",
    };
  } catch {
    return null;
  }
}

function saveStoredSetup(setup: StoredSetup): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // Private windows may refuse storage; the form still works for this visit.
  }
}

// --- Serial console --------------------------------------------------------

function bindSerialConsole(
  container: Element,
  form: SetupForm,
  log: PageLog,
): void {
  const connectButton = query<HTMLButtonElement>(
    container,
    "[data-action='connect']",
  );
  const sendButton = query<HTMLButtonElement>(
    container,
    ".flash__form button[type='submit']",
  );
  const commandButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("[data-command]"),
  );
  let channel: SerialSetupChannel | null = null;

  const setConnected = (isConnected: boolean): void => {
    connectButton.textContent = isConnected
      ? "Disconnect console"
      : "Connect console";
    sendButton.disabled = !isConnected;
    for (const button of commandButtons) button.disabled = !isConnected;
  };

  const send = async (command: M5SerialCommand): Promise<void> => {
    if (!channel) return;
    log.append(`→ ${JSON.stringify(command)}`);
    try {
      await channel.send(command);
    } catch (error) {
      log.append(`✗ send failed: ${describeError(error)}`);
    }
  };

  connectButton.addEventListener("click", async () => {
    if (channel) {
      await channel.close();
      channel = null;
      return;
    }

    try {
      channel = await openSerialSetup({
        onLine: (line) =>
          log.append(
            typeof line === "string"
              ? `· ${line}`
              : `← ${JSON.stringify(line)}`,
          ),
        onClosed: () => {
          channel = null;
          setConnected(false);
          log.append("· console disconnected");
        },
      });
      setConnected(true);
      log.append("· console connected");
    } catch (error) {
      log.append(`✗ connect failed: ${describeError(error)}`);
    }
  });

  form.element.addEventListener("submit", (event) => {
    event.preventDefault();
    const setup = form.read();
    void send({ type: "configure", ...setup });
  });

  for (const button of commandButtons) {
    button.addEventListener("click", () => {
      const type = button.dataset.command as M5SerialCommand["type"];
      void send({ type } as M5SerialCommand);
    });
  }
}

// --- Log pane --------------------------------------------------------------

interface PageLog {
  append(line: string): void;
}

function createLog(element: HTMLElement): PageLog {
  const lines: string[] = [];
  return {
    append(line) {
      lines.push(line);
      if (lines.length > LOG_LINE_LIMIT) lines.shift();
      element.textContent = lines.join("\n");
      element.scrollTop = element.scrollHeight;
    },
  };
}

// --- Small DOM helpers -----------------------------------------------------

function query<T extends HTMLElement = HTMLElement>(
  container: Element,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  if (!element) throw new Error(`Flash page is missing ${selector}`);
  return element;
}

function fieldOf(form: HTMLFormElement, name: string): HTMLInputElement {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement)) {
    throw new Error(`Flash form is missing the ${name} field`);
  }
  return field;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
