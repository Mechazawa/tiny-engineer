#include "animation/timeline_player.h"

#include <Arduino.h>

#include <cmath>
#include <cstring>

#include "animation/registry.h"
#include "display/eyes.h"
#include "hardware/servo_wrapper.h"
#include "network/wifi_connect.h"

namespace {

const char* resolvePreset(const char* name, uint8_t& id) {
  AnimationId anim;

  if (!parseAnimationName(name, anim)) {
    return "unknown name";
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
      return "not available during playback";
  }
}

const char* resolveEyes(const char* name, uint8_t& id) {
  AnimationId anim;

  if (strcmp(name, "idle") == 0) {
    anim = AnimationId::None;
  } else if (!parseAnimationName(name, anim)) {
    return "unknown name";
  }

  id = static_cast<uint8_t>(modeByAnimId(anim)->eyeMode);
  return nullptr;
}

const Timeline::Names kNames = {resolvePreset, resolveEyes};

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

    case Timeline::Kind::Move: {
      manualServos_ = true;
      ensureAllServoOutputs();

      ServoWrapper& servo = servoAt(step.target);
      float speed = SERVO_MAX_SPEED_DEG_S;

      if (step.durationMs > 0) {
        const float distance = fabsf(servoNormToDeg(step.target, step.to) - servo.angle());
        speed = fminf(SERVO_MAX_SPEED_DEG_S, fmaxf(1.0f, distance * 1000.0f / step.durationMs));
      }

      servo.setNormTarget(step.to, speed);
      break;
    }
  }
}
