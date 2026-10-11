#include "http/request.h"

#include <cstdlib>

#include "http/response.h"
#include "servos.h"

namespace {

bool parseIndex(const String& text, int& out) {
  char* end = nullptr;
  const long parsed = strtol(text.c_str(), &end, 10);

  if (text.isEmpty() || *end != '\0' || text[0] == '-' || text[0] == '+') {
    return false;
  }

  out = static_cast<int>(parsed);
  return true;
}

bool parseAngle(const String& text, float& out) {
  char* end = nullptr;
  out = strtof(text.c_str(), &end);
  return !text.isEmpty() && *end == '\0';
}

}  // namespace

std::optional<ServoMove> ServoMove::read(WebServer& server) {
  if (!server.hasArg("index") || !server.hasArg("angle")) {
    sendError(server, 400, "missing index or angle");
    return std::nullopt;
  }

  ServoMove move{};

  if (!parseIndex(server.arg("index"), move.index)) {
    sendError(server, 400, "invalid index");
    return std::nullopt;
  }

  if (!parseAngle(server.arg("angle"), move.angle)) {
    sendError(server, 400, "invalid angle");
    return std::nullopt;
  }

  if (move.index >= SERVO_COUNT) {
    sendError(server, 400, "index out of range");
    return std::nullopt;
  }

  // Written so NaN fails too.
  if (!(move.angle >= 0.0f && move.angle <= 180.0f)) {
    sendError(server, 400, "angle out of range");
    return std::nullopt;
  }

  return move;
}
