"""Tests for the chordsheet parser and compiler in the tiny-engineer-play skill."""

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "packages/tiny-engineer-claude-code/skills/tiny-engineer-play/scripts"))

from chordsheet import (  # noqa: E402
    EYES,
    FACES,
    MAX_STEPS,
    PRESETS,
    SERVOS,
    Sheet,
    SheetError,
    align,
)


def compile_sheet(text, timings):
    return Sheet.parse(text).compile(timings)


class CompileTest(unittest.TestCase):
    def test_cues_fire_on_their_word_and_moves_lead_it(self):
        steps, _ = compile_sheet("Build [happy head:0.5/300]passed.", [([100, 600], 1000)])

        self.assertEqual(steps, [["sleep", 450], ["move", "head", 0.5, 300], ["sleep", 150], ["face", "happy"]])

    def test_trailing_cue_fires_at_the_end_and_pause_shifts_later_words(self):
        steps, _ = compile_sheet("Done. [blink]{pause: 500}[wink]Bye", [([0], 800), ([200], 400)])

        self.assertEqual(steps, [["sleep", 800], ["blink"], ["sleep", 700], ["face", "wink"]])

    def test_gestures_return_to_the_mood_resting_pose(self):
        steps, _ = compile_sheet("{mood: proud}Hi [nod]there", [([0, 1000], 1500)])
        head = [step for step in steps if step[:2] == ["move", "head"]]

        self.assertEqual(steps[0], ["face", "smug"])
        self.assertEqual(head[0], ["move", "head", 0.35, 400])
        self.assertEqual(head[-1], ["move", "head", 0.35, 200])

    def test_nested_defines_and_offsets_expand(self):
        steps, _ = compile_sheet("{define: smile = happy blink}{define: hype = smile cheer}[hype@+100]Go", [([1000], 1500)])

        self.assertIn(["face", "happy"], steps)
        self.assertIn(["blink"], steps)
        self.assertEqual(steps[0], ["sleep", 950])

    def test_a_spaced_offset_belongs_to_the_cue_before_it(self):
        steps, _ = compile_sheet("[look:-1,0/200 @+100]Hi", [([1000], 1500)])

        self.assertEqual(steps, [["sleep", 950], ["look", -1.0, 0.0, 200]])

    def test_hands_lift_toward_the_opposite_end_of_their_range(self):
        right, _ = compile_sheet("[wave]Hi", [([500], 2000)])
        left, _ = compile_sheet("[wave_left]Hi", [([500], 2000)])

        self.assertIn(["move", "hand_right", 0.8, 200], right)
        self.assertIn(["move", "hand_left", -0.8, 200], left)
        self.assertEqual(right[-1], ["move", "hand_right", -1.0, 300])

    def test_warns_when_a_later_step_clears_the_face(self):
        _, warnings = compile_sheet("[happy]Look [look:-1,0]left", [([0, 500], 1000)])

        self.assertEqual(len(warnings), 1)
        self.assertIn("look clears the face", warnings[0])


class ParseErrorTest(unittest.TestCase):
    def assertSheetError(self, text, column, fragment):
        with self.assertRaises(SheetError) as caught:
            Sheet.parse(text)
        self.assertEqual(caught.exception.column, column)
        self.assertIn(fragment, str(caught.exception))

    def test_reports_unknown_names_with_a_suggestion(self):
        self.assertSheetError("Hi [hapy]there", 5, "did you mean 'happy'")
        self.assertSheetError("Hi [eyes:thinkin]there", 5, "did you mean 'thinking'")
        self.assertSheetError("{mod: happy}Hi", 1, "did you mean 'mood'")

    def test_points_at_the_failing_cue_inside_a_group(self):
        self.assertSheetError("Hi [happy hed:0.2]there", 11, "did you mean 'head'")

    def test_rejects_out_of_range_values_and_gesture_durations(self):
        self.assertSheetError("[head:1.5]Hi", 2, "outside -1..1")
        self.assertSheetError("[look:0.5]Hi", 2, "look needs x,y")
        self.assertSheetError("[nod/300]Hi", 2, "own timing")


class AlignTest(unittest.TestCase):
    def test_words_spoken_differently_take_the_next_known_start(self):
        spoken = [["It", 0], ["is", 200], ["forty-two", 400], ["percent", 900], ["done", 1500]]

        self.assertEqual(align(["It", "is", "42%", "done!"], spoken), [0, 200, 1500, 1500])

    def test_punctuation_only_words_follow_the_next_word(self):
        self.assertEqual(align(["Wait", "-", "what"], [["Wait", 0], ["what", 600]]), [0, 600, 600])


class FirmwareParityTest(unittest.TestCase):
    """chordsheet.py ships without the repo, so it mirrors these names; keep the copies in step."""

    def source(self, path):
        return (ROOT / path).read_text()

    def test_faces_match_the_expression_manifest(self):
        manifest = json.loads(self.source("scripts/expressions/manifest.json"))
        self.assertEqual(list(FACES), [expression["id"] for expression in manifest["expressions"]])

    def test_servos_match_the_firmware(self):
        names = re.findall(r'\{"([A-Z_]+)",\s*SERVO_', self.source("include/servos.h"))
        self.assertEqual(list(SERVOS), [name.lower() for name in names])

    def test_step_limit_matches_the_firmware(self):
        self.assertIn(f"kMaxSteps = {MAX_STEPS};", self.source("src/animation/timeline.h"))

    def test_presets_match_what_the_firmware_allows(self):
        player = self.source("src/animation/timeline_player.cpp")
        allowed = player[player.index("resolvePreset"):player.index("default:")]
        self.assertEqual(sorted(PRESETS), sorted(name.lower() for name in re.findall(r"AnimationId::(\w+):", allowed)))

    def test_eye_modes_are_animation_names(self):
        names = set(re.findall(r'^    "(\w+)",$', self.source("src/animation/registry.cpp"), re.MULTILINE)) - {"scripted"}
        self.assertLessEqual(set(EYES) - {"idle"}, names)


if __name__ == "__main__":
    unittest.main()
