#!/usr/bin/env python3
"""Evaluate generated Chord Map chords against optional reference chord spans."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from evaluation_lib import (
    ChordLine,
    chord_at_time,
    chord_endpoints,
    chord_lines_from_data,
    find_reference_path,
    load_json,
    normalized_chord,
    normalized_root,
    rounded,
    sample_name_from_song_map,
)


def main(argv: list[str]) -> int:
    """Evaluate one song-map JSON and print a JSON result."""

    if len(argv) not in (2, 3):
        print("Usage: evaluate-chords <song-map.json> [reference-chords.json]", file=sys.stderr)
        return 2

    song_map_path = Path(argv[1])
    reference_path = Path(argv[2]) if len(argv) == 3 else find_reference_path(song_map_path, "chords")
    result = evaluate_chords(song_map_path, reference_path)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def evaluate_chords(song_map_path: Path, reference_path: Path | None) -> dict[str, object]:
    """Return chord accuracy metrics for one generated song map."""

    song_map = load_json(song_map_path)
    generated_chords = chord_lines_from_data(song_map)
    harmony = song_map.get("harmonyReliability", {})
    base = {
        "sample": sample_name_from_song_map(song_map_path),
        "songMap": str(song_map_path),
        "reference": str(reference_path) if reference_path else None,
        "harmonyStatus": str(harmony.get("status", "unknown")) if isinstance(harmony, dict) else "unknown",
        "generatedChordCount": len(generated_chords),
    }

    if reference_path is None or not reference_path.is_file():
        return {
            **base,
            "status": "not-evaluated",
            "reason": "no reference chord JSON was found.",
        }

    reference_chords = chord_lines_from_data(load_json(reference_path))
    if not reference_chords:
        return {
            **base,
            "status": "not-evaluated",
            "reason": "reference chord JSON contains no usable chord spans.",
        }
    if not generated_chords:
        return {
            **base,
            "status": "not-evaluated",
            "reason": "generated song map contains no usable chord spans.",
            "referenceChordCount": len(reference_chords),
        }

    metrics = time_weighted_chord_metrics(reference_chords, generated_chords)
    return {
        **base,
        "status": "evaluated",
        "reason": "generated chord spans were compared with reference chord spans.",
        "referenceChordCount": len(reference_chords),
        "exactAccuracy": rounded(metrics["exactAccuracy"]),
        "rootAccuracy": rounded(metrics["rootAccuracy"]),
        "coverage": rounded(metrics["coverage"]),
        "overSegmentation": max(0, len(generated_chords) - len(reference_chords)),
        "underSegmentation": max(0, len(reference_chords) - len(generated_chords)),
        "evaluatedDurationSec": rounded(metrics["evaluatedDurationSec"]),
    }


def time_weighted_chord_metrics(
    reference_chords: list[ChordLine],
    generated_chords: list[ChordLine],
) -> dict[str, float]:
    """Return time-weighted exact and root accuracy over reference-covered time."""

    endpoints = chord_endpoints(reference_chords, generated_chords)
    exact_duration = 0.0
    root_duration = 0.0
    covered_duration = 0.0
    reference_duration = 0.0
    for start_sec, end_sec in zip(endpoints, endpoints[1:]):
        if end_sec <= start_sec:
            continue
        mid_sec = (start_sec + end_sec) / 2.0
        reference = chord_at_time(reference_chords, mid_sec)
        generated = chord_at_time(generated_chords, mid_sec)
        if reference is None:
            continue
        duration = end_sec - start_sec
        reference_duration += duration
        if generated is None:
            continue
        covered_duration += duration
        if normalized_chord(generated.chord) == normalized_chord(reference.chord):
            exact_duration += duration
        if normalized_root(generated.chord) == normalized_root(reference.chord):
            root_duration += duration

    if reference_duration <= 0:
        return {
            "exactAccuracy": 0.0,
            "rootAccuracy": 0.0,
            "coverage": 0.0,
            "evaluatedDurationSec": 0.0,
        }
    return {
        "exactAccuracy": exact_duration / reference_duration,
        "rootAccuracy": root_duration / reference_duration,
        "coverage": covered_duration / reference_duration,
        "evaluatedDurationSec": reference_duration,
    }


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
