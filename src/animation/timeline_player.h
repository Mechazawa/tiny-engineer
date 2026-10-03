#pragma once

#include <cstdint>

#include "animation.h"
#include "animation/timeline.h"

// Runs a Timeline against the audio playback clock while loop() is blocked by
// the stream, then hands the robot back to the animation that was running.
class TimelinePlayer {
public:
  static const Timeline::Names& names();

  explicit TimelinePlayer(Timeline timeline);

  void advance(uint32_t playedMs);
  void update();
  void finish();

private:
  Timeline timeline_;
  size_t next_ = 0;
  // A move takes the joints away from the preset until the next preset step.
  bool manualServos_ = false;
  AnimationId previous_;

  void run(const Timeline::Step& step);
};
