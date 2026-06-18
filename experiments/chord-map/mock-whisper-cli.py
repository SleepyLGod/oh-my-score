#!/usr/bin/env python3
"""Write deterministic whisper.cpp-like JSON for ASR integration smoke tests."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main(argv: list[str]) -> int:
    """Write a small line-level transcription JSON file for smoke testing."""

    output_base = output_base_from_args(argv)
    if output_base is None:
        print("mock-whisper-cli requires -of <output-base>", file=sys.stderr)
        return 2

    output_path = output_base.with_suffix(".json")
    output_path.write_text(
        json.dumps(
            {
                "transcription": [
                    {
                        "timestamps": {"from": "00:00:01.000", "to": "00:00:04.000"},
                        "text": "Mock lyric line one for Chord Map ASR smoke.",
                    },
                    {
                        "timestamps": {"from": "00:00:05.000", "to": "00:00:08.000"},
                        "text": "Mock lyric line two with a stable timestamp.",
                    },
                ]
            },
            indent=2,
        )
        + "\n",
        encoding="utf8",
    )
    return 0


def output_base_from_args(argv: list[str]) -> Path | None:
    """Return the path passed after the whisper.cpp -of flag."""

    for index, value in enumerate(argv):
        if value == "-of" and index + 1 < len(argv):
            return Path(argv[index + 1])
    return None


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
