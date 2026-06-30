#!/usr/bin/env python3
"""Prepare public singing samples and lyric references for ASR evaluation."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


DEFAULT_INPUT_ROOT = Path(".isolation/chord-map/input")
DEFAULT_REFERENCE_ROOT = Path(".isolation/chord-map/reference")
DEFAULT_SAMPLE_ROOT = Path(".isolation/chord-map/public-song-asr")


@dataclass(frozen=True)
class PublicSongSample:
    """One public singing sample and its lyric reference source."""

    slug: str
    title: str
    audio_url: str
    audio_page: str
    audio_license: str
    reference_kind: str
    reference_source: str
    reference_note: str
    transcode_to_wav: bool = False
    text_lines: tuple[str, ...] = ()


SAMPLES = (
    PublicSongSample(
        slug="la-marseillaise-commons",
        title="La Marseillaise",
        audio_url="https://upload.wikimedia.org/wikipedia/commons/3/30/La_Marseillaise.ogg",
        audio_page="https://commons.wikimedia.org/wiki/File:La_Marseillaise.ogg",
        audio_license="Public domain",
        reference_kind="commons-timedtext-srt",
        reference_source="TimedText:La Marseillaise.ogg.fr.srt",
        reference_note="French line-level SRT from Wikimedia Commons TimedText.",
    ),
    PublicSongSample(
        slug="star-spangled-solo",
        title="The Star-Spangled Banner - solo vocalist",
        audio_url="https://upload.wikimedia.org/wikipedia/commons/4/4d/%22The_Star-Spangled_Banner%22_-_Solo_vocalist_-_U.S._Navy_Band.oga",
        audio_page=(
            "https://commons.wikimedia.org/wiki/"
            "File:%22The_Star-Spangled_Banner%22_-_Solo_vocalist_-_U.S._Navy_Band.oga"
        ),
        audio_license="Public domain",
        reference_kind="text-only",
        reference_source="https://en.wikisource.org/wiki/The_Star-Spangled_Banner",
        reference_note="Public-domain first stanza used by standard anthem performances; no line timing reference.",
        transcode_to_wav=True,
        text_lines=(
            "O say can you see, by the dawn's early light,",
            "What so proudly we hailed at the twilight's last gleaming,",
            "Whose broad stripes and bright stars through the perilous fight,",
            "O'er the ramparts we watched, were so gallantly streaming?",
            "And the rockets' red glare, the bombs bursting in air,",
            "Gave proof through the night that our flag was still there;",
            "O say does that star-spangled banner yet wave",
            "O'er the land of the free and the home of the brave?",
        ),
    ),
    PublicSongSample(
        slug="star-spangled-choral",
        title="The Star-Spangled Banner - choral with band accompaniment",
        audio_url="https://upload.wikimedia.org/wikipedia/commons/5/5e/%22The_Star-Spangled_Banner%22_-_Choral_with_band_accompaniment_-_United_States_Army_Field_Band.oga",
        audio_page=(
            "https://commons.wikimedia.org/wiki/"
            "File:%22The_Star-Spangled_Banner%22_-_Choral_with_band_accompaniment_-_United_States_Army_Field_Band.oga"
        ),
        audio_license="Public domain",
        reference_kind="text-only",
        reference_source="https://en.wikisource.org/wiki/The_Star-Spangled_Banner",
        reference_note="Public-domain first stanza used by standard anthem performances; no line timing reference.",
        transcode_to_wav=True,
        text_lines=(
            "O say can you see, by the dawn's early light,",
            "What so proudly we hailed at the twilight's last gleaming,",
            "Whose broad stripes and bright stars through the perilous fight,",
            "O'er the ramparts we watched, were so gallantly streaming?",
            "And the rockets' red glare, the bombs bursting in air,",
            "Gave proof through the night that our flag was still there;",
            "O say does that star-spangled banner yet wave",
            "O'er the land of the free and the home of the brave?",
        ),
    ),
)

HTTP_HEADERS = {
    "User-Agent": "Oh-My-Score Chord Map research contact: local-evaluation",
}


def main() -> int:
    """Prepare public song ASR evaluation fixtures under the isolation directory."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-root", type=Path, default=DEFAULT_INPUT_ROOT)
    parser.add_argument("--reference-root", type=Path, default=DEFAULT_REFERENCE_ROOT)
    parser.add_argument("--sample-root", type=Path, default=DEFAULT_SAMPLE_ROOT)
    args = parser.parse_args()

    args.input_root.mkdir(parents=True, exist_ok=True)
    args.reference_root.mkdir(parents=True, exist_ok=True)
    args.sample_root.mkdir(parents=True, exist_ok=True)

    manifest: dict[str, Any] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "purpose": "Real singing ASR reference pack for Chord Map research.",
        "samples": [],
    }
    for sample in SAMPLES:
        download_path = args.input_root / f"{sample.slug}{audio_suffix(sample.audio_url)}"
        audio_path = args.input_root / f"{sample.slug}.wav" if sample.transcode_to_wav else download_path
        reference_path = args.reference_root / sample.slug / "lyrics.json"
        reference_path.parent.mkdir(parents=True, exist_ok=True)

        download_file(sample.audio_url, download_path)
        if sample.transcode_to_wav:
            transcode_audio(download_path, audio_path)
        lyrics = reference_lyrics(sample)
        write_json(
            reference_path,
            {
                "source": {
                    "title": sample.title,
                    "audioUrl": sample.audio_url,
                    "audioPage": sample.audio_page,
                    "audioLicense": sample.audio_license,
                    "referenceKind": sample.reference_kind,
                    "referenceSource": sample.reference_source,
                    "referenceNote": sample.reference_note,
                },
                "lyrics": lyrics,
            },
        )
        manifest["samples"].append(
            {
                "slug": sample.slug,
                "title": sample.title,
                "audioPath": str(audio_path),
                "referencePath": str(reference_path),
                "audioLicense": sample.audio_license,
                "referenceKind": sample.reference_kind,
                "lineCount": len(lyrics),
                "hasLineTiming": any("startSec" in line and "endSec" in line for line in lyrics),
            }
        )
        print(f"Prepared {sample.slug}: {audio_path} -> {reference_path}")

    write_json(args.sample_root / "public-song-asr-manifest.json", manifest)
    return 0


def audio_suffix(url: str) -> str:
    """Return the audio suffix for one download URL."""

    suffix = Path(urllib.parse.urlparse(url).path).suffix
    return suffix if suffix else ".audio"


def download_file(url: str, destination: Path) -> None:
    """Download one file unless it already exists."""

    if destination.is_file() and destination.stat().st_size > 0:
        return
    for attempt in range(1, 4):
        try:
            request = urllib.request.Request(url, headers=HTTP_HEADERS)
            with urllib.request.urlopen(request, timeout=60) as response:
                destination.write_bytes(response.read())
            return
        except urllib.error.HTTPError as exception:
            if exception.code not in (429, 503) or attempt == 3:
                raise
            time.sleep(5 * attempt)


def transcode_audio(source: Path, destination: Path) -> None:
    """Transcode an audio file to a mono WAV that Essentia can read."""

    if destination.is_file() and destination.stat().st_size > 0:
        return
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise FileNotFoundError("ffmpeg is required to prepare this public song sample as WAV.")
    subprocess.run(
        [ffmpeg, "-y", "-i", str(source), "-ac", "1", "-ar", "44100", str(destination)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def reference_lyrics(sample: PublicSongSample) -> list[dict[str, object]]:
    """Load reference lyric lines for one sample."""

    if sample.reference_kind == "commons-timedtext-srt":
        return commons_timedtext_lyrics(sample.reference_source)
    if sample.reference_kind == "text-only":
        return [{"text": line} for line in sample.text_lines]
    raise ValueError(f"Unsupported reference kind: {sample.reference_kind}")


def commons_timedtext_lyrics(title: str) -> list[dict[str, object]]:
    """Fetch and parse Wikimedia Commons TimedText SRT into lyric lines."""

    params = urllib.parse.urlencode(
        {
            "action": "query",
            "titles": title,
            "prop": "revisions",
            "rvprop": "content",
            "format": "json",
        }
    )
    url = f"https://commons.wikimedia.org/w/api.php?{params}"
    request = urllib.request.Request(url, headers=HTTP_HEADERS)
    with urllib.request.urlopen(request, timeout=60) as response:
        data = json.loads(response.read().decode("utf8"))
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        revisions = page.get("revisions", []) if isinstance(page, dict) else []
        if revisions:
            content = revisions[0].get("*", "")
            return parse_srt(content)
    raise ValueError(f"No TimedText content found for {title}")


def parse_srt(content: str) -> list[dict[str, object]]:
    """Parse a small SRT document into Chord Map lyric reference lines."""

    blocks = re.split(r"\n\s*\n", content.strip())
    lines: list[dict[str, object]] = []
    for block in blocks:
        block_lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(block_lines) < 3:
            continue
        match = re.match(r"(.+?)\s+-->\s+(.+)", block_lines[1])
        if match is None:
            continue
        text = " ".join(block_lines[2:]).strip()
        if not text:
            continue
        lines.append(
            {
                "startSec": parse_srt_timestamp(match.group(1)),
                "endSec": parse_srt_timestamp(match.group(2)),
                "text": text,
            }
        )
    return lines


def parse_srt_timestamp(value: str) -> float:
    """Parse one SRT timestamp into seconds."""

    match = re.match(r"(\d+):(\d+):(\d+),(\d+)", value.strip())
    if match is None:
        raise ValueError(f"Invalid SRT timestamp: {value}")
    hours, minutes, seconds, millis = (int(part) for part in match.groups())
    return hours * 3600.0 + minutes * 60.0 + seconds + millis / 1000.0


def write_json(path: Path, data: dict[str, Any]) -> None:
    """Write JSON with stable formatting."""

    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


if __name__ == "__main__":
    raise SystemExit(main())
