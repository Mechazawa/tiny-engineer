"""Chordsheet: a spoken line with robot cues, compiled into a POST /play timeline.

    {mood: proud}[nod]Build passed. {pause: 300}[happy wave]Ship [look:-1,0/200 @+100]it!

`[cues]` before a word fire on that word; `{directives}` set moods, pauses,
named chords and the lead time. Parsing needs no speech; compiling takes the
start of every spoken word, measured by the text-to-speech engine.
"""

import difflib
import json
import re
from dataclasses import dataclass, field

FACES = (
    "idle", "happy", "laugh", "wink", "curious", "thinking", "surprise", "smug",
    "sleepy", "sleep", "sad", "cry", "angry", "panic", "shy", "love",
)
EYES = ("idle", "typing", "reading", "thinking", "ring", "welcome", "attention", "error", "abort", "wakeup", "dead")
PRESETS = ("none", "typing", "reading", "thinking", "wakeup")
SERVOS = ("head", "neck", "hand_left", "hand_right", "body")

# Hands rest down; their "lift" runs toward the other end of each hand's range.
HAND_DOWN = {"hand_left": 1.0, "hand_right": -1.0}

def wave(hand):
    return [(0, hand, 1.8, 200), (250, hand, 1.3, 150), (420, hand, 1.8, 150), (590, hand, 1.3, 150), (760, hand, 0.0, 300)]


# Built-in gestures: (ms after the gesture starts, servo, target, move ms).
# Head, neck and body targets are offsets from the mood's resting pose; hand targets are lift 0..2.
GESTURES = {
    "nod": [(0, "head", 0.45, 180), (200, "head", -0.15, 180), (400, "head", 0.0, 200)],
    "shake": [(0, "neck", 0.5, 180), (200, "neck", -0.5, 250), (470, "neck", 0.3, 200), (690, "neck", 0.0, 200)],
    "wave": wave("hand_right"),
    "wave_left": wave("hand_left"),
    "shrug": [(0, "hand_left", 0.7, 200), (0, "hand_right", 0.7, 200), (0, "head", -0.2, 200),
              (600, "hand_left", 0.0, 300), (600, "hand_right", 0.0, 300), (600, "head", 0.0, 300)],
    "cheer": [(0, "hand_left", 2.0, 250), (0, "hand_right", 2.0, 250), (0, "head", 0.3, 250),
              (800, "hand_left", 0.0, 400), (800, "hand_right", 0.0, 400), (800, "head", 0.0, 300)],
    "bounce": [(0, "body", 0.3, 150), (150, "body", -0.3, 200), (350, "body", 0.0, 150)],
}

# Mood: (face or eyes step, resting head position that gestures return to).
MOODS = {
    "neutral": (("eyes", "idle"), 0.0),
    "happy": (("face", "happy"), 0.2),
    "proud": (("face", "smug"), 0.35),
    "excited": (("face", "laugh"), 0.3),
    "curious": (("face", "curious"), 0.1),
    "thinking": (("eyes", "thinking"), 0.4),
    "sad": (("face", "sad"), -0.5),
    "angry": (("face", "angry"), -0.2),
    "shy": (("face", "shy"), -0.3),
    "sleepy": (("face", "sleepy"), -0.3),
}

# Named arguments: `face:sleep`, `eyes:thinking`, `preset:typing`, `mood:proud`.
CHOICES = {"face": FACES, "eyes": EYES, "preset": PRESETS, "mood": MOODS}
# Numeric arguments: (low, high, default move ms).
RANGES = {**{servo: (-1, 1, 300) for servo in SERVOS}, "open": (0, 1, 200), "look": (-1, 1, 200)}
DIRECTIVES = ("mood", "pause", "define", "lead")

MOOD_MOVE_MS = 400
DEFAULT_LEAD_MS = 150
MAX_STEPS = 256
MAX_ANIM_BYTES = 8000
END = None  # anchor for cues with no word after them in their segment

TOKEN = re.compile(r"\[(?P<cues>[^\]]*)\]|\{(?P<directive>[^}]*)\}|(?P<text>[^\[\]{}]+)")
CUE = re.compile(r"^(?P<name>[a-z_]+)(?::(?P<args>[^/@]+))?(?:/(?P<ms>\d+))?(?:@(?P<offset>[+-]\d+))?$")


class SheetError(Exception):
    def __init__(self, column, message):
        super().__init__(f"col {column}: {message}")
        self.column = column


@dataclass
class Cue:
    column: int
    name: str
    args: str | None = None
    ms: int | None = None
    offset: int = 0


@dataclass
class Segment:
    words: list = field(default_factory=list)
    # (word index or END, cues), in sheet order.
    anchors: list = field(default_factory=list)
    pause_after_ms: int = 0

    @property
    def text(self):
        return " ".join(self.words)


def suggest(name, choices):
    close = difflib.get_close_matches(name, choices, n=1)
    return f"; did you mean {close[0]!r}?" if close else ""


def parse_cue(token, column):
    match = CUE.match(token)
    if not match:
        raise SheetError(column, f"cannot read cue {token!r}; expected name[:args][/ms][@+-ms]")
    return Cue(
        column=column,
        name=match["name"],
        args=match["args"],
        ms=int(match["ms"]) if match["ms"] else None,
        offset=int(match["offset"]) if match["offset"] else 0,
    )


def number(text, column, low, high):
    try:
        value = float(text)
    except ValueError:
        raise SheetError(column, f"{text!r} is not a number") from None
    if not low <= value <= high:
        raise SheetError(column, f"{value:g} is outside {low:g}..{high:g}")
    return value


class Sheet:
    def __init__(self, segments, lead_ms):
        self.segments = segments
        self.lead_ms = lead_ms

    @classmethod
    def parse(cls, text):
        defines = {}
        lead_ms = DEFAULT_LEAD_MS
        segments = [Segment()]
        pending = []  # cues waiting for the next word

        def flush_pending(anchor):
            if pending:
                segments[-1].anchors.append((anchor, list(pending)))
                pending.clear()

        for match in TOKEN.finditer(text):
            column = match.start() + 1

            if match["text"] is not None:
                for word in match["text"].split():
                    flush_pending(len(segments[-1].words))
                    segments[-1].words.append(word)
                continue

            if match["cues"] is not None:
                # "cue @+100" reads like "cue@+100": the offset belongs to the cue before it.
                group = re.sub(r"\s+@", "@", match["cues"])
                for token in re.finditer(r"\S+", group):
                    cue_column = match.start("cues") + token.start() + 1
                    pending.extend(cls._expand(parse_cue(token[0], cue_column), defines, cue_column))
                continue

            key, _, value = match["directive"].partition(":")
            key, value = key.strip(), value.strip()

            if key == "mood":
                pending.append(cls._check(Cue(column=column, name="mood", args=value), defines))
            elif key == "pause":
                flush_pending(END)
                segments[-1].pause_after_ms = int(number(value, column, 0, 10000))
                segments.append(Segment())
            elif key == "define":
                name, equals, body = value.partition("=")
                name = name.strip()
                if not equals or not re.fullmatch(r"[a-z_]+", name):
                    raise SheetError(column, "expected {define: name = cue cue ...}")
                defines[name] = [cue for token in body.split() for cue in cls._expand(parse_cue(token, column), defines, column)]
            elif key == "lead":
                lead_ms = int(number(value, column, 0, 1000))
            else:
                raise SheetError(column, f"unknown directive {key!r}{suggest(key, DIRECTIVES)}")

        flush_pending(END)
        return cls(segments, lead_ms)

    @classmethod
    def _expand(cls, cue, defines, column):
        if cue.name in defines and cue.args is None:
            return [Cue(column=column, name=c.name, args=c.args, ms=c.ms, offset=c.offset + cue.offset) for c in defines[cue.name]]
        return [cls._check(cue, defines)]

    @staticmethod
    def _check(cue, defines):
        """Reject unknown names and bad arguments before any speech is generated."""
        name, args, column = cue.name, cue.args, cue.column

        if name in GESTURES and cue.ms is not None:
            raise SheetError(column, f"{name} has its own timing; drop /{cue.ms}")
        if name in GESTURES or name == "blink" or (name in FACES and args is None):
            return cue
        if name in CHOICES:
            if args not in CHOICES[name]:
                raise SheetError(column, f"unknown {name} {args!r}{suggest(args or '', CHOICES[name])}")
        elif name in RANGES:
            low, high, _ = RANGES[name]
            parts = (args or "").split(",")
            if len(parts) != (2 if name == "look" else 1):
                raise SheetError(column, "look needs x,y, e.g. look:-1,0/200" if name == "look" else f"{name} needs a value, e.g. {name}:{high}")
            for part in parts:
                number(part, column, low, high)
        else:
            known = [*GESTURES, *FACES, *CHOICES, *RANGES, "blink", *defines]
            raise SheetError(column, f"unknown cue {name!r}{suggest(name, known)}")
        return cue

    def compile(self, timings):
        """Build the X-Anim steps. `timings` holds (word starts in ms, duration ms) per segment."""
        events = []  # (ms, sequence, column, step)
        rest = {"head": 0.0, "neck": 0.0, "body": 0.0}
        segment_start = 0

        def add(ms, column, step):
            events.append((max(0, round(ms)), len(events), column, step))

        for segment, (starts, duration_ms) in zip(self.segments, timings):
            for anchor, cues in segment.anchors:
                at = segment_start + (duration_ms if anchor is END else starts[anchor])
                for cue in cues:
                    self._emit(cue, at, rest, add)
            segment_start += duration_ms + segment.pause_after_ms

        events.sort(key=lambda event: (event[0], event[1]))
        steps, warnings = [], []
        clock, face_column = 0, None

        for ms, _, column, step in events:
            if ms > clock:
                steps.append(["sleep", ms - clock])
                clock = ms
            if step[0] == "face":
                face_column = column
            elif step[0] in ("look", "open", "eyes", "preset") and face_column is not None:
                warnings.append(f"col {column}: {step[0]} clears the face set at col {face_column}")
                face_column = None
            steps.append(step)

        if len(steps) > MAX_STEPS:
            raise SheetError(1, f"compiles to {len(steps)} steps; the robot takes at most {MAX_STEPS}")
        if len(json.dumps(steps, separators=(",", ":"))) > MAX_ANIM_BYTES:
            raise SheetError(1, f"compiled timeline is over {MAX_ANIM_BYTES} bytes; use fewer cues")
        if clock > segment_start:
            warnings.append(f"cues run {clock - segment_start} ms past the end of the speech and will be dropped")
        return steps, warnings

    def _emit(self, cue, at, rest, add):
        name, args, column = cue.name, cue.args, cue.column
        start = at + cue.offset
        moving = start - self.lead_ms

        def servo_target(servo, value):
            if servo in HAND_DOWN:
                down = HAND_DOWN[servo]
                return round(down - value * down, 3)
            return round(max(-1.0, min(1.0, rest[servo] + value)), 3)

        if name in GESTURES:
            for dt, servo, value, ms in GESTURES[name]:
                add(moving + dt, column, ["move", servo, servo_target(servo, value), ms])
        elif name == "mood":
            (kind, value), head = MOODS[args]
            rest["head"] = head
            add(start, column, [kind, value])
            add(moving, column, ["move", "head", head, MOOD_MOVE_MS])
        elif name == "blink":
            add(start, column, ["blink"])
        elif name in FACES and args is None:
            add(start, column, ["face", name])
        elif name in ("face", "eyes", "preset"):
            add(start, column, [name, args])
        elif name in RANGES:
            values = [float(part) for part in args.split(",")]
            ms = cue.ms or RANGES[name][2]
            add(moving, column, ["move", name, *values, ms] if name in SERVOS else [name, *values, ms])


def normalize(word):
    return re.sub(r"[^0-9a-z]", "", word.lower())


def align(sheet_words, spoken):
    """Start ms for each sheet word, from [word, start_ms] pairs the speech engine reported."""
    ours = [normalize(word) for word in sheet_words]
    theirs = [normalize(word) for word, _ in spoken]
    starts = [None] * len(ours)

    for block in difflib.SequenceMatcher(a=ours, b=theirs, autojunk=False).get_matching_blocks():
        for i in range(block.size):
            starts[block.a + i] = spoken[block.b + i][1]

    # Words the engine spoke differently take the next matched start (or the last one heard).
    following = spoken[-1][1] if spoken else 0
    for i in range(len(starts) - 1, -1, -1):
        if starts[i] is None:
            starts[i] = following
        following = starts[i]
    return starts
