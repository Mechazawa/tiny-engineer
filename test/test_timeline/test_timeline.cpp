#include <unity.h>

#include <cstring>
#include <string>

#include "animation/timeline.h"

namespace {

const char* resolvePreset(const char* name, uint8_t& id) {
  if (strcmp(name, "typing") == 0) {
    id = 7;
    return nullptr;
  }
  return strcmp(name, "ring") == 0 ? "plays its own audio" : "unknown";
}

const char* resolveEyes(const char* name, uint8_t& id) {
  id = 3;
  return strcmp(name, "thinking") == 0 ? nullptr : "unknown";
}

const Timeline::Names kNames = {resolvePreset, resolveEyes};

char g_error[96];

std::optional<Timeline> parse(const std::string& json) {
  g_error[0] = '\0';
  return Timeline::parse(json.data(), json.size(), kNames, g_error, sizeof(g_error));
}

}  // namespace

void test_sleeps_set_start_times_and_moves_share_them() {
  const auto timeline = parse(
    R"([["preset","typing"],["sleep",500],["move","head",0.5,300],["move","neck",-0.5],["sleep",250],["eyes","thinking"]])"
  );

  TEST_ASSERT_TRUE(timeline.has_value());
  const auto& steps = timeline->steps();
  TEST_ASSERT_EQUAL_size_t(4, steps.size());
  TEST_ASSERT_EQUAL_UINT32(0, steps[0].atMs);
  TEST_ASSERT_EQUAL_UINT8(7, steps[0].target);
  TEST_ASSERT_EQUAL_UINT32(500, steps[1].atMs);
  TEST_ASSERT_EQUAL_UINT32(500, steps[2].atMs);
  TEST_ASSERT_EQUAL_UINT32(750, steps[3].atMs);
  TEST_ASSERT_TRUE(steps[3].kind == Timeline::Kind::Eyes);
}

void test_move_resolves_servo_and_clamps_position() {
  const auto timeline = parse(R"([["move","HAND_RIGHT",3,200],["move","body",-0.25]])");

  TEST_ASSERT_TRUE(timeline.has_value());
  const auto& steps = timeline->steps();
  TEST_ASSERT_EQUAL_UINT8(3, steps[0].target);
  TEST_ASSERT_EQUAL_FLOAT(1.0f, steps[0].to);
  TEST_ASSERT_EQUAL_UINT32(200, steps[0].durationMs);
  TEST_ASSERT_EQUAL_UINT8(4, steps[1].target);
  TEST_ASSERT_EQUAL_UINT32(0, steps[1].durationMs);
}

void test_resolver_reason_is_reported_with_step_index() {
  TEST_ASSERT_FALSE(parse(R"([["sleep",10],["preset","ring"]])").has_value());
  TEST_ASSERT_EQUAL_STRING("step 1: preset plays its own audio", g_error);
}

void test_rejects_malformed_steps() {
  TEST_ASSERT_FALSE(parse(R"({"preset":"typing"})").has_value());
  TEST_ASSERT_EQUAL_STRING("X-Anim is not a JSON array", g_error);

  TEST_ASSERT_FALSE(parse(R"([["wiggle"]])").has_value());
  TEST_ASSERT_EQUAL_STRING("step 0: unknown command", g_error);

  TEST_ASSERT_FALSE(parse(R"([["move","tail",0.1]])").has_value());
  TEST_ASSERT_EQUAL_STRING("step 0: unknown servo", g_error);

  TEST_ASSERT_FALSE(parse(R"([["move","head"]])").has_value());
  TEST_ASSERT_FALSE(parse(R"([["move","head",0.2,-5]])").has_value());
  TEST_ASSERT_FALSE(parse(R"([["sleep",-1]])").has_value());
  TEST_ASSERT_FALSE(parse(R"([["sleep",600001]])").has_value());
}

void test_rejects_too_many_steps() {
  std::string json = "[";
  for (size_t i = 0; i <= Timeline::kMaxSteps; i++) {
    json += i == 0 ? "[\"sleep\",1]" : ",[\"sleep\",1]";
  }
  json += "]";

  TEST_ASSERT_FALSE(parse(json).has_value());
}

int main(int, char**) {
  UNITY_BEGIN();
  RUN_TEST(test_sleeps_set_start_times_and_moves_share_them);
  RUN_TEST(test_move_resolves_servo_and_clamps_position);
  RUN_TEST(test_resolver_reason_is_reported_with_step_index);
  RUN_TEST(test_rejects_malformed_steps);
  RUN_TEST(test_rejects_too_many_steps);
  return UNITY_END();
}
