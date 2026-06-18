#!/usr/bin/env python3
"""Prepare local GuitarSet audio samples and chord references for Chord Map evaluation."""

from __future__ import annotations

import json
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_DATA_ROOT = Path(".isolation/chord-map/guitarset")
DEFAULT_INPUT_ROOT = Path(".isolation/chord-map/input")
DEFAULT_REFERENCE_ROOT = Path(".isolation/chord-map/reference")
ANNOTATION_ZIP = "annotation.zip"
AUDIO_ZIP = "audio_mono-mic.zip"

PREFERRED_STEMS = [
    "00_SS2-88-F_comp",
    "00_Rock1-130-A_comp",
    "00_Funk1-97-C_comp",
    "00_BN1-129-Eb_comp",
    "00_Jazz3-137-Eb_comp",
]

STYLE_HINTS = {
    "SS": "singer-songwriter",
    "Rock": "rock",
    "Funk": "funk",
    "BN": "bossa nova",
    "Jazz": "jazz",
}


@dataclass(frozen=True)
class PreparedSample:
    """One prepared GuitarSet sample."""

    stem: str
    input_path: Path
    reference_path: Path
    chord_count: int
    duration_sec: float


def main(argv: list[str]) -> int:
    """Prepare local GuitarSet samples and reference chord JSON files."""

    data_root = Path(argv[1]) if len(argv) > 1 else DEFAULT_DATA_ROOT
    input_root = Path(argv[2]) if len(argv) > 2 else DEFAULT_INPUT_ROOT
    reference_root = Path(argv[3]) if len(argv) > 3 else DEFAULT_REFERENCE_ROOT

    annotation_zip = data_root / ANNOTATION_ZIP
    audio_zip = data_root / AUDIO_ZIP
    if not annotation_zip.is_file():
        print(f"Missing GuitarSet annotation zip: {annotation_zip}", file=sys.stderr)
        return 2
    if not audio_zip.is_file():
        print(f"Missing GuitarSet mono audio zip: {audio_zip}", file=sys.stderr)
        return 2

    input_root.mkdir(parents=True, exist_ok=True)
    reference_root.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(annotation_zip) as annotation_archive, zipfile.ZipFile(audio_zip) as audio_archive:
        annotation_members = {Path(name).stem: name for name in annotation_archive.namelist() if name.endswith(".jams")}
        audio_members = audio_member_index(audio_archive)
        prepared = [
            prepare_sample(stem, annotation_members, audio_members, annotation_archive, audio_archive, input_root, reference_root)
            for stem in PREFERRED_STEMS
            if stem in annotation_members and stem in audio_members
        ]

    if not prepared:
        print("No preferred GuitarSet samples could be prepared.", file=sys.stderr)
        return 1

    manifest_path = reference_root / "guitarset-reference-pack.json"
    manifest_path.write_text(json.dumps(render_manifest(prepared), indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    for sample in prepared:
        print(f"{sample.stem}: {sample.chord_count} chords, {sample.duration_sec:.2f}s")
    print(f"Manifest: {manifest_path}")
    return 0


def audio_member_index(audio_archive: zipfile.ZipFile) -> dict[str, str]:
    """Map GuitarSet sample stems to audio zip members."""

    result: dict[str, str] = {}
    for name in audio_archive.namelist():
        path = Path(name)
        if path.suffix.lower() not in {".wav", ".flac", ".ogg", ".mp3"}:
            continue
        stem = path.stem
        if stem.endswith("_mic"):
            stem = stem[: -len("_mic")]
        result[stem] = name
    return result


def prepare_sample(
    stem: str,
    annotation_members: dict[str, str],
    audio_members: dict[str, str],
    annotation_archive: zipfile.ZipFile,
    audio_archive: zipfile.ZipFile,
    input_root: Path,
    reference_root: Path,
) -> PreparedSample:
    """Extract one GuitarSet audio file and write its reference chords."""

    audio_member = audio_members[stem]
    audio_suffix = Path(audio_member).suffix.lower()
    input_path = input_root / f"guitarset-{stem}{audio_suffix}"
    if not input_path.is_file():
        with audio_archive.open(audio_member) as source, input_path.open("wb") as target:
            shutil.copyfileobj(source, target)

    annotation = json.loads(annotation_archive.read(annotation_members[stem]))
    duration_sec = float(annotation.get("file_metadata", {}).get("duration", 0.0) or 0.0)
    chords = reference_chords(annotation)
    reference_dir = reference_root / f"guitarset-{stem}"
    reference_dir.mkdir(parents=True, exist_ok=True)
    reference_path = reference_dir / "chords.json"
    reference_path.write_text(
        json.dumps(
            {
                "dataset": "GuitarSet",
                "source": "https://zenodo.org/records/3371780",
                "license": "CC BY 4.0",
                "sample": stem,
                "style": style_hint(stem),
                "durationSec": round(duration_sec, 3),
                "chords": chords,
            },
            indent=2,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf8",
    )
    return PreparedSample(stem, input_path, reference_path, len(chords), duration_sec)


def reference_chords(annotation: dict[str, Any]) -> list[dict[str, object]]:
    """Return simplified chord reference spans from one GuitarSet JAMS object."""

    chord_annotations = [item for item in annotation.get("annotations", []) if item.get("namespace") == "chord"]
    if not chord_annotations:
        return []
    chosen = sorted(chord_annotations, key=chord_annotation_rank)[-1]
    chords = []
    for item in chosen.get("data", []):
        start_sec = float(item.get("time", 0.0) or 0.0)
        duration_sec = float(item.get("duration", 0.0) or 0.0)
        if duration_sec <= 0:
            continue
        source_chord = str(item.get("value", "")).strip()
        chord = simplify_jams_chord(source_chord)
        if not chord:
            continue
        chords.append(
            {
                "startSec": round(start_sec, 3),
                "endSec": round(start_sec + duration_sec, 3),
                "chord": chord,
                "sourceChord": source_chord,
            }
        )
    return chords


def chord_annotation_rank(annotation: dict[str, Any]) -> tuple[int, int]:
    """Rank chord annotations so manually verified labels win."""

    metadata = annotation.get("annotation_metadata", {})
    source = str(metadata.get("data_source", "")).lower()
    manual_rank = 1 if "manual" in source or "verification" in source else 0
    return manual_rank, len(annotation.get("data", []))


def simplify_jams_chord(value: str) -> str:
    """Convert a JAMS chord label to the simple labels used by the evaluator."""

    core = value.split("/", 1)[0].strip()
    if not core or core.upper() in {"N", "X"}:
        return "N"
    if ":" not in core:
        return core
    root, quality = core.split(":", 1)
    quality = quality.lower()
    if quality in {"maj", "major"}:
        return root
    if quality in {"min", "minor"}:
        return f"{root}m"
    if quality in {"min7", "minor7"}:
        return f"{root}m7"
    if quality in {"maj7", "major7"}:
        return f"{root}maj7"
    if quality == "7":
        return f"{root}7"
    if quality in {"hdim7", "min7b5"}:
        return f"{root}m7b5"
    if quality.startswith("dim"):
        return f"{root}dim"
    if quality.startswith("aug"):
        return f"{root}aug"
    return f"{root}{quality}"


def style_hint(stem: str) -> str:
    """Return a compact style hint from a GuitarSet sample stem."""

    for token, label in STYLE_HINTS.items():
        if token in stem:
            return label
    return "unknown"


def render_manifest(prepared: list[PreparedSample]) -> dict[str, object]:
    """Return a manifest describing the prepared local-only reference pack."""

    return {
        "dataset": "GuitarSet",
        "source": "https://zenodo.org/records/3371780",
        "license": "CC BY 4.0",
        "samples": [
            {
                "sample": sample.stem,
                "input": str(sample.input_path),
                "reference": str(sample.reference_path),
                "chordCount": sample.chord_count,
                "durationSec": round(sample.duration_sec, 3),
            }
            for sample in prepared
        ],
    }


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
