#!/usr/bin/env python3
"""Build a Markdown review summary from Chord Map output directories."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_OUTPUT_ROOT = Path(".isolation/chord-map/output")
DEFAULT_PATTERNS = ("*-smoothed/song-map.json", "*-asr-smoke/song-map.json", "*-real-asr/song-map.json")


@dataclass(frozen=True)
class SongMapSummary:
    """A compact summary of one generated song-map artifact."""

    name: str
    path: Path
    duration_sec: float | None
    bpm: float | None
    key: str | None
    mode: str | None
    section_count: int
    chord_count: int
    lyric_count: int
    harmony_status: str | None
    harmony_use_case: str | None
    harmony_reason: str | None
    lyrics_status: str | None
    lyrics_reason: str | None
    warnings: list[str]
    first_chords: list[dict[str, Any]]


def main(argv: list[str]) -> int:
    """Generate a Chord Map review summary Markdown file."""

    output_root = Path(argv[1]) if len(argv) > 1 else DEFAULT_OUTPUT_ROOT
    if not output_root.is_dir():
        print(f"Output root does not exist: {output_root}", file=sys.stderr)
        return 2

    summaries = load_summaries(output_root)
    if not summaries:
        print(f"No song-map.json files found under {output_root}", file=sys.stderr)
        return 1

    output_path = output_root / "review-summary.md"
    output_path.write_text(render_summary(summaries), encoding="utf8")
    print(f"Review summary: {output_path}")
    return 0


def load_summaries(output_root: Path) -> list[SongMapSummary]:
    """Load generated smoothed and ASR-smoke song maps from output subdirectories."""

    summaries: list[SongMapSummary] = []
    song_map_paths = sorted({path for pattern in DEFAULT_PATTERNS for path in output_root.glob(pattern)})
    for song_map_path in song_map_paths:
        data = json.loads(song_map_path.read_text(encoding="utf8"))
        chords = data.get("chords", [])
        sections = data.get("sections", [])
        lyrics = data.get("lyrics", [])
        warnings = data.get("warnings", [])
        harmony_reliability = data.get("harmonyReliability", {})
        lyrics_status = data.get("lyricsStatus", {})
        summaries.append(
            SongMapSummary(
                name=song_map_path.parent.name,
                path=song_map_path,
                duration_sec=optional_float(data.get("durationSec")),
                bpm=optional_float(data.get("bpm")),
                key=optional_string(data.get("key")),
                mode=optional_string(data.get("mode")),
                section_count=len(sections) if isinstance(sections, list) else 0,
                chord_count=len(chords) if isinstance(chords, list) else 0,
                lyric_count=len(lyrics) if isinstance(lyrics, list) else 0,
                harmony_status=optional_string(harmony_reliability.get("status"))
                if isinstance(harmony_reliability, dict)
                else None,
                harmony_use_case=optional_string(harmony_reliability.get("useCase"))
                if isinstance(harmony_reliability, dict)
                else None,
                harmony_reason=optional_string(harmony_reliability.get("reason"))
                if isinstance(harmony_reliability, dict)
                else None,
                lyrics_status=optional_string(lyrics_status.get("status"))
                if isinstance(lyrics_status, dict)
                else None,
                lyrics_reason=optional_string(lyrics_status.get("reason"))
                if isinstance(lyrics_status, dict)
                else None,
                warnings=[str(value) for value in warnings] if isinstance(warnings, list) else [],
                first_chords=chords[:10] if isinstance(chords, list) else [],
            )
        )
    return summaries


def render_summary(summaries: list[SongMapSummary]) -> str:
    """Render summaries as a Markdown review pack."""

    lines = [
        "# Chord Map Review Summary",
        "",
        "This file compares local research outputs. It is not a product accuracy report.",
        "`useful` means the harmony timeline is reviewable, not accurate. Verify chords by ear before using them as a finished chord sheet.",
        "Harmony reliability and lyrics status are separate; one can be usable while the other is skipped or blocked.",
        "Entries ending in `-asr-smoke` may use the mock whisper helper and only validate the `lyrics[]` JSON path.",
        "Entries ending in `-real-asr` use the configured whisper.cpp path when available; inspect warnings if lyrics are empty.",
        "",
        "## Overview",
        "",
        "| Sample | Harmony | Use case | Harmony reason | Lyrics status | Lyrics reason | Duration | BPM | Key | Sections | Chords | Lyric lines | Warnings |",
        "|---|---|---|---|---|---|---:|---:|---|---:|---:|---:|---:|",
    ]
    for summary in summaries:
        lines.append(
            "| "
            + " | ".join(
                [
                    markdown_escape(summary.name),
                    markdown_escape(summary.harmony_status or "unknown"),
                    markdown_escape(summary.harmony_use_case or "unknown"),
                    markdown_escape(summary.harmony_reason or "unknown"),
                    markdown_escape(summary.lyrics_status or "unknown"),
                    markdown_escape(summary.lyrics_reason or "unknown"),
                    format_seconds(summary.duration_sec),
                    format_number(summary.bpm),
                    markdown_escape(format_key(summary.key, summary.mode)),
                    str(summary.section_count),
                    str(summary.chord_count),
                    str(summary.lyric_count),
                    str(len(summary.warnings)),
                ]
            )
            + " |"
        )

    for summary in summaries:
        lines.extend(
            [
                "",
                f"## {summary.name}",
                "",
                f"- Source JSON: `{summary.path}`",
                f"- Duration: {format_seconds(summary.duration_sec)}",
                f"- BPM: {format_number(summary.bpm)}",
                f"- Key: {format_key(summary.key, summary.mode)}",
                f"- Sections: {summary.section_count}",
                f"- Chord spans: {summary.chord_count}",
                f"- Lyric lines: {summary.lyric_count}",
                f"- Harmony reliability: {format_harmony_reliability(summary)}",
                f"- Harmony use case: {summary.harmony_use_case or 'unknown'}",
                f"- Lyrics status: {format_lyrics_status(summary)}",
                "",
                "### First 10 Chords",
                "",
            ]
        )
        if summary.first_chords:
            lines.extend(render_chord_table(summary.first_chords))
        else:
            lines.append("- None")
        lines.extend(["", "### Warnings", ""])
        if summary.warnings:
            lines.extend(f"- {warning}" for warning in summary.warnings)
        else:
            lines.append("- None")
    return "\n".join(lines) + "\n"


def render_chord_table(chords: list[dict[str, Any]]) -> list[str]:
    """Render a compact chord table."""

    lines = [
        "| Start | End | Chord | Confidence |",
        "|---:|---:|---|---:|",
    ]
    for chord in chords:
        lines.append(
            "| "
            + " | ".join(
                [
                    format_seconds(optional_float(chord.get("startSec"))),
                    format_seconds(optional_float(chord.get("endSec"))),
                    markdown_escape(str(chord.get("chord", ""))),
                    format_number(optional_float(chord.get("confidence"))),
                ]
            )
            + " |"
        )
    return lines


def optional_float(value: Any) -> float | None:
    """Convert a value to float when possible."""

    if isinstance(value, (int, float)):
        return float(value)
    return None


def optional_string(value: Any) -> str | None:
    """Convert a value to a non-empty string when possible."""

    if value is None:
        return None
    text = str(value).strip()
    return text or None


def format_seconds(value: float | None) -> str:
    """Format seconds for a Markdown table."""

    if value is None:
        return "unknown"
    return f"{value:.2f}s"


def format_number(value: float | None) -> str:
    """Format a numeric value for a Markdown table."""

    if value is None:
        return "unknown"
    return f"{value:.2f}"


def format_key(key: str | None, mode: str | None) -> str:
    """Format key and mode together."""

    if key is None:
        return "unknown"
    return f"{key} {mode}".strip() if mode else key


def format_harmony_reliability(summary: SongMapSummary) -> str:
    """Format harmony reliability status and reason for a summary row."""

    status = summary.harmony_status or "unknown"
    if summary.harmony_reason:
        return f"{status} - {summary.harmony_reason}"
    return status


def format_lyrics_status(summary: SongMapSummary) -> str:
    """Format lyrics status and reason for a summary row."""

    status = summary.lyrics_status or "unknown"
    if summary.lyrics_reason:
        return f"{status} - {summary.lyrics_reason}"
    return status


def markdown_escape(value: str) -> str:
    """Escape table-sensitive Markdown characters."""

    return value.replace("|", "\\|")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
