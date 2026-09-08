// Register the custom element declared in flash.html.
import "esp-web-tools";

import {
  M5_FIRMWARE_VERSION,
  type M5SerialCommand,
  type M5SerialResponse,
} from "../m5/protocol";
import {
  isWebSerialSupported,
  openSerialSetup,
  type SerialSetupChannel,
} from "../m5/setup/serial-setup";
import { mountFlashPage } from "../ui/flash/flash.page";
import { requireElement } from "../ui/shared/dom";

let channel: SerialSetupChannel | null = null;
let connecting = false;
let sending = false;
let disposed = false;

const page = mountFlashPage(
  requireElement(document, ".flash", HTMLElement),
  {
    toggleConnection: () => void toggleConnection(),
    configure(setup) {
      page.rememberSetup(setup);
      void send({ type: "configure", ...setup });
    },
    send: (command) => void send(command),
  },
  M5_FIRMWARE_VERSION,
  isWebSerialSupported(),
);

window.addEventListener("pagehide", onPageHide);

function onPageHide(event: PageTransitionEvent): void {
  if (event.persisted) return;
  window.removeEventListener("pagehide", onPageHide);
  disposed = true;
  page.unload();
  // A pending browser port picker cannot be cancelled; close its result below.
  void channel
    ?.close()
    .catch((error: unknown) => console.error("Flash cleanup failed", error));
}

async function toggleConnection(): Promise<void> {
  if (disposed || connecting) return;
  if (channel) {
    page.setConnectionState("closing");
    try {
      await channel.close();
    } catch {
      if (!disposed) page.appendLog("✗ Console could not be closed");
    }
    return;
  }

  connecting = true;
  page.setConnectionState("connecting");
  try {
    const opened = await openSerialSetup({
      onMessage(response) {
        if (!disposed) page.appendLog(describeResponse(response));
      },
      onNotice(notice) {
        if (!disposed) page.appendLog(`· ${notice}`);
      },
      onError() {
        if (!disposed) page.appendLog("✗ Serial console error");
      },
      onClosed() {
        channel = null;
        if (disposed) return;
        page.setConnectionState("disconnected");
        page.appendLog("· Console disconnected");
      },
    });
    if (disposed) {
      await opened.close();
      return;
    }
    if (!opened.isOpen) return;
    channel = opened;
    page.setConnectionState("connected");
    page.appendLog("· Console connected");
  } catch {
    if (!disposed) {
      page.setConnectionState("disconnected");
      page.appendLog("✗ Console connection failed or was cancelled");
    }
  } finally {
    connecting = false;
  }
}

async function send(command: M5SerialCommand): Promise<void> {
  if (disposed || sending || !channel?.isOpen) return;
  sending = true;
  page.setSending(true);
  try {
    await channel.send(command);
    if (!disposed)
      page.appendLog(`→ ${command.type} sent; awaiting device response`);
  } catch {
    if (!disposed) page.appendLog("✗ Command could not be sent");
  } finally {
    sending = false;
    if (!disposed) page.setSending(false);
  }
}

function describeResponse(response: M5SerialResponse): string {
  if ("ok" in response) {
    // Device-provided message strings can contain secrets; report typed status only.
    return response.type === "configureResult"
      ? response.ok
        ? "← Configuration applied"
        : "← Configuration rejected"
      : `← ${response.type}: ${response.ok ? "ok" : "failed"}`;
  }
  return `← ${JSON.stringify(response)}`;
}
