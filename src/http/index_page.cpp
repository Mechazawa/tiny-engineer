#include "http/index_page.h"

#include <LittleFS.h>

#include "http/json.h"

namespace {

const char kIndexPath[] = "/ui/index.html.gz";

const char kMissingUiHtml[] =
  "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
  "<title>Tiny Engineer</title></head><body>"
  "<h1>Web UI missing</h1>"
  "<p>The control panel lives on LittleFS. Upload the filesystem image: "
  "<code>pio run -t uploadfs</code> (or <code>pio run -e ota -t otafs</code>).</p>"
  "</body></html>";

}  // namespace

void registerUiAssetRoutes(WebServer& server) {
  // Bundler output under /ui/assets/ is content-hashed, so it never changes in place.
  server.serveStatic("/ui/assets/", LittleFS, "/ui/assets/", "max-age=31536000, immutable");
  server.serveStatic("/ui/", LittleFS, "/ui/", "no-cache");
}

void sendIndexPage(WebServer& server) {
  File page = LittleFS.open(kIndexPath, "r");

  if (!page) {
    httpSendHtml(server, 503, kMissingUiHtml);
    return;
  }

  server.sendHeader("Cache-Control", "no-cache");
  server.streamFile(page, "text/html; charset=utf-8");
  page.close();
}
