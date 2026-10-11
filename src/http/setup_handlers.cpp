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

// Setup routes drive the hardware without the saved limits, so they only run
// in setup AP mode. On success `body` holds the request.
bool readSetupRequest(WebServer& server, const char* step, JsonDocument& body) {
  if (!wifiProvisioningMode()) {
    sendError(server, 400, (String("setup ") + step + " only in AP mode").c_str());
    return false;
  }

  return readJsonBody(server, body);
}

JsonDocument setupReply(const char* step) {
  JsonDocument reply;
  reply["ok"] = true;
  reply["setup"] = step;
  return reply;
}

void holdLogicalColor(WebServer& server, JsonObjectConst body) {
  const String color = body["color"].as<const char*>();
  const JsonVariantConst order = body["rgb_order"];

  if (color != "R" && color != "G" && color != "B") {
    sendError(server, 400, "invalid color");
    return;
  }

  if (!order.isNull() && !settingsValidateRgbOrder(order.as<const char*>())) {
    sendError(server, 400, "invalid rgb_order");
    return;
  }

  rgbSetupHoldLogical(
    color == "R" ? 255 : 0,
    color == "G" ? 255 : 0,
    color == "B" ? 255 : 0,
    order.as<const char*>()
  );

  JsonDocument reply = setupReply("led");
  reply["color"] = color;
  sendJson(server, 200, reply);
}

void holdWireByte(WebServer& server, JsonVariantConst byte) {
  if (!byte.is<uint8_t>() || byte.as<uint8_t>() > 2) {
    sendError(server, 400, "invalid byte");
    return;
  }

  rgbSetupHoldWireByte(byte.as<uint8_t>());

  JsonDocument reply = setupReply("led");
  reply["byte"] = byte;
  sendJson(server, 200, reply);
}

}  // namespace

void handleSetupServo(WebServer& server) {
  JsonDocument body;

  if (!readSetupRequest(server, "servo", body)) {
    return;
  }

  if (!body["all"].isNull()) {
    if (body["all"] != 90) {
      sendError(server, 400, "invalid all");
      return;
    }

    servoMoveAllToElectricalAngle(90.0f);

    JsonDocument reply = setupReply("servo");
    reply["all"] = 90;
    sendJson(server, 200, reply);
    return;
  }

  const std::optional<ServoMove> move = ServoMove::read(server, body.as<JsonObjectConst>());

  if (!move) {
    return;
  }

  // ServoMove::read checked the index, the only thing the move can refuse.
  moveServoSmoothElectrical(move->index, move->angle);

  JsonDocument reply = setupReply("servo");
  reply["index"] = move->index;
  reply["angle"] = move->angle;
  sendJson(server, 200, reply);
}

void handleSetupLed(WebServer& server) {
  JsonDocument body;

  if (!readSetupRequest(server, "led", body)) {
    return;
  }

  const bool hasColor = !body["color"].isNull();
  const bool hasByte = !body["byte"].isNull();

  if (hasColor && hasByte) {
    sendError(server, 400, "color and byte conflict");
    return;
  }

  if (hasColor) {
    holdLogicalColor(server, body.as<JsonObjectConst>());
    return;
  }

  if (hasByte) {
    holdWireByte(server, body["byte"]);
    return;
  }

  rgbSetupRelease();

  JsonDocument reply = setupReply("led");
  reply["off"] = true;
  sendJson(server, 200, reply);
}

void handleSetupAudio(WebServer& server) {
  JsonDocument body;

  if (!readSetupRequest(server, "audio", body)) {
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
  JsonDocument body;

  if (!readSetupRequest(server, "oled", body)) {
    return;
  }

  const JsonVariantConst rotate = body["rotate_180"];
  JsonDocument reply = setupReply("oled");

  if (rotate.isNull()) {
    restoreProvisioningOled();
    reply["restored"] = true;
    sendJson(server, 200, reply);
    return;
  }

  if (!rotate.is<bool>()) {
    sendError(server, 400, "invalid rotate_180");
    return;
  }

  showOledOrientationTest(rotate.as<bool>());
  reply["rotate_180"] = rotate;
  sendJson(server, 200, reply);
}
