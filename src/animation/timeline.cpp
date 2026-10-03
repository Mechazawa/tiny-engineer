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

float clampTo(float value, float lo, float hi) {
  return value < lo ? lo : (value > hi ? hi : value);
}

bool isMs(JsonVariantConst value) {
  return value.is<uint32_t>() && value.as<uint32_t>() <= Timeline::kMaxSleepMs;
}

bool isOptionalMs(JsonVariantConst value) {
  return value.isNull() || isMs(value);
}

// Parses one step into `step`, or returns why it is invalid. Sleep only advances `atMs`.
const char* parseStep(JsonArrayConst item, const Timeline::Names& names, uint32_t& atMs, std::optional<Timeline::Step>& step) {
  using Kind = Timeline::Kind;

  const char* command = item[0].as<const char*>();

  if (command == nullptr) {
    return "expected [command, ...]";
  }

  if (strcmp(command, "sleep") == 0) {
    if (!isMs(item[1])) {
      return "sleep needs 0..600000 ms";
    }
    atMs += item[1].as<uint32_t>();
    return nullptr;
  }

  if (strcmp(command, "blink") == 0) {
    step = Timeline::Step{atMs, Kind::Blink, 0, 0.0f, 0.0f, 0};
    return nullptr;
  }

  if (strcmp(command, "preset") == 0 || strcmp(command, "eyes") == 0 || strcmp(command, "face") == 0) {
    const Kind kind = command[0] == 'p' ? Kind::Preset : (command[0] == 'e' ? Kind::Eyes : Kind::Face);
    const Timeline::NameResolver resolve = kind == Kind::Preset ? names.preset : (kind == Kind::Eyes ? names.eyes : names.face);
    const char* name = item[1].as<const char*>();
    uint8_t id = 0;

    if (name == nullptr) {
      return "needs a name";
    }
    if (const char* reason = resolve(name, id)) {
      return reason;
    }
    step = Timeline::Step{atMs, kind, id, 0.0f, 0.0f, 0};
    return nullptr;
  }

  if (strcmp(command, "move") == 0) {
    const char* servo = item[1].as<const char*>();
    uint8_t index = 0;

    if (servo == nullptr || !findServo(servo, index)) {
      return "unknown servo";
    }
    if (!item[2].is<float>() || !isOptionalMs(item[3])) {
      return "move needs a position -1..1 and optional duration ms";
    }
    step = Timeline::Step{atMs, Kind::Move, index, servoSaturateNorm(item[2].as<float>()), 0.0f, item[3].as<uint32_t>()};
    return nullptr;
  }

  if (strcmp(command, "look") == 0) {
    if (!item[1].is<float>() || !item[2].is<float>() || !isOptionalMs(item[3])) {
      return "look needs x and y -1..1 and optional duration ms";
    }
    step = Timeline::Step{
      atMs,
      Kind::Look,
      0,
      clampTo(item[1].as<float>(), -1.0f, 1.0f),
      clampTo(item[2].as<float>(), -1.0f, 1.0f),
      item[3].as<uint32_t>()
    };
    return nullptr;
  }

  if (strcmp(command, "open") == 0) {
    if (!item[1].is<float>() || !isOptionalMs(item[2])) {
      return "open needs an amount 0..1 and optional duration ms";
    }
    step = Timeline::Step{atMs, Kind::Open, 0, clampTo(item[1].as<float>(), 0.0f, 1.0f), 0.0f, item[2].as<uint32_t>()};
    return nullptr;
  }

  return "unknown command";
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
    snprintf(error, errorSize, "X-Anim has more than %u steps", static_cast<unsigned>(kMaxSteps));
    return std::nullopt;
  }

  Timeline timeline;
  uint32_t atMs = 0;
  unsigned index = 0;

  for (JsonArrayConst item : items) {
    std::optional<Step> step;

    if (const char* reason = parseStep(item, names, atMs, step)) {
      snprintf(error, errorSize, "step %u: %s", index, reason);
      return std::nullopt;
    }
    if (step) {
      timeline.steps_.push_back(*step);
    }
    index++;
  }

  return timeline;
}

const std::vector<Timeline::Step>& Timeline::steps() const {
  return steps_;
}
