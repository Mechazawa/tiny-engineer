#include "http/play_handlers.h"

#include <Arduino.h>

#include <cstdio>
#include <optional>

#include "animation/timeline.h"
#include "animation/timeline_player.h"
#include "audio/audio.h"
#include "audio/wav_parser.h"
#include "http/json.h"
#include "pins.h"
#include "robot_tick.h"
#include "sleep.h"
#include "settings/settings.h"
#include "serial_log.h"

namespace {

// One POST /play request. loop() is blocked while the body streams, so the
// session runs tickRobot() between speaker writes.
class PlaySession : public WavStreamParser::Sink {
public:
  void begin(WebServer& server) {
    parser_.reset();
    player_.reset();
    rejectCode_ = 0;

    if (!settingsWifiConfigured()) {
      reject(503, "wifi not configured");
      return;
    }

    if (!httpApiAuthorized(server)) {
      reject(401, "unauthorized");
      return;
    }

    stopAllWavPlayback();
    parser_.emplace(SAMPLE_RATE, *this);
    serialLogPrintln("[play] start");

    const String& header = server.header("X-Anim");

    if (header.length() == 0) {
      return;
    }

    std::optional<Timeline> timeline = Timeline::parse(header.c_str(), header.length(), TimelinePlayer::names(), error_, sizeof(error_));

    if (!timeline) {
      reject(400, error_);
      return;
    }

    player_.emplace(std::move(*timeline));
    player_->advance(0);
  }

  void feed(const uint8_t* bytes, size_t length) {
    if (rejectCode_ == 0 && parser_) {
      parser_->feed(bytes, length);
    }
  }

  void end() {
    if (parser_) {
      parser_->finish();
      serialLogPrint("[play] end ms=");
      serialLogPrintln(playedMs());
    }

    if (player_) {
      player_->finish();
      player_.reset();
    }
  }

  void respond(WebServer& server) {
    if (rejectCode_ != 0) {
      httpSendJson(server, rejectCode_, body_);
      return;
    }

    if (parser_->failed()) {
      formatError(parser_->error());
      httpSendJson(server, 415, body_);
      return;
    }

    snprintf(body_, sizeof(body_), "{\"ok\":true,\"played_ms\":%lu}", static_cast<unsigned long>(playedMs()));
    httpSendJson(server, 200, body_);
  }

  void onPcm(const int16_t* samples, size_t count) override {
    writeMonoToSpeaker(samples, count);

    if (player_) {
      player_->advance(playedMs());
    }

    noteActivity(millis());
    tickRobot();
  }

private:
  std::optional<WavStreamParser> parser_;
  std::optional<TimelinePlayer> player_;
  int rejectCode_ = 0;
  char error_[96] = {};
  char body_[128] = {};

  void reject(int code, const char* message) {
    rejectCode_ = code;
    formatError(message);
  }

  void formatError(const char* message) {
    snprintf(body_, sizeof(body_), "{\"ok\":false,\"error\":\"%s\"}", message);
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
