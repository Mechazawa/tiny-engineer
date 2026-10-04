#pragma once

#include <cstdint>

#include "animation.h"
#include "animation/timeline.h"

// Runs a Timeline against the audio playback clock, then hands the robot back
// to the animation that was running.
class TimelinePlayer {
public:
  static const Timeline::Names& names();

  explicit TimelinePlayer(Timeline timeline);

  void advance(uint32_t playedMs);
  void finish();

private:
  Timeline timeline_;
  size_t next_ = 0;
  AnimationId previous_;

  void run(const Timeline::Step& step);
};
