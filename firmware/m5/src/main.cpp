// Purpose: Becoming Many M5StickS3 controller firmware.
//
// The device is a polled HTTP server on the station network: it reads the IMU,
// runs the device-owned pipeline stages (normalize -> axis-map -> calibrate),
// and serves the resulting control state as JSON on GET /state. Configuration
// arrives as newline-delimited JSON over the native USB serial port and is
// stored in NVS. There is no WebSocket, TLS, pairing, or server URL — the
// device *is* the server, announced over mDNS.
//
// The payload shape is mirrored by `src/m5/protocol.ts` in the app; keep
// FirmwareVersion in sync with M5_FIRMWARE_VERSION there.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <M5Unified.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>
#include <esp_system.h>

#include <cmath>
#include <cstring>

#include "controller_display.h"

namespace {

constexpr const char *FirmwareVersion = "0.3.2-bm-http";
constexpr const char *PreferencesNamespace = "bm-m5";
constexpr const char *FallbackDeviceId = "bm-station-a-m5";

constexpr uint32_t WifiReconnectIntervalMs = 3000;
constexpr uint32_t SampleIntervalMs = 50;
constexpr uint32_t SerialStateMirrorIntervalMs = 250;
constexpr uint32_t DisplayIntervalMs = 250;
constexpr uint32_t SerialCommandQuietMs = 1000;
constexpr uint32_t SerialBufferLimit = 768;
constexpr uint16_t HttpPort = 80;
// Full-scale tilt: 45 degrees of physical lean maps to +-1, matching the
// normalize stage the previous stack proved on the rig.
constexpr float MaxAngleDegrees = 45.0F;
// Holding the front B button this long adopts the current pose as zero.
constexpr uint32_t CalibrateHoldMs = 1500;

struct DeviceConfig {
  String ssid;
  String password;
  String deviceId;
  bool swapPitchRoll = false;
  bool invertPitch = false;
  bool invertRoll = false;
};

struct Calibration {
  float pitchOffset = 0.0F;
  float rollOffset = 0.0F;
  bool isActive = false;
};

// One IMU sample carried through the pipeline. Angles in degrees, control
// values in the public -1..1 range.
struct ControlSample {
  float pitchDegrees = 0.0F;
  float rollDegrees = 0.0F;
  float pitch = 0.0F;
  float roll = 0.0F;
  float quality = 0.0F;
};

Preferences preferences;
WebServer httpServer(HttpPort);
DeviceConfig config;
Calibration calibration;
ControlSample lastSample;

String serialLine;
String stateJson;

uint32_t lastWifiAttemptMs = 0;
uint32_t lastSampleMs = 0;
uint32_t lastSerialMirrorMs = 0;
uint32_t lastDisplayMs = 0;
uint32_t serialQuietUntilMs = 0;
// 0 means "never polled"; millis() is never 0 by the time a client connects.
uint32_t lastPollMs = 0;
uint32_t pollCount = 0;

uint32_t stateSeq = 0;
uint32_t buttonPressCount = 0;
uint32_t buttonReleaseCount = 0;
bool buttonPressed = false;
bool calibrateHoldLatched = false;

bool hasConfig = false;
bool wifiWasConnected = false;
bool mdnsRunning = false;

bool hasNetworkConfig(const DeviceConfig &targetConfig) {
  return targetConfig.ssid.length() > 0 && targetConfig.deviceId.length() > 0;
}

const char *effectiveDeviceId() {
  return config.deviceId.length() > 0 ? config.deviceId.c_str() : FallbackDeviceId;
}

float clampFloat(float value, float minValue, float maxValue) {
  if (value < minValue) {
    return minValue;
  }

  if (value > maxValue) {
    return maxValue;
  }

  return value;
}

// --- Configuration storage -------------------------------------------------

void loadConfig() {
  preferences.begin(PreferencesNamespace, true);
  config.ssid = preferences.getString("ssid", "");
  config.password = preferences.getString("password", "");
  config.deviceId = preferences.getString("deviceId", "");
  config.swapPitchRoll = preferences.getBool("swapAxes", false);
  config.invertPitch = preferences.getBool("invPitch", false);
  config.invertRoll = preferences.getBool("invRoll", false);
  calibration.pitchOffset = preferences.getFloat("calPitch", 0.0F);
  calibration.rollOffset = preferences.getFloat("calRoll", 0.0F);
  calibration.isActive = preferences.getBool("calActive", false);
  preferences.end();
  hasConfig = hasNetworkConfig(config);
}

void saveConfig(const DeviceConfig &nextConfig) {
  preferences.begin(PreferencesNamespace, false);
  preferences.putString("ssid", nextConfig.ssid);
  preferences.putString("password", nextConfig.password);
  preferences.putString("deviceId", nextConfig.deviceId);
  preferences.putBool("swapAxes", nextConfig.swapPitchRoll);
  preferences.putBool("invPitch", nextConfig.invertPitch);
  preferences.putBool("invRoll", nextConfig.invertRoll);
  preferences.end();

  config = nextConfig;
  hasConfig = hasNetworkConfig(config);
}

void saveCalibration(const Calibration &nextCalibration) {
  preferences.begin(PreferencesNamespace, false);
  preferences.putFloat("calPitch", nextCalibration.pitchOffset);
  preferences.putFloat("calRoll", nextCalibration.rollOffset);
  preferences.putBool("calActive", nextCalibration.isActive);
  preferences.end();
  calibration = nextCalibration;
}

void eraseAllStoredState() {
  preferences.begin(PreferencesNamespace, false);
  preferences.clear();
  preferences.end();
}

// --- Device pipeline: normalize -> axis-map -> calibrate -------------------

bool readImuDegrees(ControlSample &sample) {
  if (M5.Imu.getType() == m5::imu_none || !M5.Imu.update()) {
    return false;
  }

  const auto data = M5.Imu.getImuData();
  const float accelX = data.accel.x;
  const float accelY = data.accel.y;
  const float accelZ = data.accel.z;
  // The StickS3's IMU sits rotated 90 degrees relative to the StickC these
  // formulas were ported from, so the axes are exchanged and roll is negated
  // here: physical pitch reads on X and physical roll on inverted Y (verified
  // on hardware, 2026-09-01).
  sample.pitchDegrees = atan2f(-accelX, accelZ) * 180.0F / PI;
  sample.rollDegrees =
      -atan2f(accelY, sqrtf(accelX * accelX + accelZ * accelZ)) * 180.0F / PI;
  return true;
}

void applyAxisMap(float &pitch, float &roll) {
  if (config.swapPitchRoll) {
    const float swapped = pitch;
    pitch = roll;
    roll = swapped;
  }
  // Inversion happens after the swap, so the flags describe the output axes.
  if (config.invertPitch) {
    pitch = -pitch;
  }
  if (config.invertRoll) {
    roll = -roll;
  }
}

ControlSample sampleControl() {
  ControlSample sample;
  if (!readImuDegrees(sample)) {
    // quality 0 with neutral control: "nothing is steering" is a normal state.
    return sample;
  }

  float pitch = clampFloat(sample.pitchDegrees / MaxAngleDegrees, -1.0F, 1.0F);
  float roll = clampFloat(sample.rollDegrees / MaxAngleDegrees, -1.0F, 1.0F);
  applyAxisMap(pitch, roll);
  // Calibration offsets live in the public -1..1 range, recorded after the
  // axis map so a later axis change does not require re-calibration.
  pitch -= calibration.pitchOffset;
  roll -= calibration.rollOffset;

  sample.pitch = clampFloat(pitch, -1.0F, 1.0F);
  sample.roll = clampFloat(roll, -1.0F, 1.0F);
  sample.quality = 1.0F;
  return sample;
}

// --- State payload ---------------------------------------------------------

void rebuildStateJson() {
  JsonDocument document;
  document["deviceId"] = effectiveDeviceId();
  document["firmwareVersion"] = FirmwareVersion;
  document["seq"] = stateSeq;
  document["uptimeMs"] = millis();
  document["pitch"] = lastSample.pitch;
  document["roll"] = lastSample.roll;
  document["quality"] = lastSample.quality;
  document["buttonPressed"] = buttonPressed;
  document["buttonPressCount"] = buttonPressCount;
  document["buttonReleaseCount"] = buttonReleaseCount;
  document["isCalibrated"] = calibration.isActive;
  document["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;

  stateJson = "";
  serializeJson(document, stateJson);
}

// --- Serial setup channel --------------------------------------------------

template <typename TDocument>
void sendSerialJson(TDocument &document) {
  serializeJson(document, Serial);
  Serial.println();
}

void sendCommandResult(const char *type, bool ok, const char *message) {
  JsonDocument document;
  document["type"] = type;
  document["ok"] = ok;
  document["message"] = message;
  document["firmwareVersion"] = FirmwareVersion;
  document["deviceId"] = effectiveDeviceId();
  sendSerialJson(document);
}

void sendConfigSnapshot() {
  serialQuietUntilMs = millis() + SerialCommandQuietMs;

  JsonDocument document;
  document["type"] = "config";
  document["firmwareVersion"] = FirmwareVersion;
  document["deviceId"] = config.deviceId;
  document["ssid"] = config.ssid;
  document["hasPassword"] = config.password.length() > 0;
  document["swapPitchRoll"] = config.swapPitchRoll;
  document["invertPitch"] = config.invertPitch;
  document["invertRoll"] = config.invertRoll;
  document["isCalibrated"] = calibration.isActive;
  document["pitchOffset"] = calibration.pitchOffset;
  document["rollOffset"] = calibration.rollOffset;
  sendSerialJson(document);
}

void sendDiagnoseResult() {
  serialQuietUntilMs = millis() + SerialCommandQuietMs;

  JsonDocument document;
  document["type"] = "diagnoseResult";
  document["firmwareVersion"] = FirmwareVersion;
  document["deviceId"] = effectiveDeviceId();
  document["hasConfig"] = hasConfig;
  document["wifiStatus"] = WiFi.status();
  document["localIp"] = WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : "";
  document["rssi"] = WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0;
  document["mdnsRunning"] = mdnsRunning;
  document["httpPort"] = HttpPort;
  document["imuPresent"] = M5.Imu.getType() != m5::imu_none;
  document["lastPollAgeMs"] =
      lastPollMs == 0 ? -1 : static_cast<int32_t>(millis() - lastPollMs);
  document["isCalibrated"] = calibration.isActive;
  sendSerialJson(document);
}

DeviceConfig readConfigFromDocument(JsonDocument &document) {
  DeviceConfig nextConfig;
  nextConfig.ssid = document["ssid"] | "";
  nextConfig.password = document["password"] | "";
  nextConfig.deviceId = document["deviceId"] | "";
  nextConfig.swapPitchRoll = document["swapPitchRoll"] | false;
  nextConfig.invertPitch = document["invertPitch"] | false;
  nextConfig.invertRoll = document["invertRoll"] | false;
  nextConfig.ssid.trim();
  nextConfig.deviceId.trim();
  return nextConfig;
}

void restartNetworking() {
  if (mdnsRunning) {
    MDNS.end();
    mdnsRunning = false;
  }
  WiFi.disconnect(false);
  lastWifiAttemptMs = 0;
  wifiWasConnected = false;
}

void handleConfigure(JsonDocument &document) {
  const DeviceConfig nextConfig = readConfigFromDocument(document);
  if (!hasNetworkConfig(nextConfig)) {
    sendCommandResult("configureResult", false, "Missing ssid or deviceId");
    return;
  }

  restartNetworking();
  saveConfig(nextConfig);
  sendCommandResult("configureResult", true, "Configuration saved");
}

void calibrateCurrentPose() {
  if (lastSample.quality <= 0.0F) {
    sendCommandResult("calibrateResult", false, "No usable pose to calibrate against");
    return;
  }

  // Record offsets against the un-calibrated pose: add the current offsets
  // back so repeated calibrations do not accumulate.
  Calibration next;
  next.pitchOffset = lastSample.pitch + calibration.pitchOffset;
  next.rollOffset = lastSample.roll + calibration.rollOffset;
  next.isActive = true;
  saveCalibration(next);
  sendCommandResult("calibrateResult", true, "Current pose is the new zero");
}

void handleSerialDocument(JsonDocument &document) {
  const char *type = document["type"] | "";

  if (strcmp(type, "configure") == 0) {
    handleConfigure(document);
    return;
  }

  if (strcmp(type, "getConfig") == 0) {
    sendConfigSnapshot();
    return;
  }

  if (strcmp(type, "diagnose") == 0) {
    sendDiagnoseResult();
    return;
  }

  if (strcmp(type, "calibrate") == 0) {
    calibrateCurrentPose();
    return;
  }

  if (strcmp(type, "clearCalibration") == 0) {
    saveCalibration(Calibration{});
    sendCommandResult("calibrateResult", true, "Calibration cleared");
    return;
  }

  if (strcmp(type, "factoryReset") == 0) {
    eraseAllStoredState();
    sendCommandResult("factoryResetResult", true, "Stored state erased, rebooting");
    Serial.flush();
    delay(100);
    ESP.restart();
    return;
  }

  if (strcmp(type, "reboot") == 0) {
    sendCommandResult("rebootResult", true, "Rebooting");
    Serial.flush();
    delay(100);
    ESP.restart();
    return;
  }

  sendCommandResult("commandResult", false, "Unsupported setup message");
}

void handleSerialLine() {
  serialQuietUntilMs = millis() + SerialCommandQuietMs;

  JsonDocument document;
  DeserializationError error = deserializeJson(document, serialLine);
  serialLine = "";

  if (error) {
    sendCommandResult("commandResult", false, "Invalid JSON");
    return;
  }

  handleSerialDocument(document);
}

void readSerialSetup() {
  while (Serial.available() > 0) {
    const char nextChar = static_cast<char>(Serial.read());
    if (nextChar == '\r') {
      continue;
    }

    if (nextChar == '\n') {
      handleSerialLine();
      continue;
    }

    if (serialLine.length() < SerialBufferLimit) {
      serialLine += nextChar;
      continue;
    }

    serialLine = "";
    sendCommandResult("commandResult", false, "Setup message too long");
  }
}

// --- WiFi and mDNS ---------------------------------------------------------

// mDNS hostnames allow letters, digits, and hyphens only.
String mdnsHostname() {
  String hostname;
  const char *deviceId = effectiveDeviceId();
  for (size_t index = 0; deviceId[index] != '\0'; index += 1) {
    const char nextChar = deviceId[index];
    if (isalnum(nextChar)) {
      hostname += nextChar;
    } else if (hostname.length() > 0 && !hostname.endsWith("-")) {
      hostname += '-';
    }
  }

  return hostname.length() > 0 ? hostname : String(FallbackDeviceId);
}

void beginMdns() {
  const String hostname = mdnsHostname();
  mdnsRunning = MDNS.begin(hostname.c_str());
  if (mdnsRunning) {
    MDNS.addService("http", "tcp", HttpPort);
  }
}

void maintainWifi(uint32_t nowMs) {
  if (!hasConfig) {
    return;
  }

  const bool connected = WiFi.status() == WL_CONNECTED;
  if (connected && !wifiWasConnected) {
    beginMdns();
  }
  if (!connected && wifiWasConnected && mdnsRunning) {
    MDNS.end();
    mdnsRunning = false;
  }
  wifiWasConnected = connected;

  if (connected) {
    return;
  }

  if (lastWifiAttemptMs != 0 && nowMs - lastWifiAttemptMs < WifiReconnectIntervalMs) {
    return;
  }

  lastWifiAttemptMs = nowMs;
  WiFi.disconnect(false);
  WiFi.begin(config.ssid.c_str(), config.password.c_str());
}

// --- HTTP server -----------------------------------------------------------

void handleStateRequest() {
  lastPollMs = millis();
  pollCount += 1;
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.sendHeader("Cache-Control", "no-store");
  httpServer.send(200, "application/json", stateJson);
}

void handleUnknownRequest() {
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.send(404, "application/json", "{\"error\":\"unknown path, poll /state\"}");
}

void beginHttpServer() {
  httpServer.on("/state", HTTP_GET, handleStateRequest);
  httpServer.onNotFound(handleUnknownRequest);
  httpServer.begin();
}

// --- Buttons ---------------------------------------------------------------

void updateButtons() {
  // BtnA is the one logical control button. The counters survive polling: a
  // press-and-release between two polls still advances both.
  if (M5.BtnA.wasPressed()) {
    buttonPressCount += 1;
    buttonPressed = true;
  }
  if (M5.BtnA.wasReleased()) {
    buttonReleaseCount += 1;
    buttonPressed = false;
  }

  // Holding BtnB calibrates at the rig without a laptop; the latch fires once
  // per hold.
  if (M5.BtnB.pressedFor(CalibrateHoldMs)) {
    if (!calibrateHoldLatched) {
      calibrateHoldLatched = true;
      calibrateCurrentPose();
    }
  } else if (M5.BtnB.wasReleased()) {
    calibrateHoldLatched = false;
  }
}

// --- Periodic work ---------------------------------------------------------

void updateSample(uint32_t nowMs) {
  if (nowMs - lastSampleMs < SampleIntervalMs) {
    return;
  }

  lastSampleMs = nowMs;
  lastSample = sampleControl();
  stateSeq += 1;
  rebuildStateJson();

  const bool serialQuiet = nowMs < serialQuietUntilMs;
  const bool mirrorDue = lastSerialMirrorMs == 0 ||
                         nowMs - lastSerialMirrorMs >= SerialStateMirrorIntervalMs;
  if (!serialQuiet && mirrorDue) {
    lastSerialMirrorMs = nowMs;
    Serial.println(stateJson);
  }
}

void renderDisplay(uint32_t nowMs) {
  if (lastDisplayMs != 0 && nowMs - lastDisplayMs < DisplayIntervalMs) {
    return;
  }

  lastDisplayMs = nowMs;
  ControllerDisplayState displayState;
  displayState.pitch = lastSample.pitch;
  displayState.roll = lastSample.roll;
  displayState.wifiConnected = WiFi.status() == WL_CONNECTED;
  displayState.isCalibrated = calibration.isActive;
  displayState.localIp = displayState.wifiConnected ? WiFi.localIP().toString() : "";
  displayState.deviceId = effectiveDeviceId();
  displayState.pollAgeMs =
      lastPollMs == 0 ? -1 : static_cast<int32_t>(nowMs - lastPollMs);
  displayState.pollCount = pollCount;
  renderControllerDisplay(displayState);
}

}  // namespace

void setup() {
  auto m5Config = M5.config();
  m5Config.serial_baudrate = 115200;
  m5Config.clear_display = true;
  m5Config.internal_imu = true;
  M5.begin(m5Config);
  beginControllerDisplay();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);
  WiFi.persistent(false);

  loadConfig();
  rebuildStateJson();
  beginHttpServer();
  sendCommandResult("bootResult", hasConfig,
                    hasConfig ? "Configuration loaded" : "No saved configuration");
}

void loop() {
  const uint32_t nowMs = millis();

  M5.update();
  updateButtons();
  readSerialSetup();
  maintainWifi(nowMs);
  updateSample(nowMs);
  httpServer.handleClient();
  renderDisplay(nowMs);
  yield();
}
