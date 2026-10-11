#include "http/routes.h"

#include <uri/UriBraces.h>

#include "http/handlers.h"
#include "http/middleware.h"
#include "http/response.h"
#include "network/wifi_connect.h"
#include "web_ui.h"

namespace {

enum class Access {
  Public,
  Token,
  // Token, and refused with 503 until WiFi credentials are saved.
  Configured,
};

struct Route {
  const char* path;
  HTTPMethod method;
  void (*handler)(WebServer&);
  Access access;
};

constexpr Route kRoutes[] = {
  {"/", HTTP_GET, handleIndex, Access::Public},
  {"/animations", HTTP_GET, handleIndex, Access::Public},
  {"/servo", HTTP_GET, handleIndex, Access::Public},
  {"/tests", HTTP_GET, handleIndex, Access::Public},
  {"/api", HTTP_GET, handleIndex, Access::Public},
  {"/config", HTTP_GET, handleIndex, Access::Public},
  {"/auth", HTTP_GET, handleAuth, Access::Public},
  {"/health", HTTP_GET, handleHealth, Access::Token},
  {"/anim", HTTP_GET, handleAnimGet, Access::Configured},
  {"/anim", HTTP_POST, handleAnimPost, Access::Configured},
  {"/settings", HTTP_GET, handleSettingsGet, Access::Token},
  {"/settings", HTTP_POST, handleSettingsPost, Access::Token},
  {"/settings/reset", HTTP_POST, handleSettingsReset, Access::Token},
  {"/settings/wifi", HTTP_PUT, handleSettingsWifiPut, Access::Token},
  {"/test/audio", HTTP_POST, handleAudioTest, Access::Configured},
  {"/test/audio/bell", HTTP_POST, handleBellTest, Access::Configured},
  {"/test/screen", HTTP_POST, handleScreenTest, Access::Configured},
  {"/test/movement", HTTP_POST, handleMovementTest, Access::Configured},
  {"/test/led", HTTP_POST, handleLedTest, Access::Configured},
  {"/test/servo", HTTP_POST, handleServoTest, Access::Configured},
  {"/setup/servo", HTTP_POST, handleSetupServo, Access::Token},
  {"/setup/led", HTTP_POST, handleSetupLed, Access::Token},
  {"/setup/audio", HTTP_POST, handleSetupAudio, Access::Token},
  {"/setup/oled", HTTP_POST, handleSetupOled, Access::Token},
};

bool isPlayPath(const String& uri) {
  return uri == "/play" || uri.startsWith("/play/");
}

bool isKnownPath(const String& uri) {
  for (const Route& route : kRoutes) {
    if (uri == route.path) {
      return true;
    }
  }

  return isPlayPath(uri);
}

void registerRoute(WebServer& server, const Route& route) {
  RequestHandler& handler =
    server.on(route.path, route.method, [&server, fn = route.handler]() { fn(server); });

  if (route.access == Access::Configured) {
    handler.addMiddleware(requireWifiConfigured);
  }

  if (route.access != Access::Public) {
    handler.addMiddleware(requireApiAuth);
  }
}

void redirectToSetup(WebServer& server) {
  server.sendHeader("Location", String("http://") + wifiApIpText() + "/config", true);
  server.send(302, "text/plain", "Redirecting to setup");
}

void handleNotFound(WebServer& server) {
  if (wifiProvisioningMode() && server.method() == HTTP_GET) {
    redirectToSetup(server);
    return;
  }

  if (isKnownPath(server.uri())) {
    sendError(server, 405, "method not allowed");
    return;
  }

  sendError(server, 404, "not found");
}

}  // namespace

void handleIndex(WebServer& server) {
  if (wifiProvisioningMode() && server.uri() == "/") {
    redirectToSetup(server);
    return;
  }

  server.sendHeader("Content-Encoding", "gzip");
  server.sendHeader("Cache-Control", "no-cache");
  server.send_P(200, "text/html; charset=utf-8", reinterpret_cast<const char*>(kWebUiGzip), sizeof(kWebUiGzip));
}

void registerHttpRoutes(WebServer& server) {
  for (const Route& route : kRoutes) {
    registerRoute(server, route);
  }

  // /play runs `talking`; /play/<name> picks another animation for the clip.
  // The session checks access itself, before the body streams.
  auto onPlay = [&server](const Uri& uri) {
    server.on(
      uri,
      HTTP_POST,
      [&server]() { handlePlayDone(server); },
      [&server]() { handlePlayBody(server); }
    );
  };
  onPlay(Uri("/play"));
  onPlay(UriBraces("/play/{}"));

  server.onNotFound([&server]() { handleNotFound(server); });
}
