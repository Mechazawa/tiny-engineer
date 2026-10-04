#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "kokoro>=0.9.4",
#     "transformers>=4.45",
#     "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
# ]
# ///
"""Speak text with Kokoro in the robot's voice and print word timings for a /play timeline."""

import argparse
import json
import os
import subprocess
import sys
import warnings

import espeakng_loader

warnings.simplefilter("ignore")
os.environ.setdefault("HF_HUB_VERBOSITY", "error")

# The bundled espeak-ng library looks for its data at the path it was built in.
os.environ.setdefault("ESPEAK_DATA_PATH", espeakng_loader.get_data_path())

import numpy  # noqa: E402
from kokoro import KPipeline  # noqa: E402

KOKORO_RATE = 24000

# Band-limited "can" resonance, blended with a 60 Hz ring modulator and a bitcrushed flanger.
ROBOT_FILTER = (
    "[0:a]highpass=f=320,lowpass=f=3400,asplit=3[a][b][c];"
    "[a]aecho=0.8:0.7:6|11:0.45|0.3,acompressor=threshold=0.1:ratio=6[can];"
    f"sine=f=60:r={KOKORO_RATE}[carrier];[b][carrier]amultiply,volume=2[ring];"
    "[c]acrusher=bits=6:mode=log:aa=1:samples=2,flanger=delay=2:depth=1:speed=0.3[crush];"
    "[can][ring][crush]amix=inputs=3:weights=1 0.6 0.7:duration=first,"
    "loudnorm=I=-15:TP=-1:LRA=7[out]"
)
PLAIN_FILTER = "[0:a]loudnorm=I=-15:TP=-1:LRA=7[out]"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("text")
    parser.add_argument("-o", "--output", default="/tmp/te-clip.wav")
    parser.add_argument("--voice", default="am_michael", help="Kokoro voice; the first letter picks the accent (a = US, b = UK)")
    parser.add_argument("--speed", type=float, default=1.0)
    parser.add_argument("--rate", type=int, default=22050, help="the robot's sample rate")
    parser.add_argument("--plain", action="store_true", help="skip the robot filter")
    return parser.parse_args()


def synthesize(text, voice, speed):
    """Return the audio and [word, start_ms] pairs, offset across Kokoro's chunks."""
    pipeline = KPipeline(lang_code=voice[0], repo_id="hexgrad/Kokoro-82M")
    chunks = []
    words = []
    offset_ms = 0

    for result in pipeline(text, voice=voice, speed=speed):
        audio = result.audio.numpy()
        words += [
            [token.text, offset_ms + round(token.start_ts * 1000)]
            for token in result.tokens or []
            if token.start_ts is not None and any(char.isalnum() for char in token.text)
        ]
        chunks.append(audio)
        offset_ms += round(len(audio) * 1000 / KOKORO_RATE)

    return numpy.concatenate(chunks), words


def write_wav(audio, path, rate, plain):
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "f32le", "-ar", str(KOKORO_RATE), "-ac", "1", "-i", "-",
            "-filter_complex", PLAIN_FILTER if plain else ROBOT_FILTER,
            "-map", "[out]", "-ar", str(rate), "-ac", "1", "-c:a", "pcm_s16le", path,
        ],
        input=audio.astype(numpy.float32).tobytes(),
        check=True,
    )


def main():
    args = parse_args()
    audio, words = synthesize(args.text, args.voice, args.speed)
    if not words:
        sys.exit("Kokoro produced no speech for that text")

    write_wav(audio, args.output, args.rate, args.plain)
    duration_ms = round(len(audio) * 1000 / KOKORO_RATE)
    print(json.dumps({"wav": args.output, "duration_ms": duration_ms, "words": words}))


if __name__ == "__main__":
    main()
