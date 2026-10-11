#pragma once

#include <WebServer.h>

bool httpApiAuthorized(WebServer& server);

// Route middleware: each answers with a JSON error and stops the chain when its check fails.
bool requireApiAuth(WebServer& server, Middleware::Callback next);
bool requireWifiConfigured(WebServer& server, Middleware::Callback next);
