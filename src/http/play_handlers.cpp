#include "http/play_handlers.h"

#include <Arduino.h>

#include <cstdio>
#include <optional>

#include "animation.h"
#include "audio/audio.h"
#include "audio/wav_parser.h"
#include "hardware/rgb.h"
#include "http/json.h"
#include "pins.h"
#include "settings/settings.h"
#include "serial_log.h"

namespace {

// One POST /play request. loop() is blocked while the body streams, so the
// session keeps animation, eyes and LED moving between speaker writes.
class PlaySession : public WavStreamParser::Sink {
public:
  void begin(WebServer& server) {
    parser_.reset();
    rejectCode_ = 0;

    if (!settingsWifiConfigured()) {
      reject(503, "{\"ok\":false,\"error\":\"wifi not configured\"}");
      return;
    }

    if (!httpApiAuthorized(server)) {
      reject(401, "{\"ok\":false,\"error\":\"unauthorized\"}");
      return;
    }

    stopAllWavPlayback();
    parser_.emplace(SAMPLE_RATE, *this);
    serialLogPrintln("[play] start");
  }

  void feed(const uint8_t* bytes, size_t length) {
    if (parser_ && !parser_->failed()) {
      parser_->feed(bytes, length);
    }
  }

  void end() {
    if (parser_) {
      parser_->finish();
      serialLogPrint("[play] end ms=");
      serialLogPrintln(playedMs());
    }
  }

  void respond(WebServer& server) {
    if (rejectCode_ != 0) {
      httpSendJson(server, rejectCode_, rejectBody_);
      return;
    }

    char body[96];

    if (parser_->failed()) {
      snprintf(body, sizeof(body), "{\"ok\":false,\"error\":\"%s\"}", parser_->error());
      httpSendJson(server, 415, body);
      return;
    }

    snprintf(body, sizeof(body), "{\"ok\":true,\"played_ms\":%lu}", static_cast<unsigned long>(playedMs()));
    httpSendJson(server, 200, body);
  }

  void onPcm(const int16_t* samples, size_t count) override {
    writeMonoToSpeaker(samples, count);
    updateAnimation();
    updateRgb(millis());
  }

private:
  std::optional<WavStreamParser> parser_;
  int rejectCode_ = 0;
  const char* rejectBody_ = nullptr;

  void reject(int code, const char* body) {
    rejectCode_ = code;
    rejectBody_ = body;
  }

  uint32_t playedMs() const {
    return static_cast<uint32_t>(parser_->samplesDelivered() * 1000ULL / SAMPLE_RATE);
  }
};

PlaySession g_session;

}  // namespace

void handlePlayBody(WebServer& server) {
  HTTPRaw& raw = server.raw();

  switch (raw.status) {
    case RAW_START:
      g_session.begin(server);
      break;
    case RAW_WRITE:
      g_session.feed(raw.buf, raw.currentSize);
      break;
    case RAW_END:
    case RAW_ABORTED:
      g_session.end();
      break;
  }
}

void handlePlayDone(WebServer& server) {
  g_session.respond(server);
}
