#pragma once

#include <ArduinoJson.h>
#include <WebServer.h>

#include <optional>

// Parses a JSON object body into `body`; no body reads as {}. Sends 400 and
// returns false for anything else, query parameters and form fields included.
bool readJsonBody(WebServer& server, JsonDocument& body);

struct ServoMove {
  int index;
  float angle;

  // Sends 400 and returns nullopt when the body holds no valid move. A move that
  // passes is one the servo driver accepts: the index is the only thing it checks.
  static std::optional<ServoMove> read(WebServer& server, JsonObjectConst body);
};
