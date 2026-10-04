#include "animation/timeline_player.h"

#include <Arduino.h>

#include <cmath>
#include <cstring>

#include <TinyEngineerExpressions.h>

#include "animation/registry.h"
#include "display/eyes.h"
#include "hardware/servo_wrapper.h"
#include "network/wifi_connect.h"

namespace {

const char* resolvePreset(const char* name, uint8_t& id) {
  AnimationId anim;

  if (!parseAnimationName(name, anim)) {
    return "unknown preset";
  }

  switch (anim) {
    case AnimationId::None:
    case AnimationId::Typing:
    case AnimationId::Reading:
    case AnimationId::Thinking:
    case AnimationId::Wakeup:
      id = static_cast<uint8_t>(anim);
      return nullptr;
    default:
      return "preset not available during playback";
  }
}

const char* resolveEyes(const char* name, uint8_t& id) {
  AnimationId anim;

  if (strcmp(name, "idle") == 0) {
    anim = AnimationId::None;
  } else if (!parseAnimationName(name, anim)) {
    return "unknown eye mode";
  }

  id = static_cast<uint8_t>(modeByAnimId(anim)->eyeMode);
  return nullptr;
}

const char* resolveFace(const char* name, uint8_t& id) {
  namespace expressions = tiny_engineer::expressions;

  for (uint8_t i = 0; i < expressions::kExpressionCount; i++) {
    const char* candidate = expressions::name(static_cast<expressions::Expression>(i));

    if (candidate != nullptr && strcmp(candidate, name) == 0) {
      id = i;
      return nullptr;
    }
  }

  return "unknown face";
}

const Timeline::Names kNames = {resolvePreset, resolveEyes, resolveFace};

}  // namespace

const Timeline::Names& TimelinePlayer::names() {
  return kNames;
}

TimelinePlayer::TimelinePlayer(Timeline timeline)
  : timeline_(std::move(timeline)), previous_(getAnimation()) {}

void TimelinePlayer::advance(uint32_t playedMs) {
  const auto& steps = timeline_.steps();

  while (next_ < steps.size() && steps[next_].atMs <= playedMs) {
    run(steps[next_++]);
  }
}

void TimelinePlayer::update() {
  if (!manualServos_) {
    updateAnimation();
    return;
  }

  updateAllServos();

  if (!wifiProvisioningMode()) {
    updateEyes(millis());
  }
}

void TimelinePlayer::finish() {
  setAnimationImmediately(animationIsContinuous(previous_) ? previous_ : AnimationId::None);
}

void TimelinePlayer::run(const Timeline::Step& step) {
  switch (step.kind) {
    case Timeline::Kind::Preset:
      manualServos_ = false;
      setAnimationImmediately(static_cast<AnimationId>(step.target));
      break;

    case Timeline::Kind::Eyes:
      setEyeMode(static_cast<EyeMode>(step.target), millis());
      break;

    case Timeline::Kind::Look:
      eyesLookAt(step.x, step.y, step.durationMs, millis());
      break;

    case Timeline::Kind::Open:
      eyesSetOpen(step.x, step.durationMs, millis());
      break;

    case Timeline::Kind::Blink:
      eyesBlink(millis());
      break;

    case Timeline::Kind::Face:
      eyesShowFace(step.target, millis());
      break;

    case Timeline::Kind::Move: {
      manualServos_ = true;
      ensureAllServoOutputs();

      ServoWrapper& servo = servoAt(step.target);
      float speed = SERVO_MAX_SPEED_DEG_S;

      if (step.durationMs > 0) {
        const float distance = fabsf(servoNormToDeg(step.target, step.x) - servo.angle());
        speed = fminf(SERVO_MAX_SPEED_DEG_S, fmaxf(1.0f, distance * 1000.0f / step.durationMs));
      }

      servo.setNormTarget(step.x, speed);
      break;
    }
  }
}
