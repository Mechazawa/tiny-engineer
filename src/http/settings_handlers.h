#pragma once

#include <WebServer.h>
#include <WString.h>

void handleSettingsGet(WebServer& server);
void handleSettingsPost(WebServer& server);
void handleSettingsReset(WebServer& server);
void handleSettingsWifiRemove(WebServer& server);
bool isSettingsOrAnimPath(const String& uri);
