#pragma once

#include <WebServer.h>

// Called for each slice of the request body as it arrives.
void handlePlayBody(WebServer& server);
// Called once the whole body has been consumed.
void handlePlayDone(WebServer& server);
