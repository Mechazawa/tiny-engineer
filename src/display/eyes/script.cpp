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

anim::EasedMove g_lookX = {};
anim::EasedMove g_lookY = {};
anim::EasedMove g_open = {1.0f, 1.0f, 0, 0, false};

bool g_posing = false;
bool g_faceShowing = false;
expressions::Expression g_face = expressions::Expression::Idle;
uint32_t g_faceStartedMs = 0;
uint32_t g_faceFrameDrawn = UINT32_MAX;

void retarget(anim::EasedMove& move, float target, uint32_t durationMs, uint32_t now) {
  anim::beginEasedMove(move, anim::easedMoveValue(move, now), target, now, durationMs);
}

Eye scriptedEye(const Eye& base, uint32_t now) {
  Eye eye = eyes::renderEye(base, anim::easedMoveValue(g_open, now));
  eye.x += static_cast<int16_t>(anim::easedMoveValue(g_lookX, now) * kLookRangeX);
  eye.y += static_cast<int16_t>(anim::easedMoveValue(g_lookY, now) * kLookRangeY);
  return eye;
}

void beginPosing() {
  g_posing = true;
  g_faceShowing = false;
  eyes::requestForceRedraw();
}

}  // namespace

void eyesLookAt(float x, float y, uint32_t durationMs, uint32_t now) {
  beginPosing();
  retarget(g_lookX, x, durationMs, now);
  retarget(g_lookY, y, durationMs, now);
}

void eyesSetOpen(float amount, uint32_t durationMs, uint32_t now) {
  beginPosing();
  retarget(g_open, amount, durationMs, now);
}

void eyesBlink(uint32_t now) {
  blinkScheduleSoon(now, 0, 0);
}

void eyesShowFace(uint8_t expression, uint32_t now) {
  g_face = static_cast<expressions::Expression>(expression);
  g_faceStartedMs = now;
  g_faceFrameDrawn = UINT32_MAX;
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

  // Faces change frame every kFrameDurationMs; skip the I2C flush in between.
  const uint32_t elapsed = now - g_faceStartedMs;
  const uint32_t frame = elapsed / expressions::kFrameDurationMs;

  if (frame != g_faceFrameDrawn || forceRedraw()) {
    drawKaomojiFrame(g_face, elapsed);
    g_faceFrameDrawn = frame;
  }

  return true;
}

void clearScript() {
  g_lookX = {0.0f, 0.0f, 0, 0, false};
  g_lookY = {0.0f, 0.0f, 0, 0, false};
  g_open = {1.0f, 1.0f, 0, 0, false};
  g_posing = false;
  g_faceShowing = false;
}

}  // namespace eyes
