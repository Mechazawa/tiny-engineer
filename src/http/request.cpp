#include "http/request.h"

#include "http/response.h"
#include "servos.h"

bool readJsonBody(WebServer& server, JsonDocument& body) {
  if (!server.hasArg("plain")) {
    // WebServer keeps "plain" only for bodies that are not form-encoded.
    if (server.args() > 0 || server.clientContentLength() > 0) {
      sendError(server, 400, "send a JSON body with Content-Type: application/json");
      return false;
    }

    body.to<JsonObject>();
    return true;
  }

  if (deserializeJson(body, server.arg("plain")) || !body.is<JsonObjectConst>()) {
    sendError(server, 400, "body must be a JSON object");
    return false;
  }

  return true;
}

std::optional<ServoMove> ServoMove::read(WebServer& server, JsonObjectConst body) {
  const JsonVariantConst index = body["index"];
  const JsonVariantConst angle = body["angle"];

  if (!index.is<int>() || index.as<int>() < 0 || index.as<int>() >= SERVO_COUNT) {
    sendError(server, 400, "invalid index");
    return std::nullopt;
  }

  if (!angle.is<float>() || angle.as<float>() < 0.0f || angle.as<float>() > 180.0f) {
    sendError(server, 400, "invalid angle");
    return std::nullopt;
  }

  return ServoMove{index.as<int>(), angle.as<float>()};
}
