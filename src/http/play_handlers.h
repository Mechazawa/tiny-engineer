#pragma once

#include <WebServer.h>

// Called for each slice of the request body as it arrives. `named` is true on
// the /play/{name} route; pathArg() asserts on a route without path arguments.
void handlePlayBody(WebServer& server, bool named);
// Called once the whole body has been consumed.
void handlePlayDone(WebServer& server);
