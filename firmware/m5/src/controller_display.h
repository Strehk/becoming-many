// Purpose: public display boundary for the Becoming Many M5 controller firmware.
//
// The display module owns only local diagnostics rendering: a level pad in the
// normalized -1..1 control range, connection state, local IP, device identity,
// and how recently a client polled. It does not own WiFi, the HTTP server, IMU
// sampling, or configuration.

#pragma once

#include <Arduino.h>

struct ControllerDisplayState {
  // Normalized, axis-mapped, calibrated control values (-1..1).
  float pitch = 0.0F;
  float roll = 0.0F;
  bool wifiConnected = false;
  bool isCalibrated = false;
  String localIp;
  String deviceId;
  // Milliseconds since the last /state request, or a negative value when no
  // client has polled yet.
  int32_t pollAgeMs = -1;
  // Total handled /state requests; the display blinks an activity dot on its
  // parity, so live polling shows as a visible heartbeat.
  uint32_t pollCount = 0;
};

void beginControllerDisplay();
void renderControllerDisplay(const ControllerDisplayState &state);
