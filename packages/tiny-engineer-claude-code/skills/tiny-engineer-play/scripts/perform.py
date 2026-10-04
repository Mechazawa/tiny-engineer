#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "kokoro>=0.9.4",
#     "transformers>=4.45",
#     "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
# ]
# ///
"""Speak a chordsheet in the robot's voice and play it with its cues: one string in, one performance out."""

import argparse
import json
import subprocess
import sys
from pathlib import Path

import numpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import chordsheet  # noqa: E402
import say  # noqa: E402


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", nargs="?", help="the chordsheet; omit to read it from stdin")
    parser.add_argument("-o", "--output", default="/tmp/te-perform.wav")
    parser.add_argument("--voice", default="am_michael")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--rate", type=int, default=22050, help="the robot's sample rate")
    parser.add_argument("--plain", action="store_true", help="skip the robot filter")
    parser.add_argument("--url", help="robot base URL (default: TINY_ENGINEER_URL)")
    parser.add_argument("--check", action="store_true", help="only validate the sheet; no speech, nothing sent")
    parser.add_argument("--dry-run", action="store_true", help="make the clip and timeline but do not send them")
    return parser.parse_args()


def speak(sheet, voice, speed):
    """Synthesize each segment, join them with their pauses, and return the audio and per-segment timings."""
    pipeline = say.load_pipeline(voice)
    parts, timings = [], []

    for segment in sheet.segments:
        if segment.words:
            audio, spoken, duration_ms = say.synthesize(pipeline, segment.text, voice, speed)
            parts.append(audio)
            timings.append((chordsheet.align(segment.words, spoken), duration_ms))
        else:
            timings.append(([], 0))
        parts.append(numpy.zeros(round(segment.pause_after_ms * say.KOKORO_RATE / 1000), dtype=numpy.float32))

    return numpy.concatenate(parts), timings


def main():
    args = parse_args()
    text = args.sheet if args.sheet is not None else sys.stdin.read()

    try:
        sheet = chordsheet.Sheet.parse(text)
    except chordsheet.SheetError as error:
        sys.exit(str(error))

    if args.check:
        print(json.dumps({"ok": True, "segments": len(sheet.segments)}))
        return

    audio, timings = speak(sheet, args.voice, args.speed)
    try:
        steps, warnings = sheet.compile(timings)
    except chordsheet.SheetError as error:
        sys.exit(str(error))

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)

    say.write_wav(audio, args.output, args.rate, args.plain)
    anim = json.dumps(steps, separators=(",", ":"))

    if args.dry_run:
        duration_ms = round(len(audio) * 1000 / say.KOKORO_RATE)
        print(json.dumps({"wav": args.output, "duration_ms": duration_ms, "anim": steps}))
        return

    command = [str(HERE / "play"), args.output, "--anim", anim]
    if args.url:
        command += ["--url", args.url]
    sys.exit(subprocess.run(command, check=False).returncode)


if __name__ == "__main__":
    main()
