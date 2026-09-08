/** Run the firmware's actual configuration parser against native ArduinoJson. */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const firmwareDirectory = fileURLToPath(new URL("../", import.meta.url));
const firmware = await readFile(join(firmwareDirectory, "src/main.cpp"), "utf8");
const configStruct = firmware.match(/struct DeviceConfig \{[\s\S]*?\n\};/)?.[0];
const configParser = firmware.match(
  /DeviceConfig readConfigFromDocument\(JsonDocument &document\) \{[\s\S]*?\n\}/,
)?.[0];
if (!configStruct || !configParser) {
  throw new Error("Cannot locate the firmware configuration parser");
}

const testDirectory = await mkdtemp(join(tmpdir(), "bm-m5-config-"));
try {
  const sourcePath = join(testDirectory, "config-test.cpp");
  const executablePath = join(testDirectory, "config-test");
  await writeFile(
    sourcePath,
    `#include <ArduinoJson.h>
#include <cassert>
#include <string>

// Only Arduino String's trimming is needed by the unchanged production parser.
struct String : std::string {
  using std::string::operator=;
  void trim() {
    const auto first = find_first_not_of(" \\t\\r\\n");
    if (first == npos) { clear(); return; }
    *this = substr(first, find_last_not_of(" \\t\\r\\n") - first + 1);
  }
};

${configStruct}
DeviceConfig config;
${configParser}

DeviceConfig configure(const char *json) {
  JsonDocument document;
  assert(!deserializeJson(document, json));
  return readConfigFromDocument(document);
}

int main() {
  auto fresh = configure(R"({"ssid":"  studio  ","deviceId":" rig ","password":" secret "})");
  assert(!fresh.swapPitchRoll && !fresh.invertPitch && !fresh.invertRoll);
  assert(fresh.ssid == "studio" && fresh.deviceId == "rig" && fresh.password == " secret ");

  config.swapPitchRoll = true;
  config.invertPitch = true;
  config.invertRoll = true;
  auto preserved = configure(R"({"ssid":"new-network","deviceId":"rig","password":"new-password"})");
  assert(preserved.swapPitchRoll && preserved.invertPitch && preserved.invertRoll);
  assert(preserved.ssid == "new-network" && preserved.password == "new-password");

  auto cleared = configure(R"({"swapPitchRoll":false,"invertPitch":false,"invertRoll":false})");
  assert(!cleared.swapPitchRoll && !cleared.invertPitch && !cleared.invertRoll);

  auto partial = configure(R"({"invertPitch":false})");
  assert(partial.swapPitchRoll && !partial.invertPitch && partial.invertRoll);

  config = cleared;
  auto enabled = configure(R"({"swapPitchRoll":true,"invertPitch":true,"invertRoll":true})");
  assert(enabled.swapPitchRoll && enabled.invertPitch && enabled.invertRoll);
}
`,
  );
  const compile = Bun.spawn(
    [
      "c++",
      "-std=c++17",
      "-I",
      join(firmwareDirectory, ".pio/libdeps/m5stick-s3/ArduinoJson/src"),
      sourcePath,
      "-o",
      executablePath,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await compile.exited) !== 0) {
    throw new Error(
      "Native config test compilation failed; build firmware first to install ArduinoJson",
    );
  }
  const test = Bun.spawn([executablePath], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((await test.exited) !== 0) {
    throw new Error("Firmware configuration regression test failed");
  }
  console.log("Firmware configuration regression test passed");
} finally {
  await rm(testDirectory, { recursive: true, force: true });
}
