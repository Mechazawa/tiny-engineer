# Robot voice

Replaces the five spoken clips with a synthetic robot voice. The lines are the stock transcripts. Speech comes from [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) (Apache-2.0), a 50/50 blend of `am_fenrir` and `am_onyx`, run through a band-limited ring-mod and bitcrush filter. `dead` ends in a tape-stop slowdown instead of a drawn-out "down".

| File | Duration | Transcript |
| --- | --- | --- |
| [`abort.wav`](assets/abort.wav) | 2.6 s | Fine! I didn't want to finish that anyway! |
| [`attention.wav`](assets/attention.wav) | 2.7 s | Psst! Human! I might want to take a look. |
| [`dead.wav`](assets/dead.wav) | 3.0 s | Insufficient resources. Shutting down. |
| [`error.wav`](assets/error.wav) | 2.7 s | Uh-oh, human! We have a problem! |
| [`welcome.wav`](assets/welcome.wav) | 2.8 s | Hello, human! What are we building today? |

`bell` stays stock. Each clip ships a `.cue` with phrase marks taken from Kokoro's word timestamps.

## Install

Set `custom_audio_mod = robot-voice` in [`platformio.ini`](../../platformio.ini), then `pio run -t uploadfs` (or `pio run -e ota -t otafs` over Wi-Fi). See [docs/flash.md](../../docs/flash.md).

## Regenerate

[`generate.py`](generate.py) rewrites every WAV and `.cue` in `assets/`. Edit the voice blend, filter or lines there, then run it. It needs [uv](https://docs.astral.sh/uv/), `ffmpeg` and `espeak-ng`:

```bash
mods/robot-voice/generate.py
```
