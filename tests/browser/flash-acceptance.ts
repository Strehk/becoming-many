import assert from "node:assert/strict";
import type { Page } from "playwright";
import { M5_FIRMWARE_VERSION } from "../../src/m5/protocol";

const STORAGE_KEY = "bm-m5-flash-setup";
const PASSWORD = "synthetic-lifecycle-password";
const UNSUPPORTED_ONCE_KEY = "flash-acceptance-unsupported-once";

/** Exercise setup responses and port cleanup using browser streams, never hardware. */
export async function checkFlashLifecycle(
  page: Page,
  baseUrl: string,
): Promise<void> {
  const url = new URL("/flash.html", baseUrl).href;
  await page.goto(url, { waitUntil: "load" });
  await checkResponsesAndDisconnect(page);
  await page.goto(url, { waitUntil: "load" });
  await checkLatePickerCleanup(page);
  await page.goto(url, { waitUntil: "load" });
  await checkUnsupportedSerial(page);
  // Leave a normal, mounted page for the caller's screenshots/layout checks.
  await page.reload({ waitUntil: "load" });
}

async function checkResponsesAndDisconnect(page: Page): Promise<void> {
  const serial = await installSerial(page, true);
  try {
    await page
      .getByRole("button", { name: "Connect console", exact: true })
      .click();
    const connecting = page.getByRole("button", {
      name: "Connecting…",
      exact: true,
    });
    assert.equal(await connecting.isDisabled(), true);
    // Synthetic dispatch also exercises the Entry guard behind the disabled control.
    await connecting.dispatchEvent("click");
    await connecting.dispatchEvent("click");
    assert.equal(await serial.evaluate((mock) => mock.status.requests), 1);
    await serial.evaluate((mock) => mock.resolvePicker());
    await page
      .getByRole("button", { name: "Disconnect console", exact: true })
      .waitFor();
    assert.equal(await page.locator("[data-command]:enabled").count(), 6);

    await page.locator('[name="ssid"]').fill("lifecycle-wifi");
    await page.locator('[name="deviceId"]').fill("lifecycle-m5");
    await page.locator('[name="password"]').fill(PASSWORD);
    await page
      .getByRole("button", { name: "Send configuration", exact: true })
      .click();
    await page.waitForFunction(
      (mock) => mock.status.writes.length === 1,
      serial,
    );
    const log = page.locator(".flash__log");
    await log
      .filter({ hasText: "configure sent; awaiting device response" })
      .waitFor();
    assert.equal(
      (await log.innerText()).includes("Configuration applied"),
      false,
    );
    assert.deepEqual(
      JSON.parse(
        (await serial.evaluate((mock) => mock.status.writes))[0] ?? "",
      ),
      {
        type: "configure",
        ssid: "lifecycle-wifi",
        password: PASSWORD,
        deviceId: "lifecycle-m5",
      },
    );

    const identity = {
      firmwareVersion: M5_FIRMWARE_VERSION,
      deviceId: "lifecycle-m5",
    };
    const unsafeText = "device-private-debug-string";
    await serial.evaluate(
      (mock, text) => mock.emit(text),
      [
        `boot output ${unsafeText} ${PASSWORD}`,
        JSON.stringify({
          type: "unknown",
          password: PASSWORD,
          detail: unsafeText,
        }),
        JSON.stringify({
          ...identity,
          type: "configureResult",
          ok: false,
          message: `${unsafeText} ${PASSWORD}`,
        }),
        "",
      ].join("\n"),
    );
    await log.filter({ hasText: "Configuration rejected" }).waitFor();
    assert.equal(
      (await log.innerText()).includes("Configuration applied"),
      false,
    );
    await serial.evaluate(
      (mock, text) => mock.emit(text),
      `${JSON.stringify({
        ...identity,
        type: "configureResult",
        ok: true,
        message: `${unsafeText} ${PASSWORD}`,
      })}\n`,
    );
    await log.filter({ hasText: "Configuration applied" }).waitFor();

    // Public config fields remain visible; echoes and unknown extra fields do not.
    await serial.evaluate(
      (mock, text) => mock.emit(text),
      `${JSON.stringify({
        ...identity,
        type: "config",
        ssid: `echo-${PASSWORD}`,
        hasPassword: true,
        swapPitchRoll: false,
        invertPitch: false,
        invertRoll: false,
        isCalibrated: true,
        pitchOffset: 0,
        rollOffset: 0,
        password: PASSWORD,
        privateDiagnostic: unsafeText,
      })}\n`,
    );
    await log.filter({ hasText: "echo-[redacted]" }).waitFor();
    const transcript = await log.innerText();
    assert.equal(transcript.includes(PASSWORD), false);
    assert.equal(transcript.includes(unsafeText), false);
    assert.deepEqual(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) ?? "null"),
        STORAGE_KEY,
      ),
      { ssid: "lifecycle-wifi", deviceId: "lifecycle-m5" },
    );

    await serial.evaluate((mock) => mock.unplug());
    await assertDisconnected(page);
    await page.waitForFunction((mock) => mock.status.closes === 1, serial);
    assert.equal(
      await serial.evaluate((mock) => mock.status.closedWithUnlockedStreams),
      true,
    );
  } finally {
    await serial.dispose();
  }

  // Explicit disconnect follows the same reader/port release path as unplugging.
  const reconnect = await installSerial(page, false);
  try {
    await page
      .getByRole("button", { name: "Connect console", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Disconnect console", exact: true })
      .click();
    await assertDisconnected(page);
    await page.waitForFunction((mock) => mock.status.closes === 1, reconnect);
    assert.equal(await reconnect.evaluate((mock) => mock.status.cancels), 1);
    assert.equal(
      await reconnect.evaluate((mock) => mock.status.closedWithUnlockedStreams),
      true,
    );
  } finally {
    await reconnect.dispose();
  }
}

async function checkLatePickerCleanup(page: Page): Promise<void> {
  const serial = await installSerial(page, true);
  try {
    await page.locator('[name="password"]').fill(PASSWORD);
    await page
      .getByRole("button", { name: "Connect console", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Connecting…", exact: true })
      .waitFor();
    await page.evaluate(() =>
      window.dispatchEvent(new PageTransitionEvent("pagehide")),
    );
    assert.equal(await page.locator('[name="password"]').inputValue(), "");
    await serial.evaluate((mock) => mock.resolvePicker());
    await page.waitForFunction((mock) => mock.status.closes === 1, serial);
    const status = await serial.evaluate((mock) => mock.status);
    assert.equal(status.opens, 1);
    assert.equal(status.cancels, 1);
    assert.equal(status.closedWithUnlockedStreams, true);
    assert.equal(await page.locator("[data-command]:enabled").count(), 0);
    assert.equal(
      (await page.locator(".flash__log").innerText()).includes(
        "Console connected",
      ),
      false,
    );
  } finally {
    await serial.dispose();
  }
}

async function checkUnsupportedSerial(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem(key) !== "true") return;
    sessionStorage.removeItem(key);
    Reflect.deleteProperty(Object.getPrototypeOf(navigator), "serial");
    Reflect.deleteProperty(navigator, "serial");
  }, UNSUPPORTED_ONCE_KEY);
  await page.evaluate(
    (key) => sessionStorage.setItem(key, "true"),
    UNSUPPORTED_ONCE_KEY,
  );
  await page.reload({ waitUntil: "load" });
  assert.equal(await page.evaluate(() => "serial" in navigator), false);
  assert.equal(await page.locator(".flash__unsupported").isVisible(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "Connect console", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.locator("[data-command]:enabled").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Send configuration", exact: true })
      .isDisabled(),
    true,
  );
}

async function assertDisconnected(page: Page): Promise<void> {
  const connect = page.getByRole("button", {
    name: "Connect console",
    exact: true,
  });
  await connect.waitFor();
  assert.equal(await connect.isEnabled(), true);
  assert.equal(
    await page
      .getByRole("button", { name: "Send configuration", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.locator("[data-command]:enabled").count(), 0);
}

/** A single synthetic port with observable stream ownership and a deferred picker. */
async function installSerial(page: Page, deferPicker: boolean) {
  return page.evaluateHandle((deferred) => {
    const status = {
      requests: 0,
      opens: 0,
      closes: 0,
      cancels: 0,
      closedWithUnlockedStreams: false,
      writes: [] as string[],
    };
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let ended = false;
    const readable = new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
      cancel() {
        ended = true;
        status.cancels += 1;
      },
    });
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        status.writes.push(new TextDecoder().decode(chunk));
      },
    });
    const port = {
      readable,
      writable,
      async open() {
        status.opens += 1;
      },
      async close() {
        status.closedWithUnlockedStreams = !readable.locked && !writable.locked;
        status.closes += 1;
      },
    };
    let resolvePicker: () => void = () => {};
    const picker = new Promise<typeof port>((resolve) => {
      resolvePicker = () => resolve(port);
    });
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: {
        requestPort() {
          status.requests += 1;
          return deferred ? picker : Promise.resolve(port);
        },
      },
    });
    return {
      status,
      resolvePicker,
      emit(text: string) {
        if (!ended) controller.enqueue(new TextEncoder().encode(text));
      },
      unplug() {
        if (ended) return;
        ended = true;
        controller.close();
      },
    };
  }, deferPicker);
}
