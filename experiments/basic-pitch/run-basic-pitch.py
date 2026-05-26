#!/usr/bin/env python3
"""Run Basic Pitch in the research Docker container."""

from __future__ import annotations

import subprocess
import sys
import shutil
import tempfile
import time
from pathlib import Path


def main(argv: list[str]) -> int:
    if len(argv) != 3:
        print("Usage: run-basic-pitch <input-audio> <output-directory>", file=sys.stderr)
        return 2

    input_path = Path(argv[1])
    output_dir = Path(argv[2])
    if not input_path.is_file():
        print(f"Input audio does not exist: {input_path}", file=sys.stderr)
        return 2

    output_dir.mkdir(parents=True, exist_ok=True)
    run_dir = Path(tempfile.mkdtemp(prefix=".basic-pitch-", dir=output_dir))
    command = ["basic-pitch", str(run_dir), str(input_path)]

    start = time.monotonic()
    print("Running:", " ".join(command), flush=True)
    completed = subprocess.run(command, check=False)
    elapsed = time.monotonic() - start
    if completed.returncode != 0:
        shutil.rmtree(run_dir, ignore_errors=True)
        return completed.returncode

    run_midis = list(run_dir.glob("*.mid"))
    if not run_midis:
        print(
            f"Basic Pitch finished but did not create a MIDI file in {run_dir}",
            file=sys.stderr,
        )
        shutil.rmtree(run_dir, ignore_errors=True)
        return 1

    midi_path = max(run_midis, key=lambda path: path.stat().st_mtime)
    destination = unique_destination(output_dir, midi_path.name)
    shutil.move(str(midi_path), destination)
    shutil.rmtree(run_dir, ignore_errors=True)

    midi_path = Path(destination)
    print(f"MIDI: {midi_path}")
    print(f"Elapsed: {elapsed:.2f}s")
    return 0


def unique_destination(output_dir: Path, file_name: str) -> Path:
    destination = output_dir / file_name
    if not destination.exists():
        return destination

    timestamp = time.strftime("%Y%m%d-%H%M%S")
    stem = destination.stem
    suffix = destination.suffix
    candidate = output_dir / f"{stem}-{timestamp}{suffix}"
    counter = 2
    while candidate.exists():
        candidate = output_dir / f"{stem}-{timestamp}-{counter}{suffix}"
        counter += 1
    return candidate


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
