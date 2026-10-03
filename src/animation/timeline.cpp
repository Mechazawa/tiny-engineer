#include "animation/timeline.h"

#include <ArduinoJson.h>

#include <cstdio>
#include <cstring>
#include <strings.h>

#include "servos.h"

namespace {

bool findServo(const char* name, uint8_t& index) {
  for (uint8_t i = 0; i < SERVO_COUNT; i++) {
    if (strcasecmp(SERVO_SPECS[i].name, name) == 0) {
      index = i;
      return true;
    }
  }

  return false;
}

}  // namespace

std::optional<Timeline> Timeline::parse(
  const char* json,
  size_t length,
  const Names& names,
  char* error,
  size_t errorSize
) {
  JsonDocument doc;

  if (deserializeJson(doc, json, length) != DeserializationError::Ok || !doc.is<JsonArrayConst>()) {
    snprintf(error, errorSize, "X-Anim is not a JSON array");
    return std::nullopt;
  }

  JsonArrayConst items = doc.as<JsonArrayConst>();

  if (items.size() > kMaxSteps) {
    snprintf(error, errorSize, "anim has more than %u steps", static_cast<unsigned>(kMaxSteps));
    return std::nullopt;
  }

  Timeline timeline;
  uint32_t atMs = 0;
  size_t index = 0;

  for (JsonArrayConst item : items) {
    const char* command = item[0].as<const char*>();

    if (command == nullptr) {
      snprintf(error, errorSize, "step %u: expected [command, ...]", static_cast<unsigned>(index));
      return std::nullopt;
    }

    if (strcmp(command, "sleep") == 0) {
      if (!item[1].is<uint32_t>() || item[1].as<uint32_t>() > kMaxSleepMs) {
        snprintf(error, errorSize, "step %u: sleep needs 0..%lu ms", static_cast<unsigned>(index), static_cast<unsigned long>(kMaxSleepMs));
        return std::nullopt;
      }
      atMs += item[1].as<uint32_t>();
    } else if (strcmp(command, "preset") == 0 || strcmp(command, "eyes") == 0) {
      const bool preset = command[0] == 'p';
      const char* name = item[1].as<const char*>();
      uint8_t id = 0;
      const char* reason = name == nullptr ? "missing name" : (preset ? names.preset : names.eyes)(name, id);

      if (reason != nullptr) {
        snprintf(error, errorSize, "step %u: %s %s", static_cast<unsigned>(index), command, reason);
        return std::nullopt;
      }
      timeline.steps_.push_back({atMs, preset ? Kind::Preset : Kind::Eyes, id, 0.0f, 0});
    } else if (strcmp(command, "move") == 0) {
      const char* servo = item[1].as<const char*>();
      uint8_t servoIndex = 0;

      if (servo == nullptr || !findServo(servo, servoIndex)) {
        snprintf(error, errorSize, "step %u: unknown servo", static_cast<unsigned>(index));
        return std::nullopt;
      }
      const bool hasDuration = !item[3].isNull();
      if (!item[2].is<float>() || (hasDuration && (!item[3].is<uint32_t>() || item[3].as<uint32_t>() > kMaxSleepMs))) {
        snprintf(error, errorSize, "step %u: move needs a position -1..1 and optional duration ms", static_cast<unsigned>(index));
        return std::nullopt;
      }

      timeline.steps_.push_back({
        atMs,
        Kind::Move,
        servoIndex,
        servoSaturateNorm(item[2].as<float>()),
        hasDuration ? item[3].as<uint32_t>() : 0
      });
    } else {
      snprintf(error, errorSize, "step %u: unknown command", static_cast<unsigned>(index));
      return std::nullopt;
    }

    index++;
  }

  return timeline;
}

const std::vector<Timeline::Step>& Timeline::steps() const {
  return steps_;
}
