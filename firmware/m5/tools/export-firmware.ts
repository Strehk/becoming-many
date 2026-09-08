/** Build and export matching firmware and its browser installer manifest. */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { M5_FIRMWARE_VERSION } from "../../../src/m5/protocol";

const projectDirectory = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(
  resolve(projectDirectory, "src/main.cpp"),
  "utf8",
);
const firmwareVersion = source.match(
  /constexpr const char \*FirmwareVersion = "([^"]+)";/,
)?.[1];

if (firmwareVersion !== M5_FIRMWARE_VERSION) {
  throw new Error(
    `Firmware version ${firmwareVersion ?? "missing"} does not match protocol ${M5_FIRMWARE_VERSION}`,
  );
}

const build = Bun.spawn(
  [
    "pio",
    "run",
    "--project-dir",
    projectDirectory,
    "--environment",
    "m5stick-s3",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
const exitCode = await build.exited;
if (exitCode !== 0) {
  throw new Error(`Firmware build failed with exit code ${exitCode}`);
}

const outputDirectory = resolve(
  projectDirectory,
  "../../public/firmware/m5-controller",
);
const binaryName = "m5-controller.bin";
await mkdir(outputDirectory, { recursive: true });
await copyFile(
  resolve(projectDirectory, ".pio/build/m5stick-s3/firmware.factory.bin"),
  resolve(outputDirectory, binaryName),
);
await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify(
    {
      name: "Becoming Many M5 Controller",
      version: firmwareVersion,
      new_install_prompt_erase: true,
      builds: [
        { chipFamily: "ESP32-S3", parts: [{ path: binaryName, offset: 0 }] },
      ],
    },
    null,
    2,
  )}\n`,
);
console.log(`Exported M5 firmware ${firmwareVersion} to ${outputDirectory}`);
