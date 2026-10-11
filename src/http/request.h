#pragma once

#include <WebServer.h>

#include <optional>

struct ServoMove {
  int index;
  float angle;

  // Sends 400 and returns nullopt when the request holds no valid move.
  static std::optional<ServoMove> read(WebServer& server);
};
