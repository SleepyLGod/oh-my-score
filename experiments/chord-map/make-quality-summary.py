#!/usr/bin/env python3
"""Build a Markdown quality summary from Chord Map outputs and references."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any

from evaluation_lib import (
    find_reference_path,
    load_json,
    markdown_escape,
    rounded,
)


DEFAULT_OUTPUT_ROOT = Path(".isolation/chord-map/output")
DEFAULT_PATTERNS = ("*-smoothed/song-map.json", "*-asr-smoke/song-map.json", "*-real-asr/song-map.json")
SCRIPT_DIR = Path(__file__).resolve().parent


def main(argv: list[str]) -> int:
    """Generate a quality summary Markdown file."""

    output_root = Path(argv[1]) if len(argv) > 1 else DEFAULT_OUTPUT_ROOT
    if not output_root.is_dir():
        print(f"Output root does not exist: {output_root}", file=sys.stderr)
        return 2

    song_map_paths = sorted({path for pattern in DEFAULT_PATTERNS for path in output_root.glob(pattern)})
    if not song_map_paths:
        print(f"No song-map.json files found under {output_root}", file=sys.stderr)
        return 1

    asr_module = load_module(SCRIPT_DIR / "evaluate-asr.py", "evaluate_asr_script")
    chord_module = load_module(SCRIPT_DIR / "evaluate-chords.py", "evaluate_chords_script")
    rows = [
        quality_row(path, asr_module.evaluate_asr(path, find_reference_path(path, "lyrics")), chord_module.evaluate_chords(path, find_reference_path(path, "chords")))
        for path in song_map_paths
    ]
    output_path = output_root / "quality-summary.md"
    output_path.write_text(render_summary(rows), encoding="utf8")
    print(f"Quality summary: {output_path}")
    return 0


def load_module(path: Path, name: str) -> ModuleType:
    """Load a sibling Python script as a module."""

    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def quality_row(song_map_path: Path, asr_result: dict[str, Any], chord_result: dict[str, Any]) -> dict[str, Any]:
    """Build one compact quality row."""

    song_map = load_json(song_map_path)
    harmony = song_map.get("harmonyReliability", {})
    lyrics = song_map.get("lyricsStatus", {})
    return {
        "sample": song_map_path.parent.name,
        "harmony": harmony.get("status", "unknown") if isinstance(harmony, dict) else "unknown",
        "useCase": harmony.get("useCase", "unknown") if isinstance(harmony, dict) else "unknown",
        "lyricsStatus": lyrics.get("status", "unknown") if isinstance(lyrics, dict) else "unknown",
        "asrQuality": asr_result.get("status", "unknown"),
        "wer": asr_result.get("wer"),
        "cer": asr_result.get("cer"),
        "chordQuality": chord_result.get("status", "unknown"),
        "exactAccuracy": chord_result.get("exactAccuracy"),
        "rootAccuracy": chord_result.get("rootAccuracy"),
        "blockers": blockers(asr_result, chord_result),
    }


def blockers(asr_result: dict[str, Any], chord_result: dict[str, Any]) -> str:
    """Return compact blocker text from evaluator outputs."""

    parts: list[str] = []
    if asr_result.get("status") != "evaluated":
        parts.append(f"ASR: {asr_result.get('reason', 'not evaluated')}")
    if chord_result.get("status") != "evaluated":
        parts.append(f"chords: {chord_result.get('reason', 'not evaluated')}")
    return "; ".join(parts) or "none"


def render_summary(rows: list[dict[str, Any]]) -> str:
    """Render quality rows as Markdown."""

    lines = [
        "# Chord Map Quality Summary",
        "",
        "This file is a research evaluation report. It does not prove product accuracy.",
        "ASR and chord accuracy are only evaluated when reference data exists.",
        "Mock ASR is reported separately and never counts as real ASR quality.",
        "",
        "| Sample | Harmony | Use case | Lyrics | ASR quality | WER | CER | Chord quality | Exact | Root | Blockers |",
        "|---|---|---|---|---|---:|---:|---|---:|---:|---|",
    ]
    for row in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    markdown_escape(str(row["sample"])),
                    markdown_escape(str(row["harmony"])),
                    markdown_escape(str(row["useCase"])),
                    markdown_escape(str(row["lyricsStatus"])),
                    markdown_escape(str(row["asrQuality"])),
                    format_metric(row.get("wer")),
                    format_metric(row.get("cer")),
                    markdown_escape(str(row["chordQuality"])),
                    format_metric(row.get("exactAccuracy")),
                    format_metric(row.get("rootAccuracy")),
                    markdown_escape(str(row["blockers"])),
                ]
            )
            + " |"
        )
    return "\n".join(lines) + "\n"


def format_metric(value: object) -> str:
    """Format optional metric values for a Markdown table."""

    if not isinstance(value, (int, float)):
        return "n/a"
    return f"{rounded(float(value)):.3f}"


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
