#!/usr/bin/env python3
"""Generate a research Song Map / Chord Map artifact from an audio file."""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import essentia.standard as es


SAMPLE_RATE = 44100
ASR_SAMPLE_RATE = 16000
FRAME_SIZE = 4096
HOP_SIZE = 2048


@dataclass
class ChordSpan:
    """One chord estimate over a time span."""

    start_sec: float
    end_sec: float
    chord: str
    confidence: float


@dataclass
class LyricLine:
    """One ASR lyric line with line-level timing."""

    start_sec: float
    end_sec: float
    text: str


@dataclass
class SectionSpan:
    """One conservative song section candidate."""

    section_id: str
    label: str
    start_sec: float
    end_sec: float


@dataclass
class AnalysisResult:
    """Combined song-map analysis result."""

    duration_sec: float
    bpm: float | None
    key: str | None
    mode: str | None
    beats: list[float]
    chords: list[ChordSpan]
    lyrics: list[LyricLine]
    sections: list[SectionSpan]
    warnings: list[str]


def main(argv: list[str]) -> int:
    """Run chord-map analysis and write JSON and Markdown outputs."""

    if len(argv) != 3:
        print("Usage: run-chord-map <input-audio> <output-directory>", file=sys.stderr)
        return 2

    input_path = Path(argv[1])
    output_dir = Path(argv[2])
    if not input_path.is_file():
        print(f"Input audio does not exist: {input_path}", file=sys.stderr)
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    started_at = time.monotonic()
    warnings: list[str] = []
    report_lines: list[str] = [
        "# Chord Map Prototype Report",
        "",
        f"- Input: `{input_path}`",
        "- Scope: lead-sheet style song map, not complete multi-instrument sheet music.",
    ]

    run_dir = Path(tempfile.mkdtemp(prefix=".chord-map-", dir=output_dir))
    try:
        analysis_wav, asr_wav = prepare_audio_inputs(input_path, run_dir, warnings)

        result = analyze_song_map(analysis_wav, asr_wav, warnings)
        elapsed = time.monotonic() - started_at
        write_json(output_dir / "song-map.json", result)
        write_report(output_dir / "report.md", report_lines, result, elapsed, blocker=None)
        print(f"Song map: {output_dir / 'song-map.json'}")
        print(f"Report: {output_dir / 'report.md'}")
        print(f"Elapsed: {elapsed:.2f}s")
        return 0
    except Exception as exception:
        elapsed = time.monotonic() - started_at
        write_blocker_report(output_dir / "report.md", report_lines, exception, elapsed, warnings)
        print(f"Chord Map prototype failed: {exception}", file=sys.stderr)
        print(f"Report: {output_dir / 'report.md'}", file=sys.stderr)
        return 1
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)


def prepare_audio_inputs(input_path: Path, run_dir: Path, warnings: list[str]) -> tuple[Path, Path]:
    """Return analysis and ASR audio paths, using FFmpeg normalization when available."""

    if shutil.which("ffmpeg") is None:
        warnings.append(
            "FFmpeg is unavailable in the lean research image; analyzing the source audio directly."
        )
        return input_path, input_path

    analysis_wav = run_dir / "analysis.wav"
    asr_wav = run_dir / "asr.wav"
    normalize_audio(input_path, analysis_wav, SAMPLE_RATE)
    normalize_audio(input_path, asr_wav, ASR_SAMPLE_RATE)
    return analysis_wav, asr_wav


def normalize_audio(input_path: Path, output_path: Path, sample_rate: int) -> None:
    """Normalize input audio to mono PCM WAV for downstream analysis."""

    command = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(input_path),
        "-ar",
        str(sample_rate),
        "-ac",
        "1",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]
    run_command(command, "ffmpeg normalization")


def analyze_song_map(analysis_wav: Path, asr_wav: Path, warnings: list[str]) -> AnalysisResult:
    """Run MIR and ASR analysis for one normalized audio file."""

    loader = es.MonoLoader(filename=str(analysis_wav), sampleRate=SAMPLE_RATE)
    audio = loader()
    duration_sec = len(audio) / SAMPLE_RATE
    if duration_sec <= 0:
        raise ValueError("Normalized audio is empty.")

    bpm, beats = analyze_rhythm(audio, warnings)
    key, mode = analyze_key(audio, warnings)
    chords = analyze_chords(audio, duration_sec, warnings)
    lyrics = analyze_lyrics(asr_wav, warnings)
    sections = build_sections(duration_sec, beats, lyrics, chords)

    if not lyrics:
        warnings.append("No lyric lines were detected; instrumental audio is supported with empty lyrics.")
    if not chords:
        warnings.append("No chord spans were produced; chord confidence may be too low for this sample.")

    return AnalysisResult(
        duration_sec=duration_sec,
        bpm=bpm,
        key=key,
        mode=mode,
        beats=beats,
        chords=chords,
        lyrics=lyrics,
        sections=sections,
        warnings=dedupe_strings(warnings),
    )


def analyze_rhythm(audio: Any, warnings: list[str]) -> tuple[float | None, list[float]]:
    """Estimate BPM and beat positions with Essentia."""

    try:
        rhythm = es.RhythmExtractor2013(method="multifeature")
        bpm, beats, _confidence, _estimates, _intervals = rhythm(audio)
        return float(bpm), [float(value) for value in beats]
    except Exception as exception:
        warnings.append(f"Rhythm analysis failed: {exception}")
        return None, []


def analyze_key(audio: Any, warnings: list[str]) -> tuple[str | None, str | None]:
    """Estimate key and mode with Essentia."""

    try:
        key, scale, _strength = es.KeyExtractor()(audio)
        return str(key), str(scale)
    except Exception as exception:
        warnings.append(f"Key analysis failed: {exception}")
        return None, None


def analyze_chords(audio: Any, duration_sec: float, warnings: list[str]) -> list[ChordSpan]:
    """Estimate and merge chord spans with Essentia HPCP and ChordsDetection."""

    try:
        window = es.Windowing(type="blackmanharris62")
        spectrum = es.Spectrum()
        peaks = es.SpectralPeaks(
            orderBy="magnitude",
            magnitudeThreshold=0.00001,
            minFrequency=40,
            maxFrequency=5000,
            maxPeaks=100,
        )
        hpcp = es.HPCP(size=36, referenceFrequency=440)
        profiles: list[Any] = []
        for frame in es.FrameGenerator(audio, frameSize=FRAME_SIZE, hopSize=HOP_SIZE, startFromZero=True):
            frequencies, magnitudes = peaks(spectrum(window(frame)))
            profiles.append(hpcp(frequencies, magnitudes))

        if not profiles:
            warnings.append("Chord analysis skipped because no HPCP frames were produced.")
            return []

        chords, strengths = es.ChordsDetection(hopSize=HOP_SIZE, sampleRate=SAMPLE_RATE)(profiles)
        raw_spans: list[ChordSpan] = []
        hop_seconds = HOP_SIZE / SAMPLE_RATE
        for index, chord_name in enumerate(chords):
            start_sec = index * hop_seconds
            end_sec = min(duration_sec, (index + 1) * hop_seconds)
            strength = float(strengths[index]) if index < len(strengths) else 0.0
            raw_spans.append(ChordSpan(start_sec, end_sec, str(chord_name), strength))

        merged = merge_chord_spans(raw_spans)
        return smooth_short_chord_spans(merged, min_duration_sec=0.75)
    except Exception as exception:
        warnings.append(f"Chord analysis failed: {exception}")
        return []


def merge_chord_spans(spans: list[ChordSpan]) -> list[ChordSpan]:
    """Merge adjacent spans with the same chord label."""

    if not spans:
        return []

    merged: list[ChordSpan] = []
    current = spans[0]
    confidence_values = [current.confidence]
    for span in spans[1:]:
        if span.chord == current.chord and math.isclose(span.start_sec, current.end_sec, abs_tol=0.1):
            current.end_sec = span.end_sec
            confidence_values.append(span.confidence)
            current.confidence = sum(confidence_values) / len(confidence_values)
        else:
            merged.append(current)
            current = span
            confidence_values = [current.confidence]
    merged.append(current)
    return merged


def smooth_short_chord_spans(spans: list[ChordSpan], min_duration_sec: float) -> list[ChordSpan]:
    """Merge very short chord flickers into neighboring spans when possible."""

    if len(spans) < 3:
        return spans

    output: list[ChordSpan] = []
    index = 0
    while index < len(spans):
        span = spans[index]
        duration = span.end_sec - span.start_sec
        if 0 < index < len(spans) - 1 and duration < min_duration_sec:
            previous = output[-1]
            next_span = spans[index + 1]
            if previous.chord == next_span.chord:
                previous.end_sec = next_span.end_sec
                previous.confidence = (previous.confidence + next_span.confidence) / 2
                index += 2
                continue
        output.append(span)
        index += 1
    return output


def analyze_lyrics(asr_wav: Path, warnings: list[str]) -> list[LyricLine]:
    """Run whisper.cpp and parse line-level lyric timestamps."""

    try:
        whisper_cli = find_whisper_cli()
        if whisper_cli is None:
            warnings.append(
                "ASR analysis skipped: whisper.cpp binary is not available in this lean research image."
            )
            return []

        model_path = ensure_whisper_model()
        output_base = asr_wav.with_suffix("")
        command = [
            str(whisper_cli),
            "-m",
            str(model_path),
            "-f",
            str(asr_wav),
            "-oj",
            "-of",
            str(output_base),
            "-nt",
        ]
        run_command(command, "whisper.cpp ASR")
        json_path = output_base.with_suffix(".json")
        if not json_path.is_file():
            warnings.append("whisper.cpp finished without writing JSON; lyrics are empty.")
            return []
        data = json.loads(json_path.read_text(encoding="utf8"))
        lyrics = extract_lyrics(data)
        if not lyrics:
            warnings.append("whisper.cpp JSON contained no lyric segments.")
        return lyrics
    except Exception as exception:
        warnings.append(f"ASR analysis failed: {exception}")
        return []


def find_whisper_cli() -> Path | None:
    """Return a configured whisper.cpp CLI binary when one is available."""

    configured = os.environ.get("WHISPER_CPP_BIN")
    candidates = [
        Path(configured) if configured else None,
        Path("/opt/whisper.cpp/build/bin/whisper-cli"),
        Path("/usr/local/bin/whisper-cli"),
    ]
    for candidate in candidates:
        if candidate is not None and candidate.is_file():
            return candidate
    return None


def ensure_whisper_model() -> Path:
    """Return the cached whisper.cpp model path, downloading it if needed."""

    configured = os.environ.get("WHISPER_CPP_MODEL")
    model_path = Path(configured) if configured else Path("/workspace/cache/whisper/ggml-base.bin")
    if model_path.is_file() and model_path.stat().st_size > 0:
        return model_path

    raise FileNotFoundError(
        f"whisper.cpp model not found at {model_path}; mount or cache ggml-base.bin before enabling ASR."
    )


def extract_lyrics(data: Any) -> list[LyricLine]:
    """Extract line-level lyrics from known whisper.cpp JSON shapes."""

    segments = data.get("transcription", []) if isinstance(data, dict) else []
    lyrics: list[LyricLine] = []
    for segment in segments:
        if not isinstance(segment, dict):
            continue
        text = str(segment.get("text", "")).strip()
        if not text:
            continue
        start_sec, end_sec = segment_times(segment)
        if start_sec is None or end_sec is None or end_sec <= start_sec:
            continue
        lyrics.append(LyricLine(start_sec, end_sec, text))
    return sorted(lyrics, key=lambda line: line.start_sec)


def segment_times(segment: dict[str, Any]) -> tuple[float | None, float | None]:
    """Read start and end seconds from one whisper.cpp segment."""

    offsets = segment.get("offsets")
    if isinstance(offsets, dict) and "from" in offsets and "to" in offsets:
        return float(offsets["from"]) / 1000.0, float(offsets["to"]) / 1000.0

    timestamps = segment.get("timestamps")
    if isinstance(timestamps, dict) and "from" in timestamps and "to" in timestamps:
        return parse_timestamp(str(timestamps["from"])), parse_timestamp(str(timestamps["to"]))

    start = segment.get("start")
    end = segment.get("end")
    if isinstance(start, (int, float)) and isinstance(end, (int, float)):
        return float(start), float(end)
    return None, None


def parse_timestamp(value: str) -> float | None:
    """Parse HH:MM:SS.mmm or HH:MM:SS,mmm into seconds."""

    normalized = value.replace(",", ".")
    parts = normalized.split(":")
    if len(parts) != 3:
        return None
    try:
        hours = float(parts[0])
        minutes = float(parts[1])
        seconds = float(parts[2])
    except ValueError:
        return None
    return hours * 3600 + minutes * 60 + seconds


def build_sections(
    duration_sec: float,
    beats: list[float],
    lyrics: list[LyricLine],
    chords: list[ChordSpan],
) -> list[SectionSpan]:
    """Build conservative section candidates from beats, lyrics, and chord spans."""

    boundaries = [0.0, duration_sec]
    first_lyric_start = lyrics[0].start_sec if lyrics else None
    if first_lyric_start is not None and first_lyric_start >= 5.0:
        boundaries.append(align_to_previous_beat(first_lyric_start, beats))

    if len(beats) >= 32:
        start_index = nearest_beat_index(boundaries[-1] if len(boundaries) > 2 else 0.0, beats)
        for beat_index in range(start_index + 32, len(beats), 32):
            boundaries.append(float(beats[beat_index]))
    else:
        chunk = 30.0
        cursor = chunk
        while cursor < duration_sec:
            boundaries.append(cursor)
            cursor += chunk

    for current, next_line in zip(lyrics, lyrics[1:]):
        if next_line.start_sec - current.end_sec >= 8.0:
            boundaries.append(align_to_previous_beat(next_line.start_sec, beats))

    if chords:
        boundaries.extend(repeated_chord_boundaries(chords))

    clean_boundaries = normalize_boundaries(boundaries, duration_sec)
    return label_sections(clean_boundaries, first_lyric_start)


def align_to_previous_beat(value: float, beats: list[float]) -> float:
    """Return the closest previous beat, or the original value without beats."""

    previous = [beat for beat in beats if beat <= value]
    return float(previous[-1]) if previous else value


def nearest_beat_index(value: float, beats: list[float]) -> int:
    """Return the index of the nearest beat at or after value."""

    for index, beat in enumerate(beats):
        if beat >= value:
            return index
    return max(0, len(beats) - 1)


def repeated_chord_boundaries(chords: list[ChordSpan]) -> list[float]:
    """Return rough boundaries from repeated chord groups."""

    labels = [span.chord for span in chords if span.end_sec - span.start_sec >= 1.0]
    if len(labels) < 8:
        return []

    boundaries: list[float] = []
    for index in range(4, len(chords) - 4, 4):
        previous_group = [span.chord for span in chords[index - 4 : index]]
        next_group = [span.chord for span in chords[index : index + 4]]
        if previous_group == next_group:
            boundaries.append(chords[index].start_sec)
    return boundaries


def normalize_boundaries(values: list[float], duration_sec: float) -> list[float]:
    """Sort, clamp, and remove section boundaries that are too close."""

    clamped = sorted({round(min(max(value, 0.0), duration_sec), 3) for value in values})
    output: list[float] = []
    for value in clamped:
        if not output or value - output[-1] >= 8.0 or math.isclose(value, duration_sec):
            output.append(value)
    if output[0] != 0.0:
        output.insert(0, 0.0)
    if not math.isclose(output[-1], duration_sec):
        output.append(duration_sec)
    if len(output) >= 3 and output[-1] - output[-2] < 4.0:
        output.pop(-2)
    return output


def label_sections(boundaries: list[float], first_lyric_start: float | None) -> list[SectionSpan]:
    """Create conservative section labels for normalized boundaries."""

    sections: list[SectionSpan] = []
    alpha_index = 0
    for index in range(len(boundaries) - 1):
        start = boundaries[index]
        end = boundaries[index + 1]
        if end <= start:
            continue
        if index == 0 and first_lyric_start is not None and end <= first_lyric_start + 2.0:
            label = "Intro"
        else:
            label = f"Section {chr(ord('A') + (alpha_index % 26))}"
            alpha_index += 1
        sections.append(SectionSpan(f"section-{len(sections) + 1}", label, start, end))
    return sections


def write_json(path: Path, result: AnalysisResult) -> None:
    """Write the song-map JSON artifact."""

    artifact = {
        "durationSec": round(result.duration_sec, 3),
        "bpm": round(result.bpm, 2) if result.bpm is not None else None,
        "key": result.key,
        "mode": result.mode,
        "sections": [
            {
                "id": section.section_id,
                "label": section.label,
                "startSec": round(section.start_sec, 3),
                "endSec": round(section.end_sec, 3),
            }
            for section in result.sections
        ],
        "chords": [
            {
                "startSec": round(chord.start_sec, 3),
                "endSec": round(chord.end_sec, 3),
                "chord": chord.chord,
                "confidence": round(chord.confidence, 3),
            }
            for chord in result.chords
        ],
        "lyrics": [
            {
                "startSec": round(line.start_sec, 3),
                "endSec": round(line.end_sec, 3),
                "text": line.text,
            }
            for line in result.lyrics
        ],
        "warnings": result.warnings,
    }
    path.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def write_report(
    path: Path,
    lines: list[str],
    result: AnalysisResult,
    elapsed: float,
    blocker: Exception | None,
) -> None:
    """Write a human-readable Markdown report."""

    report = list(lines)
    report.extend(
        [
            "",
            "## Result",
            "",
            f"- Status: {'blocked' if blocker else 'ok'}",
            f"- Elapsed: {elapsed:.2f}s",
            f"- Duration: {result.duration_sec:.2f}s",
            f"- BPM: {format_optional(result.bpm)}",
            f"- Key: {result.key or 'unknown'} {result.mode or ''}".strip(),
            f"- Sections: {len(result.sections)}",
            f"- Chord spans: {len(result.chords)}",
            f"- Lyric lines: {len(result.lyrics)}",
            "",
            "## Warnings",
            "",
        ]
    )
    if result.warnings:
        report.extend(f"- {warning}" for warning in result.warnings)
    else:
        report.append("- None")
    report.extend(["", "## Notes", "", "This report is a lead-sheet style analysis, not complete multi-instrument sheet music."])
    path.write_text("\n".join(report) + "\n", encoding="utf8")


def write_blocker_report(
    path: Path,
    lines: list[str],
    exception: Exception,
    elapsed: float,
    warnings: list[str],
) -> None:
    """Write a blocker report after an unrecoverable failure."""

    report = list(lines)
    report.extend(
        [
            "",
            "## Result",
            "",
            "- Status: blocked",
            f"- Elapsed: {elapsed:.2f}s",
            f"- Blocker: {exception}",
            "",
            "## Warnings",
            "",
        ]
    )
    if warnings:
        report.extend(f"- {warning}" for warning in dedupe_strings(warnings))
    else:
        report.append("- None")
    report.extend(["", "## Notes", "", "No product workflow was changed. This is a research prototype failure report."])
    path.write_text("\n".join(report) + "\n", encoding="utf8")


def run_command(command: list[str], description: str) -> None:
    """Run an external command and raise a specific error on failure."""

    completed = subprocess.run(command, check=False, text=True, capture_output=True)
    if completed.returncode != 0:
        stderr = completed.stderr.strip()
        stdout = completed.stdout.strip()
        detail = stderr or stdout or f"exit code {completed.returncode}"
        raise RuntimeError(f"{description} failed: {detail}")


def format_optional(value: float | None) -> str:
    """Format an optional float for reports."""

    return "unknown" if value is None else f"{value:.2f}"


def dedupe_strings(values: list[str]) -> list[str]:
    """Return strings in first-seen order without duplicates."""

    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            output.append(value)
    return output


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
