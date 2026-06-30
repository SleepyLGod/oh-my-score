#!/usr/bin/env python3
"""Generate a research Song Map / Chord Map artifact from an audio file."""

from __future__ import annotations

import json
import math
import os
import re
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
MIN_READABLE_CHORD_SEC = 1.25
BEAT_SNAP_MAX_DISTANCE_SEC = 0.18
SHORT_CHORD_WARNING_SEC = 0.5
LOW_CONFIDENCE_BLOCK_THRESHOLD = 0.45
LOW_CONFIDENCE_NOISY_THRESHOLD = 0.53
HIGH_CHORD_DENSITY_PER_MINUTE = 24.0
LEAD_SHEET_MAX_CHORD_DENSITY_PER_MINUTE = 18.0
MIN_HARMONIC_COVERAGE = 0.35
PERCUSSIVE_MAX_DURATION_SEC = 15.0
PERCUSSIVE_MAX_CHORD_COUNT = 2
PERCUSSIVE_MAX_UNIQUE_CHORD_COUNT = 1
NON_LYRIC_ASR_MARKERS = {
    "applause",
    "blank audio",
    "foreign language",
    "inaudible",
    "instrumental",
    "laughter",
    "music",
    "silence",
    "singing in foreign language",
}
REPEATED_NON_LYRIC_MARKER_WORDS = {"applause", "laughter", "music", "silence"}


@dataclass
class ChordSpan:
    """One chord estimate over a time span."""

    start_sec: float
    end_sec: float
    chord: str
    confidence: float


@dataclass
class ChordSmoothingStats:
    """Summary of raw-to-readable chord timeline cleanup."""

    raw_span_count: int
    merged_span_count: int
    smoothed_span_count: int
    short_flickers_removed: int
    beat_snapped_count: int
    enharmonic_label_count: int
    short_span_count: int
    average_confidence: float


@dataclass
class ChordAnalysis:
    """Raw and smoothed chord outputs for a research run."""

    raw_chords: list[ChordSpan]
    chords: list[ChordSpan]
    stats: ChordSmoothingStats


@dataclass
class HarmonyReliability:
    """Conservative assessment of whether a harmony timeline is readable enough."""

    status: str
    use_case: str
    reason: str
    signals: dict[str, float | int | bool]
    warnings: list[str]


@dataclass
class LyricsStatus:
    """Status for optional ASR lyric extraction."""

    status: str
    reason: str
    source: str | None


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
    raw_chords: list[ChordSpan]
    chords: list[ChordSpan]
    chord_stats: ChordSmoothingStats
    harmony_reliability: HarmonyReliability
    lyrics_status: LyricsStatus
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
        write_raw_chords(output_dir / "raw-chords.json", result)
        write_report(output_dir / "report.md", report_lines, result, elapsed, blocker=None)
        print(f"Song map: {output_dir / 'song-map.json'}")
        print(f"Raw chords: {output_dir / 'raw-chords.json'}")
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
    chord_analysis = analyze_chords(audio, duration_sec, beats, key, mode, warnings)
    lyrics_status, lyrics = analyze_lyrics(asr_wav, warnings)
    sections = build_sections(duration_sec, beats, lyrics, chord_analysis.chords)
    harmony_reliability = assess_harmony_reliability(duration_sec, chord_analysis)

    if not lyrics:
        warnings.append("No lyric lines were detected; instrumental audio is supported with empty lyrics.")
    if not chord_analysis.chords:
        warnings.append("No chord spans were produced; chord confidence may be too low for this sample.")
    if chord_analysis.stats.average_confidence and chord_analysis.stats.average_confidence < 0.5:
        warnings.append(
            f"Chord confidence is low after smoothing ({chord_analysis.stats.average_confidence:.2f}); review manually."
        )
    if chord_analysis.stats.short_span_count > max(3, len(chord_analysis.chords) // 10):
        warnings.append(
            f"Chord timeline remains fragmented after smoothing ({chord_analysis.stats.short_span_count} spans under {SHORT_CHORD_WARNING_SEC:.1f}s)."
        )
    if harmony_reliability.status != "useful":
        warnings.extend(harmony_reliability.warnings)

    return AnalysisResult(
        duration_sec=duration_sec,
        bpm=bpm,
        key=key,
        mode=mode,
        beats=beats,
        raw_chords=chord_analysis.raw_chords,
        chords=chord_analysis.chords,
        chord_stats=chord_analysis.stats,
        harmony_reliability=harmony_reliability,
        lyrics_status=lyrics_status,
        lyrics=lyrics,
        sections=sections,
        warnings=dedupe_strings(warnings),
    )


def assess_harmony_reliability(duration_sec: float, chord_analysis: ChordAnalysis) -> HarmonyReliability:
    """Classify a harmony timeline as useful, noisy, or blocked from simple signals."""

    chords = chord_analysis.chords
    stats = chord_analysis.stats
    duration_min = max(duration_sec / 60.0, 1.0 / 60.0)
    chord_count = len(chords)
    unique_chord_count = len({span.chord for span in chords if span.chord and span.chord != "N"})
    stable_span_count = sum(1 for span in chords if chord_duration(span) >= MIN_READABLE_CHORD_SEC)
    chord_density_per_minute = chord_count / duration_min
    confident_chord_coverage = confident_chord_coverage_ratio(chords, duration_sec)
    longest_span_sec = max((chord_duration(span) for span in chords), default=0.0)
    percussive_like = (
        duration_sec <= PERCUSSIVE_MAX_DURATION_SEC
        and chord_count <= PERCUSSIVE_MAX_CHORD_COUNT
        and unique_chord_count <= PERCUSSIVE_MAX_UNIQUE_CHORD_COUNT
    )
    too_few_stable_spans = duration_sec >= 20.0 and stable_span_count < 2
    too_many_changes = chord_density_per_minute > HIGH_CHORD_DENSITY_PER_MINUTE
    low_confidence = stats.average_confidence < LOW_CONFIDENCE_BLOCK_THRESHOLD
    borderline_confidence = stats.average_confidence < LOW_CONFIDENCE_NOISY_THRESHOLD
    fragmented_after_smoothing = stats.short_span_count > max(2, chord_count // 8)

    signals: dict[str, float | int | bool] = {
        "averageConfidence": round(stats.average_confidence, 3),
        "chordDensityPerMinute": round(chord_density_per_minute, 2),
        "shortSpanCount": stats.short_span_count,
        "uniqueChordCount": unique_chord_count,
        "stableSpanCount": stable_span_count,
        "confidentChordCoverage": round(confident_chord_coverage, 3),
        "longestSpanSec": round(longest_span_sec, 3),
        "percussiveLike": percussive_like,
    }

    warnings: list[str] = []
    if not chords:
        warnings.append("Chord Map harmony reliability is blocked: no stable chord spans were produced.")
        return HarmonyReliability(
            "blocked",
            "insufficient-harmony",
            "No stable chord spans were produced.",
            signals,
            warnings,
        )
    if percussive_like:
        warnings.append(
            "Chord Map harmony reliability is blocked: input looks mostly percussive, so chord labels may be meaningless."
        )
        return HarmonyReliability(
            "blocked",
            "percussive-blocked",
            "Mostly percussive input; chord labels may be meaningless.",
            signals,
            warnings,
        )
    if low_confidence:
        warnings.append(
            f"Chord Map harmony reliability is blocked: average chord confidence is very low ({stats.average_confidence:.2f})."
        )
        return HarmonyReliability(
            "blocked",
            "insufficient-harmony",
            "Average chord confidence is too low for a readable chord map.",
            signals,
            warnings,
        )
    if confident_chord_coverage < MIN_HARMONIC_COVERAGE:
        warnings.append(
            f"Chord Map harmony reliability is blocked: confident chord coverage is low ({confident_chord_coverage:.2f})."
        )
        return HarmonyReliability(
            "blocked",
            "insufficient-harmony",
            "Too little of the audio has stable harmonic evidence.",
            signals,
            warnings,
        )
    if too_few_stable_spans:
        warnings.append(
            f"Chord Map harmony reliability is blocked: only {stable_span_count} stable chord spans remain after smoothing."
        )
        return HarmonyReliability(
            "blocked",
            "insufficient-harmony",
            "Too few stable chord spans remain after smoothing.",
            signals,
            warnings,
        )

    if borderline_confidence:
        warnings.append(
            f"Chord Map harmony reliability is noisy: average chord confidence is borderline ({stats.average_confidence:.2f})."
        )
    if too_many_changes:
        warnings.append(
            f"Chord Map harmony reliability is noisy: chord changes are dense ({chord_density_per_minute:.1f}/min)."
        )
    if fragmented_after_smoothing:
        warnings.append(
            f"Chord Map harmony reliability is noisy: {stats.short_span_count} short spans remain after smoothing."
        )

    if warnings:
        return HarmonyReliability(
            "noisy",
            "harmonic-review",
            first_reliability_reason(warnings),
            signals,
            warnings,
        )

    if chord_density_per_minute > LEAD_SHEET_MAX_CHORD_DENSITY_PER_MINUTE:
        return HarmonyReliability(
            "useful",
            "harmonic-review",
            "Reviewable harmonic timeline; dense changes are better suited to harmonic review than a simple chord chart.",
            signals,
            [],
        )

    return HarmonyReliability(
        "useful",
        "lead-sheet-friendly",
        "Reviewable chord timeline for a draft lead sheet; verify chords by ear before treating it as accurate.",
        signals,
        [],
    )


def confident_chord_coverage_ratio(chords: list[ChordSpan], duration_sec: float) -> float:
    """Return the share of duration covered by sufficiently confident chord labels."""

    if duration_sec <= 0:
        return 0.0
    confident_duration = sum(
        chord_duration(span)
        for span in chords
        if span.confidence >= LOW_CONFIDENCE_BLOCK_THRESHOLD and span.chord != "N"
    )
    return min(1.0, max(0.0, confident_duration / duration_sec))


def first_reliability_reason(warnings: list[str]) -> str:
    """Extract the first compact reliability reason from warning text."""

    if not warnings:
        return "Chord map harmony reliability needs manual review."
    prefix = "Chord Map harmony reliability is noisy: "
    first = warnings[0]
    if first.startswith(prefix):
        return first[len(prefix) :]
    return first


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


def analyze_chords(
    audio: Any,
    duration_sec: float,
    beats: list[float],
    key: str | None,
    mode: str | None,
    warnings: list[str],
) -> ChordAnalysis:
    """Estimate raw chords and clean them into a readable chord timeline."""

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
            return empty_chord_analysis()

        chords, strengths = es.ChordsDetection(hopSize=HOP_SIZE, sampleRate=SAMPLE_RATE)(profiles)
        raw_spans: list[ChordSpan] = []
        hop_seconds = HOP_SIZE / SAMPLE_RATE
        for index, chord_name in enumerate(chords):
            start_sec = index * hop_seconds
            end_sec = min(duration_sec, (index + 1) * hop_seconds)
            strength = float(strengths[index]) if index < len(strengths) else 0.0
            raw_spans.append(ChordSpan(start_sec, end_sec, str(chord_name), strength))

        merged = merge_chord_spans(raw_spans)
        smoothed, short_flickers_removed = smooth_short_chord_spans(
            merged,
            min_duration_sec=MIN_READABLE_CHORD_SEC,
        )
        snapped, beat_snapped_count = snap_chord_boundaries(
            smoothed,
            beats,
            duration_sec,
            max_distance_sec=BEAT_SNAP_MAX_DISTANCE_SEC,
        )
        normalized, enharmonic_label_count = normalize_chord_labels(snapped, key, mode)
        readable = merge_chord_spans(normalize_chord_sequence(normalized, duration_sec))
        stats = ChordSmoothingStats(
            raw_span_count=len(raw_spans),
            merged_span_count=len(merged),
            smoothed_span_count=len(readable),
            short_flickers_removed=short_flickers_removed,
            beat_snapped_count=beat_snapped_count,
            enharmonic_label_count=enharmonic_label_count,
            short_span_count=count_short_spans(readable, SHORT_CHORD_WARNING_SEC),
            average_confidence=average_confidence(readable),
        )
        return ChordAnalysis(raw_chords=raw_spans, chords=readable, stats=stats)
    except Exception as exception:
        warnings.append(f"Chord analysis failed: {exception}")
        return empty_chord_analysis()


def empty_chord_analysis() -> ChordAnalysis:
    """Return an empty chord analysis result after failure or skipped input."""

    stats = ChordSmoothingStats(
        raw_span_count=0,
        merged_span_count=0,
        smoothed_span_count=0,
        short_flickers_removed=0,
        beat_snapped_count=0,
        enharmonic_label_count=0,
        short_span_count=0,
        average_confidence=0.0,
    )
    return ChordAnalysis(raw_chords=[], chords=[], stats=stats)


def merge_chord_spans(spans: list[ChordSpan]) -> list[ChordSpan]:
    """Merge adjacent spans with the same chord label."""

    if not spans:
        return []

    merged: list[ChordSpan] = []
    current = clone_chord_span(spans[0])
    confidence_values = [current.confidence]
    for span in spans[1:]:
        if span.chord == current.chord and math.isclose(span.start_sec, current.end_sec, abs_tol=0.1):
            current.end_sec = span.end_sec
            confidence_values.append(span.confidence)
            current.confidence = sum(confidence_values) / len(confidence_values)
        else:
            merged.append(current)
            current = clone_chord_span(span)
            confidence_values = [current.confidence]
    merged.append(current)
    return merged


def smooth_short_chord_spans(spans: list[ChordSpan], min_duration_sec: float) -> tuple[list[ChordSpan], int]:
    """Merge very short chord flickers into neighboring spans when possible."""

    if len(spans) < 3:
        return [clone_chord_span(span) for span in spans], 0

    output = [clone_chord_span(span) for span in spans]
    removed_count = 0
    changed = True
    while changed and len(output) > 1:
        changed = False
        next_output: list[ChordSpan] = []
        index = 0
        while index < len(output):
            span = output[index]
            if chord_duration(span) >= min_duration_sec:
                next_output.append(clone_chord_span(span))
                index += 1
                continue

            previous = next_output[-1] if next_output else None
            next_span = output[index + 1] if index + 1 < len(output) else None
            if previous is not None and next_span is not None and previous.chord == next_span.chord:
                bridge = merge_span_group(previous, span, next_span, chord=previous.chord)
                next_output[-1] = bridge
                removed_count += 1
                changed = True
                index += 2
                continue

            if previous is None and next_span is not None:
                next_output.append(merge_span_group(span, next_span, chord=next_span.chord))
                removed_count += 1
                changed = True
                index += 2
                continue

            if previous is not None and next_span is None:
                next_output[-1] = merge_span_group(previous, span, chord=previous.chord)
                removed_count += 1
                changed = True
                index += 1
                continue

            if previous is not None and next_span is not None:
                if stability_score(previous) >= stability_score(next_span):
                    next_output[-1] = merge_span_group(previous, span, chord=previous.chord)
                    index += 1
                else:
                    next_output.append(merge_span_group(span, next_span, chord=next_span.chord))
                    index += 2
                removed_count += 1
                changed = True
                continue

            next_output.append(clone_chord_span(span))
            index += 1
        output = merge_chord_spans(next_output)
    return output, removed_count


def snap_chord_boundaries(
    spans: list[ChordSpan],
    beats: list[float],
    duration_sec: float,
    max_distance_sec: float,
) -> tuple[list[ChordSpan], int]:
    """Lightly snap internal chord boundaries to nearby beats."""

    output = normalize_chord_sequence(spans, duration_sec)
    if len(output) < 2 or not beats:
        return output, 0

    snapped_count = 0
    for index in range(len(output) - 1):
        boundary = output[index].end_sec
        beat = nearest_value(boundary, beats)
        if beat is None or abs(beat - boundary) > max_distance_sec:
            continue
        if beat <= output[index].start_sec or beat >= output[index + 1].end_sec:
            continue
        output[index].end_sec = float(beat)
        output[index + 1].start_sec = float(beat)
        snapped_count += 1
    return normalize_chord_sequence(output, duration_sec), snapped_count


def normalize_chord_labels(
    spans: list[ChordSpan],
    key: str | None,
    mode: str | None,
) -> tuple[list[ChordSpan], int]:
    """Normalize enharmonic spelling for chord labels without changing timing."""

    changed_count = 0
    output: list[ChordSpan] = []
    for span in spans:
        label = normalize_chord_label(span.chord, key, mode)
        if label != span.chord:
            changed_count += 1
        output.append(ChordSpan(span.start_sec, span.end_sec, label, span.confidence))
    return output, changed_count


def normalize_chord_label(label: str, key: str | None, mode: str | None) -> str:
    """Return a key-aware enharmonic spelling for one chord label."""

    if not label or label == "N":
        return label
    root, suffix = split_chord_label(label)
    if root is None:
        return label
    if prefers_flat_spelling(key, mode):
        root = {
            "C#": "Db",
            "D#": "Eb",
            "F#": "Gb",
            "G#": "Ab",
            "A#": "Bb",
        }.get(root, root)
    else:
        root = {
            "Db": "C#",
            "Eb": "D#",
            "Gb": "F#",
            "Ab": "G#",
            "Bb": "A#",
        }.get(root, root)
    return root + suffix


def split_chord_label(label: str) -> tuple[str | None, str]:
    """Split a chord label into root and suffix."""

    if not label:
        return None, ""
    root = label[0]
    if root < "A" or root > "G":
        return None, label
    index = 1
    if len(label) > 1 and label[1] in {"#", "b"}:
        root += label[1]
        index = 2
    return root, label[index:]


def prefers_flat_spelling(key: str | None, mode: str | None) -> bool:
    """Return whether a key signature should prefer flat chord labels."""

    if not key:
        return False
    root, _suffix = split_chord_label(key)
    if root is None:
        return False
    if "b" in root:
        return True
    if "#" in root:
        return False
    flat_major_keys = {"F"}
    flat_minor_keys = {"D", "G", "C", "F"}
    if str(mode).lower() == "minor":
        return root in flat_minor_keys
    return root in flat_major_keys


def normalize_chord_sequence(spans: list[ChordSpan], duration_sec: float) -> list[ChordSpan]:
    """Clamp chord spans and keep them continuous within the audio duration."""

    output: list[ChordSpan] = []
    cursor = 0.0
    for span in spans:
        start_sec = min(max(span.start_sec, 0.0), duration_sec)
        end_sec = min(max(span.end_sec, start_sec), duration_sec)
        if output and start_sec < cursor:
            start_sec = cursor
        if output and start_sec > cursor:
            start_sec = cursor
        if end_sec <= start_sec:
            continue
        output.append(ChordSpan(start_sec, end_sec, span.chord, span.confidence))
        cursor = end_sec
    if output:
        output[0].start_sec = 0.0
        output[-1].end_sec = duration_sec
    return output


def nearest_value(value: float, candidates: list[float]) -> float | None:
    """Return the nearest candidate value."""

    if not candidates:
        return None
    return min(candidates, key=lambda candidate: abs(candidate - value))


def clone_chord_span(span: ChordSpan) -> ChordSpan:
    """Return a copy of one chord span."""

    return ChordSpan(span.start_sec, span.end_sec, span.chord, span.confidence)


def chord_duration(span: ChordSpan) -> float:
    """Return one chord span duration in seconds."""

    return max(0.0, span.end_sec - span.start_sec)


def stability_score(span: ChordSpan) -> float:
    """Score one neighboring span for absorbing a short flicker."""

    return chord_duration(span) * max(0.05, span.confidence)


def merge_span_group(*spans: ChordSpan, chord: str) -> ChordSpan:
    """Merge a group of spans into one label with duration-weighted confidence."""

    start_sec = min(span.start_sec for span in spans)
    end_sec = max(span.end_sec for span in spans)
    total_duration = sum(chord_duration(span) for span in spans)
    if total_duration <= 0:
        confidence = sum(span.confidence for span in spans) / len(spans)
    else:
        confidence = sum(span.confidence * chord_duration(span) for span in spans) / total_duration
    return ChordSpan(start_sec, end_sec, chord, confidence)


def count_short_spans(spans: list[ChordSpan], threshold_sec: float) -> int:
    """Count spans shorter than a threshold."""

    return sum(1 for span in spans if chord_duration(span) < threshold_sec)


def average_confidence(spans: list[ChordSpan]) -> float:
    """Return duration-weighted average chord confidence."""

    total_duration = sum(chord_duration(span) for span in spans)
    if total_duration <= 0:
        return 0.0
    return sum(span.confidence * chord_duration(span) for span in spans) / total_duration


def analyze_lyrics(asr_wav: Path, warnings: list[str]) -> tuple[LyricsStatus, list[LyricLine]]:
    """Run whisper.cpp and parse line-level lyric timestamps when available."""

    try:
        configured_whisper_cli = os.environ.get("WHISPER_CPP_BIN")
        if configured_whisper_cli and not Path(configured_whisper_cli).is_file():
            reason = f"configured whisper.cpp binary does not exist: {configured_whisper_cli}"
            warnings.append(f"ASR analysis skipped: {reason}")
            return LyricsStatus("skipped", reason, configured_whisper_cli), []

        whisper_cli = find_whisper_cli()
        if whisper_cli is None:
            reason = "whisper.cpp binary is not available in this lean research image."
            warnings.append(f"ASR analysis skipped: {reason}")
            return LyricsStatus("skipped", reason, None), []

        is_mock = is_mock_whisper_cli(whisper_cli)
        model_path = Path("/workspace/cache/whisper/mock-model.bin") if is_mock else ensure_whisper_model()
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
        ]
        run_command(command, "whisper.cpp ASR")
        json_path = output_base.with_suffix(".json")
        if not json_path.is_file():
            reason = "whisper.cpp finished without writing JSON."
            warnings.append(f"ASR analysis failed: {reason}")
            return LyricsStatus("failed", reason, str(whisper_cli)), []
        data = json.loads(json_path.read_text(encoding="utf8"))
        lyrics = extract_lyrics(data)
        if not lyrics:
            reason = "whisper.cpp JSON contained no lyric segments."
            warnings.append(reason)
            return LyricsStatus("empty", reason, str(whisper_cli)), []
        if is_mock:
            return (
                LyricsStatus(
                    "mock",
                    "Mock whisper helper wrote deterministic lyric lines for integration smoke only.",
                    str(whisper_cli),
                ),
                lyrics,
            )
        return LyricsStatus("available", "whisper.cpp produced line-level lyric timestamps.", str(whisper_cli)), lyrics
    except FileNotFoundError as exception:
        reason = str(exception)
        warnings.append(f"ASR analysis skipped: {reason}")
        return LyricsStatus("skipped", reason, os.environ.get("WHISPER_CPP_BIN")), []
    except Exception as exception:
        reason = str(exception)
        warnings.append(f"ASR analysis failed: {reason}")
        return LyricsStatus("failed", reason, os.environ.get("WHISPER_CPP_BIN")), []


def is_mock_whisper_cli(path: Path) -> bool:
    """Return true when the configured ASR binary is the deterministic mock helper."""

    return path.name == "mock-whisper-cli"


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
        if not text or is_non_lyric_marker_text(text):
            continue
        start_sec, end_sec = segment_times(segment)
        if start_sec is None or end_sec is None or end_sec <= start_sec:
            continue
        lyrics.append(LyricLine(start_sec, end_sec, text))
    return sorted(lyrics, key=lambda line: line.start_sec)


def is_non_lyric_marker_text(text: str) -> bool:
    """Return true when Whisper emitted only non-lyric bracket markers."""

    normalized = re.sub(r"[\[\]\(\)_-]+", " ", text.lower())
    normalized = re.sub(r"[^a-z0-9\s]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return False
    if normalized in NON_LYRIC_ASR_MARKERS:
        return True
    if any(character in text for character in "[]()"):
        words = normalized.split()
        return bool(words) and all(word in REPEATED_NON_LYRIC_MARKER_WORDS for word in words)
    return False


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
        "harmonyReliability": {
            "status": result.harmony_reliability.status,
            "useCase": result.harmony_reliability.use_case,
            "reason": result.harmony_reliability.reason,
            "signals": result.harmony_reliability.signals,
        },
        "lyricsStatus": {
            "status": result.lyrics_status.status,
            "reason": result.lyrics_status.reason,
            "source": result.lyrics_status.source,
        },
        "warnings": result.warnings,
    }
    path.write_text(json.dumps(artifact, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def write_raw_chords(path: Path, result: AnalysisResult) -> None:
    """Write the research-only raw chord timeline for debugging smoothing."""

    stats = result.chord_stats
    artifact = {
        "durationSec": round(result.duration_sec, 3),
        "bpm": round(result.bpm, 2) if result.bpm is not None else None,
        "key": result.key,
        "mode": result.mode,
        "smoothing": {
            "rawSpanCount": stats.raw_span_count,
            "mergedSpanCount": stats.merged_span_count,
            "smoothedSpanCount": stats.smoothed_span_count,
            "shortFlickersRemoved": stats.short_flickers_removed,
            "beatSnappedCount": stats.beat_snapped_count,
            "enharmonicLabelCount": stats.enharmonic_label_count,
            "shortSpanCount": stats.short_span_count,
            "averageConfidence": round(stats.average_confidence, 3),
        },
        "rawChords": [
            {
                "startSec": round(chord.start_sec, 3),
                "endSec": round(chord.end_sec, 3),
                "chord": chord.chord,
                "confidence": round(chord.confidence, 3),
            }
            for chord in result.raw_chords
        ],
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
            "## Chord Smoothing",
            "",
            f"- Raw frame spans: {result.chord_stats.raw_span_count}",
            f"- Adjacent-merged spans: {result.chord_stats.merged_span_count}",
            f"- Readable spans: {result.chord_stats.smoothed_span_count}",
            f"- Short flickers removed: {result.chord_stats.short_flickers_removed}",
            f"- Beat-snapped boundaries: {result.chord_stats.beat_snapped_count}",
            f"- Enharmonic labels normalized: {result.chord_stats.enharmonic_label_count}",
            f"- Short spans under {SHORT_CHORD_WARNING_SEC:.1f}s after smoothing: {result.chord_stats.short_span_count}",
            f"- Average confidence: {result.chord_stats.average_confidence:.3f}",
            "",
            "## Harmony Reliability",
            "",
            f"- Status: {result.harmony_reliability.status}",
            f"- Use case: {result.harmony_reliability.use_case}",
            f"- Reason: {result.harmony_reliability.reason}",
            "- Meaning: `useful` means the harmony timeline is reviewable, not accurate; verify chords by ear before using them as a finished chord sheet.",
            f"- Average chord confidence: {format_reliability_signal(result.harmony_reliability.signals.get('averageConfidence'))}",
            f"- Chord span density: {format_reliability_signal(result.harmony_reliability.signals.get('chordDensityPerMinute'))}/min",
            f"- Unique chords: {format_reliability_signal(result.harmony_reliability.signals.get('uniqueChordCount'))}",
            f"- Stable spans: {format_reliability_signal(result.harmony_reliability.signals.get('stableSpanCount'))}",
            f"- Short spans after smoothing: {format_reliability_signal(result.harmony_reliability.signals.get('shortSpanCount'))}",
            f"- Confident chord coverage: {format_reliability_signal(result.harmony_reliability.signals.get('confidentChordCoverage'))}",
            f"- Percussive-like input: {format_reliability_signal(result.harmony_reliability.signals.get('percussiveLike'))}",
            "",
            "## Lyrics Status",
            "",
            f"- Status: {result.lyrics_status.status}",
            f"- Reason: {result.lyrics_status.reason}",
            f"- Source: {result.lyrics_status.source or 'none'}",
            "- Meaning: lyrics status is separate from harmony reliability; mock output validates wiring only.",
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


def format_reliability_signal(value: float | int | bool | None) -> str:
    """Format one reliability signal for reports."""

    if value is None:
        return "unknown"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, int):
        return str(value)
    return f"{value:.2f}"


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
