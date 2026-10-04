#include "display/eyes/script.h"

#include "animation/util.h"
#include "display/eyes/core/blink.h"
#include "display/eyes/core/constants.h"
#include "display/eyes/core/internal.h"
#include "display/eyes/core/util.h"
#include "display/eyes/styles/kaomoji.h"

namespace {

namespace expressions = tiny_engineer::expressions;

// Gaze offset at -1 or +1, in pixels; keeps both eyes on the 128x32 panel.
constexpr float kLookRangeX = 16.0f;
constexpr float kLookRangeY = 8.0f;

struct Tween {
  float from;
  float to;
  uint32_t startMs;
  uint32_t durationMs;

  float at(uint32_t now) const {
    const float t = anim::easeInOutCubic(eyes::moveProgress(now, startMs, durationMs));
    return from + (to - from) * t;
  }

  void retarget(float target, uint32_t durationMs_, uint32_t now) {
    from = at(now);
    to = target;
    startMs = now;
    durationMs = durationMs_;
  }
};

bool g_posing = false;
Tween g_lookX = {0.0f, 0.0f, 0, 0};
Tween g_lookY = {0.0f, 0.0f, 0, 0};
Tween g_open = {1.0f, 1.0f, 0, 0};

bool g_faceShowing = false;
expressions::Expression g_face = expressions::Expression::Idle;
uint32_t g_faceStartedMs = 0;

Eye scriptedEye(const Eye& base, uint32_t now) {
  const int16_t height = static_cast<int16_t>(base.height * g_open.at(now));

  return {
    static_cast<int16_t>(base.x + g_lookX.at(now) * kLookRangeX),
    static_cast<int16_t>(base.y + g_lookY.at(now) * kLookRangeY + (base.height - height) / 2),
    base.width,
    height
  };
}

void beginPosing() {
  if (!g_posing) {
    g_lookX = {0.0f, 0.0f, 0, 0};
    g_lookY = {0.0f, 0.0f, 0, 0};
    g_open = {1.0f, 1.0f, 0, 0};
    g_posing = true;
  }

  g_faceShowing = false;
  eyes::requestForceRedraw();
}

}  // namespace

void eyesLookAt(float x, float y, uint32_t durationMs, uint32_t now) {
  beginPosing();
  g_lookX.retarget(x, durationMs, now);
  g_lookY.retarget(y, durationMs, now);
}

void eyesSetOpen(float amount, uint32_t durationMs, uint32_t now) {
  beginPosing();
  g_open.retarget(amount, durationMs, now);
}

void eyesBlink(uint32_t now) {
  blinkScheduleSoon(now, 0, 0);
}

void eyesShowFace(uint8_t expression, uint32_t now) {
  g_face = static_cast<expressions::Expression>(expression);
  g_faceStartedMs = now;
  g_faceShowing = true;
  eyes::requestForceRedraw();
}

namespace eyes {

bool applyScriptPose(Eye& left, Eye& right, uint32_t now) {
  if (!g_posing) {
    return false;
  }

  left = scriptedEye(DEFAULT_LEFT, now);
  right = scriptedEye(DEFAULT_RIGHT, now);
  return true;
}

bool drawScriptFace(uint32_t now) {
  if (!g_faceShowing) {
    return false;
  }

  drawKaomojiFrame(g_face, now - g_faceStartedMs);
  return true;
}

void clearScript() {
  g_posing = false;
  g_faceShowing = false;
}

}  // namespace eyes
