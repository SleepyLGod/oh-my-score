#!/usr/bin/env python3
"""Small HTTP wrapper around Basic Pitch for OMG Score Docker Compose."""

from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


PORT = 8090
RUNTIME_ROOT = Path("/workspace/.runtime").resolve()
CONVERSION_TIMEOUT_SECONDS = 20 * 60


class BasicPitchHandler(BaseHTTPRequestHandler):
    """Handle internal Basic Pitch conversion requests."""

    server_version = "OMGBasicPitch/1.0"

    def do_GET(self) -> None:
        """Return service health."""

        if self.path != "/health":
            self.send_json(404, {"error": "Not found"})
            return
        self.send_json(200, {"status": "ok"})

    def do_POST(self) -> None:
        """Convert one audio file to MIDI."""

        if self.path != "/convert":
            self.send_json(404, {"error": "Not found"})
            return

        try:
            payload = self.read_json_body()
            input_path = runtime_path(str(payload.get("inputPath", "")))
            output_path = runtime_path(str(payload.get("outputPath", "")))
            result = convert_audio(input_path, output_path)
            self.send_json(200, result)
        except ValueError as exception:
            self.send_json(400, {"error": str(exception)})
        except Exception as exception:
            self.send_json(500, {"error": str(exception)})

    def read_json_body(self) -> dict[str, Any]:
        """Read and decode the request JSON body."""

        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            raise ValueError("Request body is empty.")
        raw_body = self.rfile.read(length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exception:
            raise ValueError(f"Invalid JSON body: {exception.msg}") from exception
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object.")
        return payload

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        """Write a JSON response."""

        response = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def log_message(self, format: str, *args: Any) -> None:
        """Keep default access logs compact."""

        print("%s - %s" % (self.address_string(), format % args), flush=True)


def convert_audio(input_path: Path, output_path: Path) -> dict[str, Any]:
    """Run Basic Pitch and move the generated MIDI to output_path."""

    if not input_path.is_file():
        raise ValueError(f"Input audio does not exist: {input_path}")
    if not output_path.name:
        raise ValueError("Output path must include a file name.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    run_dir = Path(tempfile.mkdtemp(prefix=".basic-pitch-", dir=output_path.parent))
    command = ["basic-pitch", str(run_dir), str(input_path)]
    start = time.monotonic()
    try:
        completed = subprocess.run(
            command,
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=CONVERSION_TIMEOUT_SECONDS,
        )
        elapsed = time.monotonic() - start
        if completed.returncode != 0:
            raise RuntimeError(last_output_lines(completed.stdout))

        midi_files = list(run_dir.glob("*.mid"))
        if not midi_files:
            raise RuntimeError("Basic Pitch finished without creating a MIDI file.")

        midi_path = max(midi_files, key=lambda path: path.stat().st_mtime)
        shutil.move(str(midi_path), output_path)
        return {
            "status": "ok",
            "message": f"Basic Pitch conversion succeeded in {elapsed:.2f}s.",
            "elapsedSeconds": elapsed,
            "outputPath": str(output_path),
        }
    except subprocess.TimeoutExpired as exception:
        elapsed = time.monotonic() - start
        output = exception.output or ""
        if isinstance(output, bytes):
            output = output.decode("utf-8", errors="replace")
        detail = last_output_lines(output)
        raise RuntimeError(
            f"Basic Pitch timed out after {elapsed:.2f}s. {detail}"
        ) from exception
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)


def runtime_path(raw_path: str) -> Path:
    """Resolve a path and require it to stay inside the shared runtime root."""

    if not raw_path:
        raise ValueError("Path is required.")
    path = Path(raw_path).resolve()
    try:
        path.relative_to(RUNTIME_ROOT)
    except ValueError as exception:
        raise ValueError(f"Path is outside the shared runtime directory: {path}") from exception
    return path


def last_output_lines(output: str, limit: int = 8) -> str:
    """Return a compact command-output summary."""

    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return " / ".join(lines[-limit:]) if lines else "Basic Pitch failed without output."


def main() -> int:
    """Start the internal HTTP service."""

    server = ThreadingHTTPServer(("0.0.0.0", PORT), BasicPitchHandler)
    print(f"Basic Pitch service listening on {PORT}", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
