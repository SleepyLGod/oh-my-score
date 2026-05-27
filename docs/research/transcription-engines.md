# Transcription Engine Research

Checked on 2026-05-26.

OMG Score currently uses the Java ONNX piano transcription path as its default
backend engine. The next product question is whether to add a second engine for
better audio-to-MIDI quality or broader instrument coverage. This document is a
research checkpoint, not a statement of currently supported product behavior.

## Recommendation

Decision: **go** for a Docker-isolated Basic Pitch prototype.

Basic Pitch is the best next experiment because it already exposes a Python CLI,
produces MIDI, supports common audio formats, and has a small enough integration
surface to test without changing the current API. It should be added as an
optional prototype engine first, not as a replacement for the existing piano
engine.

MT3 should stay in research. It is closer to the long-term multi-instrument goal,
but its T5X-based workflow, checkpoint handling, and Colab-oriented usage make it
too heavy for the next product increment.

## Current Engine: Java ONNX Piano Transcription

The current backend accepts MP3/WAV uploads, preprocesses audio with FFmpeg,
reuses a Java `Transcriptor` backed by ONNX Runtime, and returns a standard MIDI
file. This path is already wired into async jobs, progress messages, profiling,
Smart Score analysis, cleanup, preset export, and timeline playback.

Strengths:

- Already Docker-isolated with Java, Maven, FFmpeg, model path, and runtime
  output under the existing Compose workflow.
- Already shares the same MIDI output path used by source download, cleanup,
  presets, Bass + Melody, and playback.
- Already optimized enough to reuse the ONNX session between conversions.

Limits:

- The current product promise is piano audio to MIDI, not arbitrary-song
  multi-instrument transcription.
- Model quality and instrument coverage are bounded by the existing
  `transcription.onnx` engine.
- There is no explicit engine selector yet, so a second engine should be added
  behind a small backend abstraction before it reaches the UI.

## Candidate: Basic Pitch

Basic Pitch is a Spotify AMT library for audio-to-MIDI conversion with pitch
bend detection. The current PyPI release is `0.4.0` from 2024-08-16, and the
official project documents Python 3.8-3.11 support. It accepts common audio
formats including MP3, OGG, WAV, FLAC, and M4A, down-mixes to mono, resamples to
22050 Hz, and can generate MIDI through both CLI and Python APIs.

Fit for OMG Score:

- Input/output fit: strong. The CLI accepts an input audio path and writes MIDI,
  matching the existing job artifact model.
- Docker fit: strong. A Python sidecar image or optional backend worker can keep
  dependencies isolated from the host and from the Java backend.
- Product fit: good for an optional "general audio" experiment, especially
  single-instrument or simpler polyphonic material.
- Smart Score reuse: strong. The output is MIDI, so the existing analysis,
  cleanup, presets, Bass + Melody, source download, and timeline flows should
  work without frontend changes.
- Engine selector fit: good. It can be invoked by path-based job execution first,
  then promoted to an explicit `engine` option after quality and latency are
  measured.

Risks:

- Basic Pitch is instrument-agnostic, but its own docs say it works best on one
  instrument at a time. It should not be marketed as full band transcription.
- Runtime selection differs by platform. Linux defaults need to be verified in
  the Docker image instead of assuming local behavior.
- Repeated prediction should load the model once; the official docs warn against
  reloading the model in a loop. A production version should mirror the existing
  ONNX session reuse discipline.

Recommended prototype:

- Build a temporary Docker-only Basic Pitch worker.
- Mount the same isolated work directory used by backend jobs.
- Convert one short MP3/WAV into MIDI.
- Feed the resulting MIDI back into the current frontend manually or through the
  existing backend download flow.
- Record image size, cold start time, model load time, conversion time, and MIDI
  quality against the current engine.

## Candidate: MT3

MT3 is a multi-task, multi-track transcription model based on T5X. It directly
targets multi-instrument AMT and is therefore closer to the long-term "smart
score" vision than simple General MIDI preset changes.

Fit for OMG Score:

- Input/output fit: promising, because the goal is audio-to-notes for multiple
  instruments.
- Docker fit: uncertain and likely heavy. The public project points users to a
  Colab notebook and pretrained checkpoints rather than a small production CLI.
- Product fit: future research only. It needs a clearer contract for instrument
  classes, channels, confidence, latency, failure modes, and UI presentation.
- Smart Score reuse: partial. If it outputs MIDI or note events, analysis and
  playback can be reused, but multi-track output needs better channel/program
  interpretation than the current UI exposes.
- Engine selector fit: not yet. It should not be wired into the backend until a
  reproducible container path and sample quality comparison exist.

Risks:

- The runtime stack is much larger than the current Java backend and Basic Pitch
  prototype path.
- Multi-instrument output would require new UI language and validation so OMG
  Score does not overpromise arbitrary-song sheet music.
- Quality evaluation is harder because the expected output is no longer just a
  single piano-like MIDI track.

## Engine Selector Direction

Do not replace the current engine silently. The V1 product integration follows
that rule with an explicit backend engine selector and compare mode:

- Default stays as the current piano ONNX engine.
- Basic Pitch is labeled as experimental/general audio.
- MT3 remains hidden until a reproducible Docker prototype exists.
- All engines must return a MIDI file that can pass through the existing Smart
  Score pipeline.
- Engine-specific quality claims must be backed by sample conversions and timing
  logs.

## Sources

- Basic Pitch GitHub: https://github.com/spotify/basic-pitch
- Basic Pitch PyPI: https://pypi.org/project/basic-pitch/
- MT3 GitHub: https://github.com/magenta/mt3
- MT3 paper: https://arxiv.org/abs/2111.03017
