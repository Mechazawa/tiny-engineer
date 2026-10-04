#pragma once

#include <stdint.h>

// EyeMode::Scripted: gaze and lids driven by POST /play look/open steps.
void startScriptedEyes(uint32_t now);
void updateScriptedEyes(uint32_t now);

namespace eyes {

// A scripted face replaces the eyes in every style until the next setEyeMode().
bool drawScriptFace(uint32_t now);
void clearScriptFace();

}  // namespace eyes
