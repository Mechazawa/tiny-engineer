#include "http/middleware.h"

#include "http/response.h"
#include "settings/settings.h"

bool httpApiAuthorized(WebServer& server) {
  return !settingsAccessTokenSet() ||
         server.header("Authorization") == String("Bearer ") + settingsAccessToken();
}

bool requireApiAuth(WebServer& server, Middleware::Callback next) {
  if (!httpApiAuthorized(server)) {
    sendError(server, 401, "unauthorized");
    return true;
  }

  return next();
}

bool requireWifiConfigured(WebServer& server, Middleware::Callback next) {
  if (!settingsWifiConfigured()) {
    sendError(server, 503, "wifi not configured");
    return true;
  }

  return next();
}
