#pragma once

#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

// A choreography sent alongside streamed audio: a JSON array of steps such as
// ["sleep", 500], ["preset", "typing"], ["move", "head", 0.6, 300], ["eyes", "thinking"].
// Sleeps are folded into each step's start time, measured in playback milliseconds.
// Moves do not block: moves without a sleep between them run together.
class Timeline {
public:
  enum class Kind : uint8_t {
    Preset,
    Move,
    Eyes
  };

  struct Step {
    uint32_t atMs;
    Kind kind;
    // Preset or eye-mode id from the resolver, or a servo index for Move.
    uint8_t target;
    float to;
    // Time a Move should take to arrive; 0 moves at the maximum servo speed.
    uint32_t durationMs;
  };

  // Returns nullptr and sets `id` when `name` is usable, else the reason it is not.
  using NameResolver = const char* (*)(const char* name, uint8_t& id);

  struct Names {
    NameResolver preset;
    NameResolver eyes;
  };

  static constexpr size_t kMaxSteps = 256;
  static constexpr uint32_t kMaxSleepMs = 600000;

  static std::optional<Timeline> parse(
    const char* json,
    size_t length,
    const Names& names,
    char* error,
    size_t errorSize
  );

  const std::vector<Step>& steps() const;

private:
  std::vector<Step> steps_;
};
