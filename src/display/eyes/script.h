#pragma once

#include <cstdint>

#include "display/eyes.h"

namespace eyes {

// Overwrites the eye rects when a scripted look or open is active.
bool applyScriptPose(Eye& left, Eye& right, uint32_t now);
// Draws the scripted face, if one is showing.
bool drawScriptFace(uint32_t now);
void clearScript();

}  // namespace eyes
