#!/usr/bin/env python3
"""Compare OMG Score transcription engines with isolated local artifacts."""

from __future__ import annotations

import argparse
import json
import math
import mimetypes
import re
import subprocess
import time
import urllib.parse
import urllib.request
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BACKEND_URL = "http://localhost:8084/transcription"
INPUT_DIR = REPO_ROOT / ".isolation" / "engine-eval" / "input"
OUTPUT_DIR = REPO_ROOT / ".isolation" / "engine-eval" / "output"
REPORT_PATH = REPO_ROOT / ".isolation" / "engine-eval" / "report.md"
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav"}
SYNTHETIC_SAMPLE_NAME = "synthetic-smoke.wav"
POLL_INTERVAL_SECONDS = 2.0
POLL_TIMEOUT_SECONDS = 300.0


@dataclass
class MidiStats:
    """Computed MIDI metrics used by the comparison report."""

    readable: bool
    error: str
    file_size: int
    track_count: int
    channel_count: int
    note_count: int
    pitch_range: str
    max_polyphony: int
    short_note_ratio: float


@dataclass
class EngineResult:
    """Result for one engine on one sample."""

    status: str
    elapsed_seconds: float | None
    output_path: Path | None
    message: str
    stats: MidiStats | None


@dataclass
class SampleResult:
    """Comparison result for one input sample."""

    sample_path: Path
    synthetic: bool
    onnx: EngineResult
    basic_pitch: EngineResult


def main() -> int:
    """Run the engine comparison and write a Markdown report."""

    parser = argparse.ArgumentParser(description="Compare ONNX and Basic Pitch MIDI output.")
    parser.add_argument("--backend-url", default=DEFAULT_BACKEND_URL)
    args = parser.parse_args()

    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "onnx").mkdir(parents=True, exist_ok=True)
    (OUTPUT_DIR / "basic-pitch").mkdir(parents=True, exist_ok=True)

    samples = find_samples(INPUT_DIR)
    generated_synthetic = False
    if not samples:
        synthetic = INPUT_DIR / SYNTHETIC_SAMPLE_NAME
        write_synthetic_wav(synthetic)
        samples = [synthetic]
        generated_synthetic = True

    results = [compare_sample(sample, args.backend_url, is_synthetic_sample(sample)) for sample in samples]
    write_report(results, REPORT_PATH, generated_synthetic)
    print(f"Report: {REPORT_PATH}")
    if has_incomplete_results(results):
        print("One or more engine comparisons failed or produced unreadable MIDI.")
        return 1
    return 0


def find_samples(input_dir: Path) -> list[Path]:
    """Return supported audio samples in deterministic order."""

    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
    )


def is_synthetic_sample(sample: Path) -> bool:
    """Return whether the sample is the generated smoke input."""

    return sample.parent == INPUT_DIR and sample.name == SYNTHETIC_SAMPLE_NAME


def write_synthetic_wav(path: Path) -> None:
    """Create a one-second sine wave smoke sample."""

    sample_rate = 22050
    frequency = 440.0
    seconds = 1.0
    with wave.open(str(path), "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        frames = bytearray()
        for index in range(int(sample_rate * seconds)):
            value = int(0.35 * 32767 * math.sin(2 * math.pi * frequency * index / sample_rate))
            frames.extend(value.to_bytes(2, byteorder="little", signed=True))
        wav_file.writeframes(frames)


def compare_sample(sample: Path, backend_url: str, synthetic: bool) -> SampleResult:
    """Run both engines for one sample."""

    print(f"Comparing {sample.name}")
    onnx = run_onnx_engine(sample, backend_url)
    basic_pitch = run_basic_pitch_engine(sample)
    return SampleResult(sample, synthetic, onnx, basic_pitch)


def has_incomplete_results(results: list[SampleResult]) -> bool:
    """Return whether any required engine comparison is incomplete."""

    for result in results:
        for engine_result in (result.onnx, result.basic_pitch):
            if engine_result.status != "ok":
                return True
            if engine_result.stats is None or not engine_result.stats.readable:
                return True
    return False


def run_onnx_engine(sample: Path, backend_url: str) -> EngineResult:
    """Submit one sample to the Spring Boot async transcription job API."""

    start = time.monotonic()
    safe_name = safe_stem(sample) + "-onnx"
    output_path = unique_path(OUTPUT_DIR / "onnx" / f"{safe_name}.mid")
    try:
        health = http_get_text(f"{backend_url}/health")
        if health.strip() != "ok":
            raise RuntimeError(f"backend health returned {health!r}")

        job = create_transcription_job(sample, safe_name, backend_url)
        job_id = job.get("id")
        if not job_id:
            raise RuntimeError(f"job response did not include id: {job}")

        completed = poll_transcription_job(str(job_id), backend_url)
        if completed.get("status") != "succeeded":
            raise RuntimeError(completed.get("message") or f"job ended as {completed.get('status')}")

        download_url = completed.get("downloadUrl") or f"/transcription/jobs/{job_id}/midi"
        download_midi(resolve_url(backend_url, str(download_url)), output_path)
        elapsed = time.monotonic() - start
        stats = analyze_midi_file(output_path)
        if not stats.readable:
            return EngineResult(
                status="failed",
                elapsed_seconds=elapsed,
                output_path=output_path,
                message=f"downloaded MIDI was not readable: {stats.error}",
                stats=stats,
            )
        return EngineResult(
            status="ok",
            elapsed_seconds=elapsed,
            output_path=output_path,
            message=completed.get("message", "succeeded"),
            stats=stats,
        )
    except Exception as exception:
        return EngineResult(
            status="failed",
            elapsed_seconds=time.monotonic() - start,
            output_path=None,
            message=str(exception),
            stats=None,
        )


def run_basic_pitch_engine(sample: Path) -> EngineResult:
    """Run the Docker-isolated Basic Pitch prototype for one sample."""

    start = time.monotonic()
    output_dir = OUTPUT_DIR / "basic-pitch"
    output_dir.mkdir(parents=True, exist_ok=True)
    command = [
        "docker",
        "compose",
        "--profile",
        "research",
        "run",
        "--rm",
        "--volume",
        f"{INPUT_DIR.resolve()}:/workspace/eval-input:ro",
        "--volume",
        f"{output_dir.resolve()}:/workspace/eval-output",
        "basic-pitch",
        f"/workspace/eval-input/{sample.name}",
        "/workspace/eval-output",
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=REPO_ROOT,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        elapsed = time.monotonic() - start
        if completed.returncode != 0:
            raise RuntimeError(last_output_lines(completed.stdout))

        output_path = parse_basic_pitch_output_path(completed.stdout)
        if output_path is None:
            raise RuntimeError("Basic Pitch completed but no MIDI path was reported.")
        stats = analyze_midi_file(output_path)
        if not stats.readable:
            return EngineResult(
                status="failed",
                elapsed_seconds=elapsed,
                output_path=output_path,
                message=f"Basic Pitch MIDI was not readable: {stats.error}",
                stats=stats,
            )
        return EngineResult(
            status="ok",
            elapsed_seconds=elapsed,
            output_path=output_path,
            message=last_output_lines(completed.stdout),
            stats=stats,
        )
    except Exception as exception:
        return EngineResult(
            status="failed",
            elapsed_seconds=time.monotonic() - start,
            output_path=None,
            message=str(exception),
            stats=None,
        )


def http_get_text(url: str) -> str:
    """Fetch a UTF-8 text response."""

    with urllib.request.urlopen(url, timeout=10) as response:
        return response.read().decode("utf-8")


def create_transcription_job(sample: Path, song_name: str, backend_url: str) -> dict[str, object]:
    """Create an async backend transcription job using multipart/form-data."""

    boundary = f"----omg-score-{uuid.uuid4().hex}"
    body = build_multipart_body(boundary, sample, song_name)
    request = urllib.request.Request(
        f"{backend_url}/jobs",
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Content-Length": str(len(body)),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def build_multipart_body(boundary: str, sample: Path, song_name: str) -> bytes:
    """Build the multipart body expected by the transcription API."""

    content_type = mimetypes.guess_type(sample.name)[0] or "application/octet-stream"
    filename = multipart_filename(sample)
    lines = [
        f"--{boundary}\r\n".encode("utf-8"),
        b'Content-Disposition: form-data; name="songName"\r\n\r\n',
        song_name.encode("utf-8"),
        b"\r\n",
        f"--{boundary}\r\n".encode("utf-8"),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"),
        f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
        sample.read_bytes(),
        b"\r\n",
        f"--{boundary}--\r\n".encode("utf-8"),
    ]
    return b"".join(lines)


def poll_transcription_job(job_id: str, backend_url: str) -> dict[str, object]:
    """Poll the backend job endpoint until it reaches a terminal state."""

    deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        with urllib.request.urlopen(f"{backend_url}/jobs/{job_id}", timeout=10) as response:
            job = json.loads(response.read().decode("utf-8"))
        status = job.get("status")
        if status in {"succeeded", "failed"}:
            return job
        time.sleep(POLL_INTERVAL_SECONDS)
    raise TimeoutError(f"job {job_id} did not finish within {POLL_TIMEOUT_SECONDS:.0f}s")


def resolve_url(backend_url: str, maybe_relative: str) -> str:
    """Resolve a backend download URL."""

    if maybe_relative.startswith("http://") or maybe_relative.startswith("https://"):
        return maybe_relative
    parsed = urllib.parse.urlparse(backend_url)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    return urllib.parse.urljoin(origin, maybe_relative)


def download_midi(url: str, output_path: Path) -> None:
    """Download a MIDI file from the backend."""

    with urllib.request.urlopen(url, timeout=30) as response:
        output_path.write_bytes(response.read())


def parse_basic_pitch_output_path(output: str) -> Path | None:
    """Parse the wrapper's reported host-mounted MIDI path."""

    for line in output.splitlines():
        if line.startswith("MIDI: "):
            container_path = line[len("MIDI: ") :].strip()
            prefix = "/workspace/eval-output/"
            if container_path.startswith(prefix):
                return OUTPUT_DIR / "basic-pitch" / container_path[len(prefix) :]
            return Path(container_path)
    return None


def analyze_midi_file(path: Path) -> MidiStats:
    """Analyze a MIDI file with a small stdlib parser."""

    try:
        data = path.read_bytes()
        analyzer = MidiAnalyzer(data)
        return analyzer.analyze(path.stat().st_size)
    except Exception as exception:
        return MidiStats(
            readable=False,
            error=str(exception),
            file_size=path.stat().st_size if path.exists() else 0,
            track_count=0,
            channel_count=0,
            note_count=0,
            pitch_range="--",
            max_polyphony=0,
            short_note_ratio=0.0,
        )


class MidiAnalyzer:
    """Small MIDI parser for report metrics."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        self.channels: set[int] = set()
        self.note_count = 0
        self.min_pitch: int | None = None
        self.max_pitch: int | None = None
        self.max_polyphony = 0
        self.short_notes = 0
        self.completed_notes = 0
        self.max_tick = 0

    def analyze(self, file_size: int) -> MidiStats:
        """Return report metrics for the MIDI data."""

        if self.data[0:4] != b"MThd":
            raise ValueError("MIDI file does not start with MThd")
        header_length = read_uint32(self.data, 4)
        if header_length < 6:
            raise ValueError("MIDI header is shorter than 6 bytes")
        track_count = read_uint16(self.data, 10)
        division = read_uint16(self.data, 12)
        offset = 8 + header_length
        for _ in range(track_count):
            if self.data[offset : offset + 4] != b"MTrk":
                raise ValueError(f"Expected MTrk at byte {offset}")
            track_length = read_uint32(self.data, offset + 4)
            start = offset + 8
            end = start + track_length
            self.parse_track(start, end, division)
            offset = end

        pitch_range = "--"
        if self.min_pitch is not None and self.max_pitch is not None:
            pitch_range = f"{midi_note_name(self.min_pitch)}-{midi_note_name(self.max_pitch)}"
        short_note_ratio = self.short_notes / self.completed_notes if self.completed_notes else 0.0
        return MidiStats(
            readable=True,
            error="",
            file_size=file_size,
            track_count=track_count,
            channel_count=len(self.channels),
            note_count=self.note_count,
            pitch_range=pitch_range,
            max_polyphony=self.max_polyphony,
            short_note_ratio=short_note_ratio,
        )

    def parse_track(self, start: int, end: int, division: int) -> None:
        """Parse one MIDI track and update aggregate metrics."""

        offset = start
        tick = 0
        running_status: int | None = None
        active_notes: dict[tuple[int, int], list[int]] = {}
        active_total = 0
        short_note_threshold = max(1, round(division / 32)) if division > 0 and not division & 0x8000 else 1

        while offset < end:
            delta, offset = read_var_length(self.data, offset, end)
            tick += delta
            self.max_tick = max(self.max_tick, tick)
            status = self.data[offset]
            if status < 0x80:
                if running_status is None:
                    raise ValueError("running status found before status byte")
                data_offset = offset
                status = running_status
            else:
                offset += 1
                data_offset = offset
                if status < 0xF0:
                    running_status = status

            if status == 0xFF:
                offset += 1
                meta_length, offset = read_var_length(self.data, offset, end)
                if offset + meta_length > end:
                    raise ValueError("meta event extends past track end")
                offset += meta_length
                continue
            if status in {0xF0, 0xF7}:
                sysex_length, offset = read_var_length(self.data, offset, end)
                if offset + sysex_length > end:
                    raise ValueError("SysEx event extends past track end")
                offset += sysex_length
                continue

            data_length = midi_event_data_length(status)
            offset = data_offset + data_length
            event_type = status & 0xF0
            channel = status & 0x0F
            if 0x80 <= event_type <= 0xE0:
                self.channels.add(channel + 1)

            if data_length < 1:
                continue
            note_number = self.data[data_offset]
            velocity = self.data[data_offset + 1] if data_length > 1 else 0
            key = (channel, note_number)
            if event_type == 0x90 and velocity > 0:
                self.note_count += 1
                self.min_pitch = note_number if self.min_pitch is None else min(self.min_pitch, note_number)
                self.max_pitch = note_number if self.max_pitch is None else max(self.max_pitch, note_number)
                active_notes.setdefault(key, []).append(tick)
                active_total += 1
                self.max_polyphony = max(self.max_polyphony, active_total)
            elif event_type == 0x80 or (event_type == 0x90 and velocity == 0):
                starts = active_notes.get(key)
                if starts:
                    start_tick = starts.pop()
                    active_total = max(0, active_total - 1)
                    duration = tick - start_tick
                    if duration > 0:
                        self.completed_notes += 1
                        if duration < short_note_threshold:
                            self.short_notes += 1


def read_uint16(data: bytes, offset: int) -> int:
    """Read a big-endian uint16."""

    return (data[offset] << 8) | data[offset + 1]


def read_uint32(data: bytes, offset: int) -> int:
    """Read a big-endian uint32."""

    return ((data[offset] << 24) & 0xFF000000) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]


def read_var_length(data: bytes, offset: int, limit: int) -> tuple[int, int]:
    """Read a MIDI variable-length quantity."""

    value = 0
    while True:
        if offset >= limit:
            raise ValueError("unexpected end of MIDI variable-length quantity")
        byte = data[offset]
        offset += 1
        value = (value << 7) | (byte & 0x7F)
        if not byte & 0x80:
            return value, offset


def midi_event_data_length(status: int) -> int:
    """Return the data-byte count for a MIDI event status."""

    event_type = status & 0xF0
    if event_type in {0xC0, 0xD0}:
        return 1
    if 0x80 <= event_type <= 0xE0:
        return 2
    if status in {0xF1, 0xF3}:
        return 1
    if status == 0xF2:
        return 2
    return 0


def midi_note_name(note_number: int) -> str:
    """Format a MIDI note number as a note name."""

    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    return f"{names[note_number % 12]}{note_number // 12 - 1}"


def write_report(results: list[SampleResult], report_path: Path, generated_synthetic: bool) -> None:
    """Write the Markdown comparison report."""

    report_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# OMG Score Engine Comparison",
        "",
        f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        "",
    ]
    has_synthetic = any(result.synthetic for result in results)
    if generated_synthetic:
        lines.extend(
            [
                "> The input directory was empty, so this report used a 1-second synthetic WAV smoke sample.",
                "> This validates the pipeline only; it is not evidence of musical transcription quality.",
                "",
            ]
        )
    elif has_synthetic:
        lines.extend(
            [
                "> This report includes the generated 1-second synthetic WAV smoke sample.",
                "> Use real MP3/WAV samples before making transcription quality decisions.",
                "",
            ]
        )
    lines.extend(
        [
            "Automatic metrics are useful for spotting obvious output differences, but they do not measure accuracy without a ground-truth MIDI.",
            "Use the manual rating columns after opening the generated MIDI files in OMG Score or an external editor.",
            "",
            "## Summary Table",
            "",
            "| Sample | Engine | Status | Time | MIDI | Readable | Size | Tracks | Channels | Notes | Pitch range | Polyphony | Short notes | Manual rating | Notes |",
            "| --- | --- | --- | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- |",
        ]
    )
    for result in results:
        lines.append(result_row(result.sample_path, "ONNX", result.onnx))
        lines.append(result_row(result.sample_path, "Basic Pitch", result.basic_pitch))

    lines.extend(["", "## Details", ""])
    for result in results:
        lines.extend(sample_details(result))

    report_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def result_row(sample: Path, engine: str, result: EngineResult) -> str:
    """Format a Markdown table row for one engine result."""

    stats = result.stats
    midi_path = relative_path(result.output_path) if result.output_path else "--"
    readable = "yes" if stats and stats.readable else "no"
    return (
        f"| {escape_md(sample.name)} | {engine} | {result.status} | {format_seconds(result.elapsed_seconds)} | "
        f"{escape_md(midi_path)} | {readable} | {stats.file_size if stats else 0} | {stats.track_count if stats else 0} | "
        f"{stats.channel_count if stats else 0} | {stats.note_count if stats else 0} | "
        f"{stats.pitch_range if stats else '--'} | {stats.max_polyphony if stats else 0} | "
        f"{format_ratio(stats.short_note_ratio if stats else 0.0)} |  |  |"
    )


def sample_details(result: SampleResult) -> list[str]:
    """Format detailed report sections for one sample."""

    return [
        f"### {result.sample_path.name}",
        "",
        f"- Source: `{relative_path(result.sample_path)}`",
        f"- Synthetic smoke sample: `{str(result.synthetic).lower()}`",
        f"- ONNX message: {result.onnx.message}",
        f"- ONNX parser error: {parser_error(result.onnx)}",
        f"- Basic Pitch message: {result.basic_pitch.message}",
        f"- Basic Pitch parser error: {parser_error(result.basic_pitch)}",
        "",
    ]


def parser_error(result: EngineResult) -> str:
    """Return a report-safe parser error string."""

    if result.stats is None or result.stats.readable:
        return "--"
    return result.stats.error


def safe_stem(path: Path) -> str:
    """Return a filesystem- and backend-safe sample stem."""

    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", path.stem).strip("-")
    return safe or "sample"


def multipart_filename(path: Path) -> str:
    """Return a safe ASCII filename for multipart upload headers."""

    suffix = path.suffix.lower() if path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS else ".wav"
    return f"{safe_stem(path)}{suffix}"


def unique_path(path: Path) -> Path:
    """Return a non-existing path by adding a timestamp when needed."""

    if not path.exists():
        return path
    timestamp = time.strftime("%Y%m%d-%H%M%S")
    candidate = path.with_name(f"{path.stem}-{timestamp}{path.suffix}")
    counter = 2
    while candidate.exists():
        candidate = path.with_name(f"{path.stem}-{timestamp}-{counter}{path.suffix}")
        counter += 1
    return candidate


def relative_path(path: Path | None) -> str:
    """Return a repo-relative path when possible."""

    if path is None:
        return "--"
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def format_seconds(seconds: float | None) -> str:
    """Format elapsed seconds for the report."""

    if seconds is None:
        return "--"
    return f"{seconds:.2f}s"


def format_ratio(value: float) -> str:
    """Format a ratio as a percentage."""

    return f"{value * 100:.1f}%"


def escape_md(value: str) -> str:
    """Escape Markdown table separators."""

    return value.replace("|", "\\|")


def last_output_lines(output: str, limit: int = 8) -> str:
    """Return a compact command-output summary."""

    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return " / ".join(lines[-limit:]) if lines else "(no output)"


if __name__ == "__main__":
    raise SystemExit(main())
