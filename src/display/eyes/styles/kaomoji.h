#pragma once

#include <cstdint>

#include <TinyEngineerExpressions.h>

// Reset kaomoji face playback so the next draw starts at frame 0.
void kaomojiResetPlayback(uint32_t now);

void drawKaomojiFrame(tiny_engineer::expressions::Expression expression, uint32_t elapsedMs);
