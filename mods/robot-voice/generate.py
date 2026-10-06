#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10,<3.13"
# dependencies = [
#     "kokoro>=0.9.4",
#     "transformers>=4.45",
#     "en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl",
# ]
# ///
"""Render the robot-voice clips and their .cue phrase marks into assets/."""

import os
import subprocess
import warnings
from pathlib import Path

import numpy

KOKORO_RATE = 24000
OUTPUT_RATE = 44100
VOICE = {"am_fenrir": 0.5, "am_onyx": 0.5}
SILENCE_THRESHOLD = 0.01
TAIL_MS = 150
BLINK_MS = 60

ROBOT_FILTER = (
    "[0:a]highpass=f=320,lowpass=f=3400,asplit=3[a][b][c];"
    "[a]aecho=0.8:0.7:6|11:0.45|0.3,acompressor=threshold=0.1:ratio=6[can];"
    f"sine=f=60:r={KOKORO_RATE}[carrier];[b][carrier]amultiply,volume=2[ring];"
    "[c]acrusher=bits=6:mode=log:aa=1:samples=2,flanger=delay=2:depth=1:speed=0.3[crush];"
    "[can][ring][crush]amix=inputs=3:weights=1 0.6 0.7:duration=first,"
    "loudnorm=I=-15:TP=-1:LRA=7[out]"
)

# Each clip is spoken segments with the silence that follows them. A mark is
# (edge, word): the start or end of the first word matching `word`, counted in order.
CLIPS = {
    "welcome": {
        "segments": [("Hello, human!", 450), ("What are we building today?", 0)],
        "marks": {
            "greeting_end_ms": ("end", "human"),
            "pause_end_ms": ("start", "what"),
            "question_end_ms": ("end", "today"),
        },
        "blink": ("greeting_end_ms", "pause_end_ms"),
    },
    "attention": {
        "segments": [("Psst!", 150), ("Human!", 250), ("I might want to take a look.", 0)],
        "marks": {
            "pst_end_ms": ("end", "psst"),
            "human_end_ms": ("end", "human"),
        },
        "blink": ("pst_end_ms", "human_end_ms"),
    },
    "error": {
        "segments": [("Uh-oh,", 120), ("human!", 200), ("We have a problem!", 0)],
        "marks": {
            "uhoh_end_ms": ("end", "uhoh"),
            "human_end_ms": ("end", "human"),
            "problem_end_ms": ("end", "problem"),
        },
    },
    "abort": {
        "segments": [("Fine!", 200), ("I didn't want to finish that anyway!", 0)],
        "marks": {
            "fine_end_ms": ("end", "fine"),
            "didnt_want_end_ms": ("end", "want"),
            "finish_end_ms": ("end", "finish"),
        },
    },
    "dead": {
        "segments": [("Insufficient resources.", 250), ("Shutting down.", 0)],
        "marks": {
            "shutdown_ms": ("start", "shutting"),
        },
        # The eyes flicker harder just before the shutdown beat.
        "dense_before_shutdown_ms": 300,
        "tape_stop_from": "shutting",
    },
}


def load_pipeline():
    import espeakng_loader

    warnings.simplefilter("ignore")
    os.environ.setdefault("HF_HUB_VERBOSITY", "error")
    # The bundled espeak-ng library looks for its data at the path it was built in.
    os.environ.setdefault("ESPEAK_DATA_PATH", espeakng_loader.get_data_path())
    from kokoro import KPipeline

    pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    voice = sum(pipeline.load_single_voice(name) * weight for name, weight in VOICE.items())
    return pipeline, voice


def normalize_word(text):
    return "".join(char for char in text.lower() if char.isalnum())


def speak(pipeline, voice, text):
    """Audio trimmed to its speech, plus (word, start_s, end_s) relative to the trimmed start."""
    chunks = []
    words = []
    offset = 0.0
    for result in pipeline(text, voice=voice):
        audio = result.audio.numpy()
        words += [
            (normalize_word(token.text), offset + token.start_ts, offset + token.end_ts)
            for token in result.tokens or []
            if token.start_ts is not None and normalize_word(token.text)
        ]
        chunks.append(audio)
        offset += len(audio) / KOKORO_RATE

    audio = numpy.concatenate(chunks)
    voiced = numpy.flatnonzero(numpy.abs(audio) > SILENCE_THRESHOLD)
    lead = voiced[0] / KOKORO_RATE
    audio = audio[voiced[0]:voiced[-1] + 1]
    return audio, [(word, start - lead, min(end - lead, len(audio) / KOKORO_RATE)) for word, start, end in words]


def tape_stop(audio, start_s):
    """Slow the audio from `start_s` to the end like a tape losing power, dropping speed and pitch together."""
    start = int(start_s * KOKORO_RATE)
    tail = audio[start:]
    # Read position advances at a rate falling from 1.0 to 0.3; the tail gets longer and lower.
    steps = numpy.linspace(1.0, 0.3, int(len(tail) / 0.6))
    positions = numpy.cumsum(steps)
    positions = positions[positions < len(tail) - 1]
    slowed = numpy.interp(positions, numpy.arange(len(tail)), tail)
    slowed *= numpy.linspace(1.0, 0.0, len(slowed)) ** 0.5
    return numpy.concatenate([audio[:start], slowed])


def render_clip(pipeline, voice, spec):
    pieces = []
    words = []
    cursor = 0.0
    for text, gap_ms in spec["segments"]:
        audio, segment_words = speak(pipeline, voice, text)
        words += [(word, cursor + start, cursor + end) for word, start, end in segment_words]
        pieces += [audio, numpy.zeros(int(gap_ms * KOKORO_RATE / 1000), dtype=audio.dtype)]
        cursor += (len(audio) + len(pieces[-1])) / KOKORO_RATE

    audio = numpy.concatenate(pieces)

    def find(word):
        return next((start, end) for name, start, end in words if name == word)

    marks = {
        key: round(find(word)[0 if edge == "start" else 1] * 1000)
        for key, (edge, word) in spec["marks"].items()
    }

    if "tape_stop_from" in spec:
        audio = tape_stop(audio, find(spec["tape_stop_from"])[0])
        marks["dense_ms"] = marks["shutdown_ms"] - spec["dense_before_shutdown_ms"]

    if "blink" in spec:
        window_start, window_end = (marks[key] for key in spec["blink"])
        blink_start = (window_start + window_end - BLINK_MS) // 2
        marks["blink_start_ms"] = blink_start
        marks["blink_end_ms"] = blink_start + BLINK_MS

    return numpy.concatenate([audio, numpy.zeros(int(TAIL_MS * KOKORO_RATE / 1000), dtype=audio.dtype)]), marks


def write_wav(audio, path):
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-f", "f32le", "-ar", str(KOKORO_RATE), "-ac", "1", "-i", "-",
            "-filter_complex", ROBOT_FILTER, "-map", "[out]",
            "-ar", str(OUTPUT_RATE), "-ac", "1", "-c:a", "pcm_s16le", str(path),
        ],
        input=audio.astype(numpy.float32).tobytes(),
        check=True,
    )


def wav_ms(path):
    import wave

    with wave.open(str(path), "rb") as wav:
        return round(wav.getnframes() * 1000 / wav.getframerate())


def main():
    assets = Path(__file__).resolve().parent / "assets"
    assets.mkdir(exist_ok=True)
    pipeline, voice = load_pipeline()

    for name, spec in CLIPS.items():
        audio, marks = render_clip(pipeline, voice, spec)
        wav_path = assets / f"{name}.wav"
        write_wav(audio, wav_path)
        marks["end_ms"] = wav_ms(wav_path)
        transcript = " ".join(text for text, _ in spec["segments"])
        lines = [f"# {transcript}"] + [f"{key}={value}" for key, value in sorted(marks.items(), key=lambda item: item[1])]
        (assets / f"{name}.cue").write_text("\n".join(lines) + "\n")
        print(name, marks)


if __name__ == "__main__":
    main()
