import { afterEach, beforeEach, expect, test } from "bun:test";
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let project: string;
let firmware: string;
let output: string;

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), "bm-m5-export-"));
  firmware = join(project, "firmware/m5");
  output = join(project, "public/firmware/m5-controller");
  await Promise.all([
    mkdir(join(firmware, "tools"), { recursive: true }),
    mkdir(join(firmware, "src"), { recursive: true }),
    mkdir(join(project, "src/m5"), { recursive: true }),
    mkdir(join(project, "bin")),
    mkdir(output, { recursive: true }),
  ]);
  await Promise.all([
    copyFile(
      new URL("../../../firmware/m5/tools/export-firmware.ts", import.meta.url),
      join(firmware, "tools/export-firmware.ts"),
    ),
    writeFile(
      join(project, "src/m5/protocol.ts"),
      'export const M5_FIRMWARE_VERSION = "test-release";',
    ),
    writeFile(
      join(firmware, "src/main.cpp"),
      'constexpr const char *FirmwareVersion = "test-release";',
    ),
    writeFile(join(output, "m5-controller.bin"), "previous-binary"),
    writeFile(join(output, "manifest.json"), "previous-manifest"),
  ]);
});

afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function exportFirmware(buildExitCode = 0) {
  const pioPath = join(project, "bin/pio");
  await writeFile(
    pioPath,
    `#!${process.execPath}
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
const project = process.argv[process.argv.indexOf("--project-dir") + 1];
await writeFile(join(project, "build-called"), JSON.stringify(process.argv.slice(2)));
const build = join(project, ".pio/build/m5stick-s3");
await mkdir(build, { recursive: true });
await writeFile(join(build, "firmware.factory.bin"), "fresh-binary");
process.exit(${buildExitCode});
`,
  );
  await chmod(pioPath, 0o755);
  const child = Bun.spawn(
    [process.execPath, join(firmware, "tools/export-firmware.ts")],
    {
      env: { ...process.env, PATH: `${join(project, "bin")}:${process.env.PATH}` },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const [exitCode, stderr] = await Promise.all([
    child.exited,
    new Response(child.stderr).text(),
    new Response(child.stdout).text(),
  ]);
  return { exitCode, stderr };
}

async function expectPreviousArtifacts() {
  expect(await readFile(join(output, "m5-controller.bin"), "utf8")).toBe(
    "previous-binary",
  );
  expect(await readFile(join(output, "manifest.json"), "utf8")).toBe(
    "previous-manifest",
  );
}

test("rejects mismatching versions before running the build or replacing artifacts", async () => {
  await writeFile(
    join(firmware, "src/main.cpp"),
    'constexpr const char *FirmwareVersion = "other-release";',
  );
  const result = await exportFirmware();
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("does not match protocol");
  expect(await Bun.file(join(firmware, "build-called")).exists()).toBe(false);
  await expectPreviousArtifacts();
});

test("leaves published artifacts intact when the build fails", async () => {
  const result = await exportFirmware(1);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr).toContain("Firmware build failed");
  expect(await Bun.file(join(firmware, "build-called")).exists()).toBe(true);
  await expectPreviousArtifacts();
});

test("exports the merged binary and a manifest with the verified version", async () => {
  const result = await exportFirmware();
  expect(result.exitCode).toBe(0);
  expect(await readFile(join(output, "m5-controller.bin"), "utf8")).toBe(
    "fresh-binary",
  );
  expect(await Bun.file(join(output, "manifest.json")).json()).toEqual({
    name: "Becoming Many M5 Controller",
    version: "test-release",
    new_install_prompt_erase: true,
    builds: [
      {
        chipFamily: "ESP32-S3",
        parts: [{ path: "m5-controller.bin", offset: 0 }],
      },
    ],
  });
  expect(await Bun.file(join(firmware, "build-called")).json()).toEqual([
    "run",
    "--project-dir",
    firmware,
    "--environment",
    "m5stick-s3",
  ]);
});
