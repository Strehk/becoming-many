// Purpose: render local diagnostics on the M5StickS3 display.
//
// This file stays presentation-only. It receives already sampled control and
// connection state and draws it; it never changes networking or IMU behavior.

#include "controller_display.h"

#include <M5Unified.h>

#include <cmath>

namespace {

// The landscape display is 240x135; the layout has to fit all three status
// rows inside that height, so every band is sized against a 135px budget.
constexpr int16_t DisplayRotation = 1;
constexpr int16_t Padding = 8;
constexpr int16_t HeaderHeight = 20;
constexpr int16_t LevelTop = 24;
constexpr int16_t LevelHeight = 64;
constexpr int16_t StatusTop = 94;
constexpr int16_t StatusRowSpacing = 14;
// A poll older than this shows as "stale": the station stopped listening.
constexpr int32_t PollStaleAfterMs = 1500;

M5Canvas frameBuffer(&M5.Display);
bool frameBufferReady = false;

uint16_t backgroundColor() {
  return M5.Display.color565(8, 12, 18);
}

uint16_t panelColor() {
  return M5.Display.color565(18, 25, 34);
}

uint16_t mutedColor() {
  return M5.Display.color565(139, 154, 171);
}

uint16_t textColor() {
  return M5.Display.color565(236, 241, 247);
}

uint16_t okColor() {
  return M5.Display.color565(66, 211, 146);
}

uint16_t warnColor() {
  return M5.Display.color565(255, 190, 87);
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

String formatControl(float value) {
  if (!std::isfinite(value)) {
    return "0.00";
  }

  return String(value, 2);
}

String fitText(String text, uint16_t maxWidth) {
  if (frameBuffer.textWidth(text) <= maxWidth) {
    return text;
  }

  while (text.length() > 4 && frameBuffer.textWidth("..." + text) > maxWidth) {
    text.remove(0, 1);
  }

  return "..." + text;
}

bool isPollFresh(const ControllerDisplayState &state) {
  return state.pollAgeMs >= 0 && state.pollAgeMs < PollStaleAfterMs;
}

void drawHeader(const ControllerDisplayState &state) {
  const uint16_t statusColor = isPollFresh(state) ? okColor() : warnColor();
  frameBuffer.fillRect(0, 0, frameBuffer.width(), HeaderHeight, panelColor());
  frameBuffer.setTextSize(1);
  frameBuffer.setTextColor(textColor(), panelColor());
  frameBuffer.drawString("Becoming Many M5", Padding, 6);
  frameBuffer.fillCircle(frameBuffer.width() - 15, 10, 5, statusColor);

  // Heartbeat: the small dot flips with every handled /state request, so it
  // flickers while a client polls and freezes the moment polling stops.
  const bool pingVisible = isPollFresh(state) && (state.pollCount % 2 == 1);
  frameBuffer.fillCircle(frameBuffer.width() - 30, 10, 3,
                         pingVisible ? okColor() : panelColor());
}

void drawLevel(const ControllerDisplayState &state) {
  const int16_t width = frameBuffer.width() - (Padding * 2);
  const int16_t centerX = Padding + (width / 2);
  const int16_t centerY = LevelTop + (LevelHeight / 2);
  // Ring plus the 7px bubble must stay inside LevelHeight / 2.
  const int16_t radius = 22;
  // The values are already in the -1..1 control range; full deflection sits on
  // the ring.
  const float xRatio = clampFloat(state.pitch, -1.0F, 1.0F);
  const float yRatio = clampFloat(-state.roll, -1.0F, 1.0F);
  const int16_t bubbleX = centerX + static_cast<int16_t>(xRatio * radius);
  const int16_t bubbleY = centerY + static_cast<int16_t>(yRatio * radius);

  frameBuffer.drawRoundRect(Padding, LevelTop, width, LevelHeight, 6, mutedColor());
  frameBuffer.drawLine(centerX - radius, centerY, centerX + radius, centerY, mutedColor());
  frameBuffer.drawLine(centerX, centerY - radius, centerX, centerY + radius, mutedColor());
  frameBuffer.drawCircle(centerX, centerY, radius, mutedColor());
  frameBuffer.fillCircle(bubbleX, bubbleY, 7, okColor());

  frameBuffer.setTextColor(textColor(), backgroundColor());
  frameBuffer.drawString("P " + formatControl(state.pitch), Padding + 4, LevelTop + 6);
  frameBuffer.drawString("R " + formatControl(state.roll), Padding + 4, LevelTop + 21);
  if (!state.isCalibrated) {
    frameBuffer.setTextColor(warnColor(), backgroundColor());
    frameBuffer.drawString("no cal", Padding + 4, LevelTop + LevelHeight - 16);
  }
}

void drawStatusRow(const char *label, const String &value, int16_t y, uint16_t valueColor) {
  frameBuffer.setTextSize(1);
  frameBuffer.setTextColor(mutedColor(), backgroundColor());
  frameBuffer.drawString(label, Padding, y);

  const int16_t valueX = 55;
  const uint16_t maxWidth = static_cast<uint16_t>(frameBuffer.width() - valueX - Padding);
  frameBuffer.setTextColor(valueColor, backgroundColor());
  frameBuffer.drawString(fitText(value, maxWidth), valueX, y);
}

String describePoll(const ControllerDisplayState &state) {
  if (state.pollAgeMs < 0) {
    return "no client yet";
  }

  if (isPollFresh(state)) {
    return "polling";
  }

  return "stale " + String(state.pollAgeMs / 1000) + "s";
}

void drawStatus(const ControllerDisplayState &state) {
  const String wifiStatus = state.wifiConnected ? "wifi ok" : "wifi down";
  const String connectionStatus = wifiStatus + " / " + describePoll(state);
  const String localIp = state.wifiConnected && state.localIp.length() > 0 ? state.localIp : "-";
  const String deviceId = state.deviceId.length() > 0 ? state.deviceId : "-";
  const uint16_t statusColor =
      state.wifiConnected && isPollFresh(state) ? okColor() : warnColor();

  drawStatusRow("conn", connectionStatus, StatusTop, statusColor);
  drawStatusRow("ip", localIp, StatusTop + StatusRowSpacing, textColor());
  drawStatusRow("device", deviceId, StatusTop + 2 * StatusRowSpacing, textColor());
}

}  // namespace

void beginControllerDisplay() {
  M5.Display.setRotation(DisplayRotation);
  M5.Display.setTextDatum(top_left);
  M5.Display.setTextSize(1);
  M5.Display.fillScreen(backgroundColor());

  frameBuffer.setColorDepth(16);
  frameBufferReady = frameBuffer.createSprite(M5.Display.width(), M5.Display.height()) != nullptr;
  frameBuffer.setTextDatum(top_left);
  frameBuffer.setTextSize(1);
}

void renderControllerDisplay(const ControllerDisplayState &state) {
  if (!frameBufferReady) {
    return;
  }

  frameBuffer.startWrite();
  frameBuffer.fillScreen(backgroundColor());
  drawHeader(state);
  drawLevel(state);
  drawStatus(state);
  frameBuffer.endWrite();

  M5.Display.startWrite();
  frameBuffer.pushSprite(0, 0);
  M5.Display.endWrite();
}
