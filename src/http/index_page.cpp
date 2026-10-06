#include "http/index_page.h"

#include <LittleFS.h>

#include "firmware_version.h"
#include "http/json.h"

namespace {

const char kIndexPath[] = "/ui/index.html.gz";
const char kVersionPath[] = "/ui/version.txt";

String uiVersion() {
  File file = LittleFS.open(kVersionPath, "r");

  if (!file) {
    return "unknown";
  }

  String version = file.readString();
  file.close();
  version.trim();
  return version;
}

void sendUiUnavailable(WebServer& server, const String& heading, const String& detail) {
  const String html =
    String("<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">") +
    "<title>Tiny Engineer</title></head><body><h1>" + heading + "</h1><p>" + detail +
    "</p><p>Flash firmware and filesystem from the same build: "
    "<code>pio run -t upload</code> over USB, or <code>pio run -e ota -t ota</code> over Wi-Fi.</p>"
    "</body></html>";

  httpSendHtml(server, 503, html.c_str());
}

}  // namespace

void registerUiAssetRoutes(WebServer& server) {
  // Bundler output under /ui/assets/ is content-hashed, so it never changes in place.
  server.serveStatic("/ui/assets/", LittleFS, "/ui/assets/", "max-age=31536000, immutable");
  server.serveStatic("/ui/", LittleFS, "/ui/", "no-cache");
}

void sendIndexPage(WebServer& server) {
  File page = LittleFS.open(kIndexPath, "r");

  if (!page) {
    sendUiUnavailable(server, "Web UI missing", "The control panel lives on LittleFS and was not found.");
    return;
  }

  // A UI from another build may call routes or params this firmware does not have.
  const String version = uiVersion();

  if (version != FW_VERSION) {
    page.close();
    sendUiUnavailable(
      server,
      "Web UI does not match firmware",
      String("Firmware <code>") + FW_VERSION + "</code>, web UI <code>" + version + "</code>."
    );
    return;
  }

  server.sendHeader("Cache-Control", "no-cache");
  server.streamFile(page, "text/html; charset=utf-8");
  page.close();
}
