#include <Arduino.h>

#include "audio/audio.h"
#include "display/oled.h"
#include "hardware/pca9685_servos.h"
#include "hardware/rgb.h"
#include "http/handlers.h"
#include "http/request.h"
#include "http/response.h"
#include "network/wifi_connect.h"
#include "settings/settings.h"

namespace {

// Setup routes drive the hardware without the saved limits, so they only run in setup AP mode.
bool inSetupMode(WebServer& server, const char* step) {
  if (wifiProvisioningMode()) {
    return true;
  }

  sendError(server, 400, (String("setup ") + step + " only in AP mode").c_str());
  return false;
}

JsonDocument setupReply(const char* step) {
  JsonDocument body;
  body["ok"] = true;
  body["setup"] = step;
  return body;
}

void holdLogicalColor(WebServer& server, const String& color) {
  if (color != "R" && color != "G" && color != "B") {
    sendError(server, 400, "invalid color");
    return;
  }

  const char* order = nullptr;
  const String orderArg = server.arg("rgb_order");

  if (server.hasArg("rgb_order")) {
    if (!settingsValidateRgbOrder(orderArg.c_str())) {
      sendError(server, 400, "invalid rgb_order");
      return;
    }

    order = orderArg.c_str();
  }

  rgbSetupHoldLogical(color == "R" ? 255 : 0, color == "G" ? 255 : 0, color == "B" ? 255 : 0, order);

  JsonDocument body = setupReply("led");
  body["color"] = color;
  sendJson(server, 200, body);
}

void holdWireByte(WebServer& server, const String& byte) {
  if (byte != "0" && byte != "1" && byte != "2") {
    sendError(server, 400, "invalid byte");
    return;
  }

  rgbSetupHoldWireByte(static_cast<uint8_t>(byte.toInt()));

  JsonDocument body = setupReply("led");
  body["byte"] = byte.toInt();
  sendJson(server, 200, body);
}

}  // namespace

void handleSetupServo(WebServer& server) {
  if (!inSetupMode(server, "servo")) {
    return;
  }

  if (server.hasArg("all")) {
    if (server.arg("all") != "90") {
      sendError(server, 400, "invalid all");
      return;
    }

    servoMoveAllToElectricalAngle(90.0f);

    JsonDocument body = setupReply("servo");
    body["all"] = 90;
    sendJson(server, 200, body);
    return;
  }

  const std::optional<ServoMove> move = ServoMove::read(server);

  if (!move) {
    return;
  }

  if (!moveServoSmoothElectrical(move->index, move->angle)) {
    sendError(server, 400, "index out of range");
    return;
  }

  JsonDocument body = setupReply("servo");
  body["index"] = move->index;
  body["angle"] = move->angle;
  sendJson(server, 200, body);
}

void handleSetupLed(WebServer& server) {
  if (!inSetupMode(server, "led")) {
    return;
  }

  const String byte = server.arg("byte");
  const bool release = !server.hasArg("byte") || byte == "off";

  if (server.hasArg("color")) {
    if (!release) {
      sendError(server, 400, "color and byte conflict");
      return;
    }

    holdLogicalColor(server, server.arg("color"));
    return;
  }

  if (!release) {
    holdWireByte(server, byte);
    return;
  }

  rgbSetupRelease();

  JsonDocument body = setupReply("led");
  body["off"] = true;
  sendJson(server, 200, body);
}

void handleSetupAudio(WebServer& server) {
  if (!inSetupMode(server, "audio")) {
    return;
  }

  const bool played = playWelcome();
  showIdleScreen();

  if (!played) {
    sendError(server, 500, "welcome playback failed");
    return;
  }

  sendJson(server, 200, setupReply("audio"));
}

void handleSetupOled(WebServer& server) {
  if (!inSetupMode(server, "oled")) {
    return;
  }

  if (!server.hasArg("rotate_180")) {
    restoreProvisioningOled();

    JsonDocument body = setupReply("oled");
    body["restored"] = true;
    sendJson(server, 200, body);
    return;
  }

  const String rotate = server.arg("rotate_180");

  if (rotate != "0" && rotate != "1") {
    sendError(server, 400, "invalid rotate_180");
    return;
  }

  showOledOrientationTest(rotate == "1");

  JsonDocument body = setupReply("oled");
  body["rotate_180"] = rotate == "1";
  sendJson(server, 200, body);
}
