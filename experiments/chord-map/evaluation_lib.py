#!/usr/bin/env python3
"""Shared helpers for Chord Map research quality evaluation."""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


REFERENCE_ROOT = Path(".isolation/chord-map/reference")
UNKNOWN_TEXT = "unknown"


@dataclass(frozen=True)
class TextLine:
    """One text line with optional timestamps."""

    text: str
    start_sec: float | None
    end_sec: float | None


@dataclass(frozen=True)
class ChordLine:
    """One chord reference or prediction span."""

    chord: str
    start_sec: float
    end_sec: float


def load_json(path: Path) -> dict[str, Any]:
    """Load one JSON object from disk."""

    data = json.loads(path.read_text(encoding="utf8"))
    if not isinstance(data, dict):
        raise ValueError(f"Expected JSON object: {path}")
    return data


def write_json(path: Path, data: dict[str, Any]) -> None:
    """Write one JSON object to disk."""

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def sample_name_from_song_map(path: Path) -> str:
    """Return the generated sample name for one song-map path."""

    return path.parent.name


def find_reference_path(song_map_path: Path, kind: str, reference_root: Path = REFERENCE_ROOT) -> Path | None:
    """Find an optional reference JSON path for a generated song-map artifact."""

    sample_name = sample_name_from_song_map(song_map_path)
    base_names = [sample_name]
    for suffix in ("-smoothed", "-asr-smoke", "-real-asr"):
        if sample_name.endswith(suffix):
            base_names.append(sample_name[: -len(suffix)])
    candidates = [
        candidate
        for base_name in base_names
        for candidate in (
            reference_root / base_name / f"{kind}.json",
            reference_root / f"{base_name}.{kind}.json",
            reference_root / f"{base_name}.json",
        )
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def lyric_lines_from_data(data: dict[str, Any]) -> list[TextLine]:
    """Extract lyric lines from song-map or whisper.cpp-like JSON shapes."""

    if isinstance(data.get("lyrics"), list):
        return [line for line in (text_line_from_mapping(item) for item in data["lyrics"]) if line is not None]
    if isinstance(data.get("transcription"), list):
        return [
            line
            for line in (text_line_from_whisper_segment(item) for item in data["transcription"])
            if line is not None
        ]
    return []


def text_line_from_mapping(value: Any) -> TextLine | None:
    """Read one generic lyric mapping."""

    if not isinstance(value, dict):
        return None
    text = str(value.get("text", "")).strip()
    if not text:
        return None
    return TextLine(text, optional_float(value.get("startSec")), optional_float(value.get("endSec")))


def text_line_from_whisper_segment(value: Any) -> TextLine | None:
    """Read one whisper.cpp-style segment mapping."""

    if not isinstance(value, dict):
        return None
    text = str(value.get("text", "")).strip()
    if not text:
        return None
    start_sec, end_sec = segment_times(value)
    return TextLine(text, start_sec, end_sec)


def segment_times(segment: dict[str, Any]) -> tuple[float | None, float | None]:
    """Read start and end seconds from one whisper.cpp segment."""

    offsets = segment.get("offsets")
    if isinstance(offsets, dict) and "from" in offsets and "to" in offsets:
        return optional_float(offsets["from"], scale=0.001), optional_float(offsets["to"], scale=0.001)

    timestamps = segment.get("timestamps")
    if isinstance(timestamps, dict) and "from" in timestamps and "to" in timestamps:
        return parse_timestamp(str(timestamps["from"])), parse_timestamp(str(timestamps["to"]))

    return optional_float(segment.get("start")), optional_float(segment.get("end"))


def parse_timestamp(value: str) -> float | None:
    """Parse hh:mm:ss.mmm or mm:ss.mmm into seconds."""

    parts = value.strip().split(":")
    if len(parts) not in (2, 3):
        return None
    try:
        seconds = float(parts[-1])
        minutes = int(parts[-2])
        hours = int(parts[-3]) if len(parts) == 3 else 0
    except ValueError:
        return None
    return hours * 3600.0 + minutes * 60.0 + seconds


def optional_float(value: Any, scale: float = 1.0) -> float | None:
    """Convert a value to float when possible."""

    if isinstance(value, (int, float)):
        return float(value) * scale
    return None


def normalize_text(value: str) -> str:
    """Normalize text for ASR comparison."""

    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", value.lower(), flags=re.UNICODE)).strip()


def word_error_rate(reference: str, hypothesis: str) -> float | None:
    """Return word error rate using Levenshtein distance over tokens."""

    reference_words = normalize_text(reference).split()
    hypothesis_words = normalize_text(hypothesis).split()
    if not reference_words:
        return None
    return levenshtein(reference_words, hypothesis_words) / len(reference_words)


def character_error_rate(reference: str, hypothesis: str) -> float | None:
    """Return character error rate using Levenshtein distance over normalized characters."""

    reference_text = normalize_text(reference).replace(" ", "")
    hypothesis_text = normalize_text(hypothesis).replace(" ", "")
    if not reference_text:
        return None
    return levenshtein(list(reference_text), list(hypothesis_text)) / len(reference_text)


def levenshtein(reference: list[str], hypothesis: list[str]) -> int:
    """Return Levenshtein distance between two token lists."""

    previous = list(range(len(hypothesis) + 1))
    for row_index, reference_item in enumerate(reference, start=1):
        current = [row_index]
        for column_index, hypothesis_item in enumerate(hypothesis, start=1):
            cost = 0 if reference_item == hypothesis_item else 1
            current.append(
                min(
                    previous[column_index] + 1,
                    current[column_index - 1] + 1,
                    previous[column_index - 1] + cost,
                )
            )
        previous = current
    return previous[-1]


def joined_text(lines: list[TextLine]) -> str:
    """Join lyric lines into one transcript string."""

    return " ".join(line.text for line in lines).strip()


def mean_timing_error(reference: list[TextLine], hypothesis: list[TextLine]) -> float | None:
    """Return mean absolute line boundary timing error in seconds."""

    errors: list[float] = []
    for reference_line, hypothesis_line in zip(reference, hypothesis):
        if reference_line.start_sec is not None and hypothesis_line.start_sec is not None:
            errors.append(abs(reference_line.start_sec - hypothesis_line.start_sec))
        if reference_line.end_sec is not None and hypothesis_line.end_sec is not None:
            errors.append(abs(reference_line.end_sec - hypothesis_line.end_sec))
    if not errors:
        return None
    return sum(errors) / len(errors)


def lyric_timestamps_are_monotonic(lines: list[TextLine]) -> bool:
    """Return true when generated lyric timestamps are ordered and non-negative."""

    previous_end = 0.0
    for line in lines:
        if line.start_sec is None or line.end_sec is None:
            continue
        if line.start_sec < 0 or line.end_sec < line.start_sec or line.start_sec < previous_end:
            return False
        previous_end = line.end_sec
    return True


def chord_lines_from_data(data: dict[str, Any]) -> list[ChordLine]:
    """Extract chord spans from song-map or reference JSON."""

    chords = data.get("chords")
    if not isinstance(chords, list):
        return []
    result: list[ChordLine] = []
    for item in chords:
        line = chord_line_from_mapping(item)
        if line is not None:
            result.append(line)
    return sorted(result, key=lambda chord: (chord.start_sec, chord.end_sec))


def chord_line_from_mapping(value: Any) -> ChordLine | None:
    """Read one chord span mapping."""

    if not isinstance(value, dict):
        return None
    start_sec = optional_float(value.get("startSec"))
    end_sec = optional_float(value.get("endSec"))
    chord = str(value.get("chord", "")).strip()
    if start_sec is None or end_sec is None or end_sec <= start_sec or not chord:
        return None
    return ChordLine(chord, start_sec, end_sec)


def chord_at_time(chords: list[ChordLine], time_sec: float) -> ChordLine | None:
    """Return the active chord span at one timestamp."""

    for chord in chords:
        if chord.start_sec <= time_sec < chord.end_sec:
            return chord
    return None


def chord_endpoints(reference: list[ChordLine], hypothesis: list[ChordLine]) -> list[float]:
    """Return sorted chord boundaries for time-weighted evaluation."""

    values = {0.0}
    for chord in [*reference, *hypothesis]:
        values.add(chord.start_sec)
        values.add(chord.end_sec)
    return sorted(value for value in values if math.isfinite(value))


def normalized_chord(value: str) -> str:
    """Return a simple normalized chord label for comparison."""

    root = chord_root(value)
    if root is None:
        return "N"
    suffix = chord_suffix(value)
    quality = normalized_quality(suffix)
    return f"{root}:{quality}"


def normalized_root(value: str) -> str:
    """Return a simple normalized chord root for comparison."""

    return chord_root(value) or "N"


def raw_root(value: str) -> str | None:
    """Return the raw root token from a chord label."""

    match = re.match(r"^\s*([A-Ga-g](?:#|b)?)", value)
    if not match:
        return None
    token = match.group(1)
    return token[0].upper() + token[1:]


def chord_root(value: str) -> str | None:
    """Return a canonical sharp root for a chord label."""

    token = raw_root(value)
    if token is None:
        return None
    return {
        "Cb": "B",
        "C": "C",
        "C#": "C#",
        "Db": "C#",
        "D": "D",
        "D#": "D#",
        "Eb": "D#",
        "E": "E",
        "Fb": "E",
        "E#": "F",
        "F": "F",
        "F#": "F#",
        "Gb": "F#",
        "G": "G",
        "G#": "G#",
        "Ab": "G#",
        "A": "A",
        "A#": "A#",
        "Bb": "A#",
        "B": "B",
        "B#": "C",
    }.get(token)


def chord_suffix(value: str) -> str:
    """Return the quality suffix from a chord label."""

    clean = value.strip().split("/", 1)[0]
    root = raw_root(clean)
    if root is None:
        return ""
    suffix = clean[len(root) :]
    if suffix.startswith(":"):
        suffix = suffix[1:]
    return suffix.lower()


def normalized_quality(suffix: str) -> str:
    """Normalize common chord qualities without pulling in a MIR dependency."""

    value = suffix.strip().lower()
    if value in {"", "maj", "major"}:
        return "maj"
    if value in {"m", "min", "minor"}:
        return "min"
    if value in {"7", "dom7"}:
        return "7"
    if value in {"maj7", "major7"}:
        return "maj7"
    if value in {"m7", "min7", "minor7"}:
        return "min7"
    if value in {"hdim7", "m7b5", "min7b5"}:
        return "hdim7"
    if value.startswith("dim"):
        return "dim"
    if value.startswith("aug"):
        return "aug"
    return value or "maj"


def rounded(value: float | None, digits: int = 3) -> float | None:
    """Round optional floats for JSON output."""

    if value is None:
        return None
    return round(value, digits)


def markdown_escape(value: str) -> str:
    """Escape table-sensitive Markdown characters."""

    return value.replace("|", "\\|")
