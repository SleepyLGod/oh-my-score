#!/usr/bin/env python3
"""Evaluate generated Chord Map lyrics against optional reference text."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from evaluation_lib import (
    character_error_rate,
    find_reference_path,
    joined_text,
    load_json,
    lyric_lines_from_data,
    lyric_timestamps_are_monotonic,
    mean_timing_error,
    rounded,
    sample_name_from_song_map,
    word_error_rate,
)


def main(argv: list[str]) -> int:
    """Evaluate one song-map JSON and print a JSON result."""

    if len(argv) not in (2, 3):
        print("Usage: evaluate-asr <song-map.json> [reference-lyrics.json]", file=sys.stderr)
        return 2

    song_map_path = Path(argv[1])
    reference_path = Path(argv[2]) if len(argv) == 3 else find_reference_path(song_map_path, "lyrics")
    result = evaluate_asr(song_map_path, reference_path)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0


def evaluate_asr(song_map_path: Path, reference_path: Path | None) -> dict[str, object]:
    """Return ASR quality metrics for one generated song map."""

    song_map = load_json(song_map_path)
    generated_lines = lyric_lines_from_data(song_map)
    lyrics_status = song_map.get("lyricsStatus", {})
    generated_status = str(lyrics_status.get("status", "unknown")) if isinstance(lyrics_status, dict) else "unknown"
    generated_reason = str(lyrics_status.get("reason", "")).strip() if isinstance(lyrics_status, dict) else ""
    base = {
        "sample": sample_name_from_song_map(song_map_path),
        "songMap": str(song_map_path),
        "reference": str(reference_path) if reference_path else None,
        "lyricsStatus": generated_status,
        "generatedLineCount": len(generated_lines),
        "timestampMonotonic": lyric_timestamps_are_monotonic(generated_lines),
    }

    if generated_status == "mock":
        return {
            **base,
            "status": "mock-not-evaluated",
            "reason": "mock ASR output validates wiring only and is not a real transcription quality signal.",
        }

    if reference_path is None or not reference_path.is_file():
        reason = "no reference lyric JSON was found."
        if generated_status != "available":
            reason = f"generated lyricsStatus is {generated_status}"
            if generated_reason:
                reason = f"{reason}: {generated_reason}"
            reason = f"{reason}; no reference lyric JSON was found."
        return {
            **base,
            "status": "not-evaluated",
            "reason": reason,
        }

    reference_lines = lyric_lines_from_data(load_json(reference_path))
    if not reference_lines:
        return {
            **base,
            "status": "not-evaluated",
            "reason": "reference lyric JSON contains no usable lyric lines.",
        }

    if generated_status != "available":
        reason = f"generated lyricsStatus is {generated_status}, not available."
        if generated_reason:
            reason = f"{reason} Reason: {generated_reason}"
        return {
            **base,
            "status": "not-evaluated",
            "reason": reason,
            "referenceLineCount": len(reference_lines),
        }

    reference_text = joined_text(reference_lines)
    generated_text = joined_text(generated_lines)
    return {
        **base,
        "status": "evaluated",
        "reason": "real ASR output was compared with reference lyrics.",
        "referenceLineCount": len(reference_lines),
        "wer": rounded(word_error_rate(reference_text, generated_text)),
        "cer": rounded(character_error_rate(reference_text, generated_text)),
        "meanTimingErrorSec": rounded(mean_timing_error(reference_lines, generated_lines)),
        "lineCountDelta": len(generated_lines) - len(reference_lines),
    }


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
