---
name: tiny-engineer-play
description: Make the Tiny Engineer desk robot speak and perform a custom animation (servo moves, gaze, blinks, animated faces) synced to a WAV clip, via its POST /play API. Use whenever the user asks the robot to say something, celebrate, react, wave, nod, dance, show a face or emotion, announce a result, or "tell me through the robot", and whenever they ask you to choreograph, script or test robot motion or eyes. Also use when debugging /play errors such as 415 "expected 16-bit mono PCM" or 400 "step N: ...".
---

# Tiny Engineer: speak and perform

The robot plays a WAV clip while running a timeline of moves and eye changes. Send it with the script in this skill's base directory:

```bash
<base directory>/scripts/play clip.wav --anim '<timeline json>'
```

It reads `TINY_ENGINEER_URL` and `TINY_ENGINEER_TOKEN` from the environment (or `--url`). It prints the robot's JSON reply after the clip has finished playing and exits 1 with the reason when anything is wrong. The robot only answers one request at a time, so keep clips short (a few seconds to about 20 s); the hooks that animate the robot during normal work wait while a clip plays.

## 1. Make the clip

The robot accepts only 16-bit mono PCM WAV at its own sample rate. Make speech in the robot's voice with the `say.py` script in this skill's base directory. It needs `uv` and `ffmpeg`; the first run installs its dependencies and downloads the voice model, so allow a few minutes, and later runs take about 15 s.

```bash
<base directory>/scripts/say.py "Build passed. Ship it!" -o /tmp/te-clip.wav
```

It prints the clip length and the start of every word in milliseconds:

```json
{"wav": "/tmp/te-clip.wav", "duration_ms": 2200, "words": [["Build", 375], ["passed", 650], ["Ship", 1188], ["it", 1475]]}
```

Build the timeline from these timings.

Options: `--voice bm_george` for a British voice (any Kokoro voice; the default is `am_michael`), `--speed 0.9` to slow down, `--plain` for the voice without the robot filter, `--rate N` for a robot with another sample rate.

If `say.py` cannot run (no `uv`), fall back to the machine's own text-to-speech and convert it. There are no word timings then, so estimate from `ffprobe` duration divided by the word count:

```bash
espeak-ng -v en-us -s 165 -w /tmp/te-raw.wav "Build passed. Ship it!"     # Linux
say --file-format=WAVE --data-format=LEI16@22050 -o /tmp/te-raw.wav "Build passed. Ship it!"  # macOS built-in say
ffmpeg -y -loglevel error -i /tmp/te-raw.wav -ar 22050 -ac 1 -c:a pcm_s16le /tmp/te-clip.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/te-clip.wav
```

For a silent performance, make silence of the right length:

```bash
ffmpeg -y -loglevel error -f lavfi -i anullsrc=r=22050:cl=mono -t 4 -c:a pcm_s16le /tmp/te-clip.wav
```

22050 Hz is the stock rate. If the reply is `expected 16-bit mono PCM at N Hz`, re-run `say.py` with `--rate N` (or the `ffmpeg` step with `-ar N`).

## 2. Write the timeline

A JSON array of steps. Steps run in order and only `sleep` advances time, so steps with no `sleep` between them start together. Time is measured in playback, so the motion stays in sync with the audio.

| Step | Effect |
| --- | --- |
| `["sleep", ms]` | Wait `ms` of playback |
| `["preset", name]` | Built-in motion loop with eyes: `none` (rest), `typing`, `reading`, `thinking`, `wakeup` |
| `["move", servo, to, ms?]` | `head` (tilt), `neck` (pan), `hand_left`, `hand_right`, `body` (rotate) to `to` in -1..1, arriving after `ms`. Stops the running preset; other joints hold |
| `["eyes", mode]` | Eye mode: `idle`, `typing`, `reading`, `thinking`, `ring`, `welcome`, `attention`, `error`, `abort`, `wakeup`, `dead` |
| `["look", x, y, ms?]` | Gaze: `x` -1 screen left to 1 right, `y` -1 up to 1 down |
| `["open", amount, ms?]` | Eyelids: 0 closed, 0.3 squint, 1 normal |
| `["blink"]` | One blink |
| `["face", name]` | Animated face: `idle`, `happy`, `laugh`, `wink`, `curious`, `thinking`, `surprise`, `smug`, `sleepy`, `sleep`, `sad`, `cry`, `angry`, `panic`, `shy`, `love` |

Positions are relative to each robot's calibrated range (-1 = saved min, 1 = saved max), so they are safe on any build. The left and right hands use opposite scales: test a hand move before relying on which way is "up".

A `face` stays until the next `look`, `open`, `eyes` or `preset`. When the clip ends the robot goes back to the `typing`, `reading` or `thinking` loop it was in before, otherwise to rest.

Timing speech: `sleep` takes the gap between steps, not an absolute time, so turn the word starts into differences. To land a gesture on a word, start the move 100-200 ms before that word's start so it arrives on the stressed syllable. Moves of 200-500 ms read as deliberate; under 150 ms reads as a twitch. Fill pauses between sentences (a gap of 300 ms or more between words) with a blink, a glance or a new face.

## 3. Send it

For the clip above, a nod that lands on "Build" (375 ms) and a happy face with a wave on "Ship" (1188 ms):

```bash
<base directory>/scripts/play /tmp/te-clip.wav --anim '[
  ["preset","thinking"],
  ["sleep",175], ["move","head",0.5,200],
  ["sleep",475], ["move","head",0,300],
  ["sleep",350], ["face","happy"], ["move","hand_right",0.8,200],
  ["sleep",400], ["move","hand_right",0.2,250],
  ["sleep",450], ["blink"], ["preset","none"]
]'
```

The sleeps add up to the target times: 175 is 200 ms before "Build", 175 + 475 = 650 is "passed", 650 + 350 = 1000 is about 190 ms before "Ship".

`--anim-file dance.json` reads the timeline from a file instead; pretty-printed JSON is fine either way.

## Errors

| Reply | Fix |
| --- | --- |
| `400 step N: ...` | Step `N` (0-based) is wrong: unknown servo, eye mode or face, a preset with its own sound (`ring`, `welcome`, ...), or bad numbers |
| `415 expected 16-bit mono PCM at N Hz` | Re-run `say.py` with `--rate N`, or convert with `ffmpeg ... -ar N -ac 1 -c:a pcm_s16le` |
| `401 unauthorized` | Set `TINY_ENGINEER_TOKEN` to the robot's `access_token` |
| `robot unreachable` | Check `TINY_ENGINEER_URL`; the robot must be on the same network |

Full API reference: `docs/api.md` (`POST /play`) in the Tiny Engineer repository.
