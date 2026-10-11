#include <Arduino.h>

#include "animation.h"
#include "audio/audio.h"
#include "display/oled.h"
#include "hardware/pca9685_servos.h"
#include "hardware/rgb.h"
#include "http/handlers.h"
#include "http/request.h"
#include "http/response.h"
#include "servos.h"

namespace {

// Every test leaves the OLED on its idle screen before it answers.
void finishTest(WebServer& server, const char* test) {
  showIdleScreen();

  JsonDocument body;
  body["ok"] = true;
  body["test"] = test;
  sendJson(server, 200, body);
}

}  // namespace

void handleAudioTest(WebServer& server) {
  runSoundTest();
  finishTest(server, "audio");
}

void handleBellTest(WebServer& server) {
  if (!playBell()) {
    showIdleScreen();
    sendError(server, 500, "bell playback failed");
    return;
  }

  finishTest(server, "bell");
}

void handleScreenTest(WebServer& server) {
  runOledTest();
  finishTest(server, "screen");
}

void handleMovementTest(WebServer& server) {
  runServoTest();
  finishTest(server, "movement");
}

void handleLedTest(WebServer& server) {
  runRgbTest();
  setRgbForAnimation(getAnimation(), millis());
  finishTest(server, "led");
}

void handleServoTest(WebServer& server) {
  const std::optional<ServoMove> move = ServoMove::read(server);

  if (!move) {
    return;
  }

  if (!moveServoSmooth(move->index, move->angle)) {
    sendError(server, 400, "index out of range");
    return;
  }

  showIdleScreen();

  JsonDocument body;
  body["ok"] = true;
  body["test"] = "servo";
  body["index"] = move->index;
  body["angle"] = move->angle;
  sendJson(server, 200, body);
}
