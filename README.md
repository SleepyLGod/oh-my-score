<p align="center">
  <img src="./docs/assets/header.png" alt="Oh-My-Score studio header">
</p>

<h1 align="center">Oh-My-Score</h1>

<p align="center">
  <strong>A local-first music studio for audio-to-MIDI transcription, MIDI review, Smart Score cleanup, and Strudel code-to-MIDI sketches.</strong>
</p>

<p align="center">
  <a href="https://sleepylgod.github.io/oh-my-score/"><strong>Try Static Preview</strong></a>
  ·
  <a href="#local-studio-full-workflow"><strong>Run Local Studio</strong></a>
  ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml/badge.svg" alt="Node.js CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml/badge.svg" alt="Backend CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/commits/main"><img src="https://img.shields.io/github/last-commit/SleepyLGod/oh-my-score" alt="Last commit"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License: MPL 2.0"></a>
</p>

<table>
  <tr>
    <td width="50%" align="center">
      <img src="./docs/assets/demo1.png" alt="Oh-My-Score Transcribe workspace" width="100%">
      <br>
      <strong>Transcribe Workspace</strong>
      <br>
      <sub>Convert audio or open MIDI, compare engines, inspect Smart Score analysis, clean and export variants.</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/assets/demo2.png" alt="Oh-My-Score Sketch workspace" width="100%">
      <br>
      <strong>Sketch Workspace</strong>
      <br>
      <sub>Write Strudel-style code, use optional AI edits, generate MIDI, preview results, and review note activity.</sub>
    </td>
  </tr>
</table>

## Overview

Oh-My-Score turns recordings and MIDI files into a playable, inspectable browser
workflow. It combines audio-to-MIDI transcription, a 3D piano player, MIDI
analysis, conservative cleanup/export tools, simple General MIDI arrangement
sketches, and a Strudel-inspired code-to-MIDI workspace.

The project is intentionally local-first. The complete workflow runs through
Docker with repo-local runtime files under `.isolation/`. A static GitHub Pages
preview is also available for MIDI playback, Smart Score inspection, and UI
exploration without starting the backend services.

## What You Can Do

### Transcribe And Review

- Convert MP3/WAV recordings into standard MIDI files with async jobs.
- Choose `piano-onnx`, `basic-pitch`, or Compare mode when running locally.
- Listen to multiple engine outputs and decide which MIDI to load; the app does
  not rank engines or select an output for you.
- Open local MIDI files directly in the browser.
- Inspect duration, tempo, tracks, channels, programs, note count, pitch range,
  and rough polyphony.
- Seek through the timeline, review bar/beat context, set loop ranges, and
  adjust playback speed.

### Clean, Export, And Arrange

- Download the original source MIDI for demo, local, converted, or generated
  MIDI.
- Create a separate cleaned MIDI variant with conservative short-note,
  duplicate-overlap, and velocity controls.
- Export General MIDI preset variants for Piano, Strings, Soft Synth, and
  Bass + Melody sketches.
- Adjust the Bass + Melody split point without overwriting the source MIDI.

### Sketch MIDI With Code

- Generate fixed-length MIDI sketches from editable Strudel-style JavaScript.
- Use examples, local drafts, search, diagnostics, and editor shortcuts in the
  docked Sketch workspace.
- Summarize the current source MIDI into a simplified Strudel draft.
- Optionally ask configured local AI models to generate, explain, edit, or help
  repair Strudel code. AI output stays editable; MIDI generation is always an
  explicit user action.

## Try It

| Mode | Best For | Works Without Docker | Needs Local Docker |
| --- | --- | --- | --- |
| Static Preview | Trying the UI, demo MIDI, local MIDI playback, Smart Score inspection | Demo MIDI, Open MIDI, playback, timeline, cleanup, presets | Audio transcription, Compare mode, Strudel generation, AI Sketch |
| Local Studio | Full transcription and code-to-MIDI workflow | Not applicable | Backend transcription, Basic Pitch sidecar, Strudel sidecar, optional AI sidecar |

### Static Preview

Open the hosted GitHub Pages demo:

```text
https://sleepylgod.github.io/oh-my-score/
```

Static hosting publishes [`apps/piano-player`](./apps/piano-player/). It can
play demo MIDI, open local MIDI files, show Smart Score analysis, and export
cleanup/preset variants for loaded MIDI. It cannot run local audio
transcription, Basic Pitch, Compare mode, Strudel MIDI generation, or AI Sketch
without the Docker services.

### Local Studio Full Workflow

Runtime caches, model files, and generated outputs stay under `.isolation/`.

```bash
mkdir -p .isolation/models
curl -L -o .isolation/models/transcription.onnx \
  https://github.com/EveElseIf/pianotranscription_java/releases/download/blob/transcription.onnx
docker compose up --build
```

Open the studio:

```text
http://localhost:8080
```

Local services:

| Service | URL | Purpose |
| --- | --- | --- |
| Frontend | `http://localhost:8080` | 3D piano, Transcribe, Smart Score, Sketch UI |
| Transcription API | `http://localhost:8084` | Audio-to-MIDI jobs and MIDI downloads |
| Strudel sketch service | `http://localhost:8091` | Docker-isolated code-to-MIDI export |
| AI sketch service | `http://localhost:8092` | Optional model-assisted Strudel drafts and edits |

Stop the services:

```bash
docker compose down
```

If conversion fails with a missing model error, confirm that
`.isolation/models/transcription.onnx` exists before starting Compose.

## Optional AI Setup

AI Sketch is optional. To enable it, copy [`.env.example`](./.env.example) to
`.env` and set at least one model key:

- `DEEPSEEK_API_KEY` enables `deepseek-v4-pro`.
- `XIAOMI_API_KEY` enables `mimo-v2.5-pro`.
- `MIMO_API_KEY` is also accepted as a compatibility alias.

The frontend never receives these keys. The Docker sidecar routes the selected
model through OpenAI-compatible Chat Completions locally.

If the page is running but AI Sketch reports that the service is unavailable,
start the sidecar with:

```bash
docker compose up -d ai-sketch-service
```

MiMo Token Plan keys start with `tp-` and should use:

```text
MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
```

Pay-as-you-go keys start with `sk-` and should use the pay-as-you-go base URL
from the Xiaomi console.

## Current Limitations

- Audio-to-MIDI quality depends on recording quality, polyphonic complexity,
  background noise, instrument clarity, and the selected engine.
- Compare mode is an audition workflow. It helps you listen to and inspect
  outputs, but it does not judge which engine is better.
- Smart Score cleanup and presets are conservative MIDI utilities, not a full
  score layout system or professional orchestration tool.
- Sketch mode exports fixed-length MIDI sketches. It is not a full Strudel live
  coding REPL and does not support arbitrary sample playback.
- Shared deployments should add Docker CPU and memory limits before exposing
  the backend or sidecar services beyond localhost.

## Current Status

- Audio transcription: MP3/WAV upload, async jobs, Piano ONNX, Basic Pitch, and
  Compare mode are implemented.
- Browser playback: local MIDI open, 3D piano animation, timeline seek,
  bar/beat review, loop ranges, speed control, and interactive performance
  input are implemented.
- Smart Score tools: MIDI analysis, source export, conservative cleanup, preset
  variants, cleanup controls, and configurable Bass + Melody sketches are
  implemented.
- Sketch mode: docked code-to-MIDI IDE, fixed-length Strudel pattern export,
  example patterns, local draft controls, MIDI preview, source load, download,
  editor diagnostics, contextual AI diagnostic fix, and generated note activity
  are implemented through Docker-isolated services.
- Optional AI Sketch: `deepseek-v4-pro` and `mimo-v2.5-pro` can generate
  editable Strudel pattern drafts when the matching local API key is configured.
  The same local sidecar can explain, edit, or summarize the current MIDI into
  Strudel code without automatically generating MIDI.
- Development workflow: Docker isolation, frontend CI, backend CI, and GitHub
  Pages deploy are configured.

See [`docs/TODO.md`](./docs/TODO.md) for the detailed Smart Score roadmap and
optional future backlog. See [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) for
the local verification and pre-commit review checklist.

## Repository Layout

```text
apps/
  piano-player/       Static 3D piano frontend
  transcription-api/  Spring Boot audio-to-MIDI backend
  basic-pitch-service Docker-internal Basic Pitch sidecar
  strudel-sketch-service Docker-isolated Strudel code-to-MIDI sidecar
  ai-sketch-service   Optional AI prompt-to-Strudel sidecar
packages/
  midi-player/        JavaScript MIDI parser/player package
docs/
  assets/             README and documentation images
experiments/
  basic-pitch/        Docker-only Basic Pitch prototype
  engine-eval/        Local engine comparison utility
```

## API

- `GET /transcription/health` returns backend health.
- `POST /transcription/audioToMidiWithFile` accepts `multipart/form-data` with
  an MP3 or WAV `file` field and returns a generated `.mid` file.
- `POST /transcription/mp3ToMidiWithFile` is kept as a compatibility alias.
- `POST /transcription/jobs` starts an async MP3/WAV conversion job. Optional
  `engine` values are `piano-onnx` and `basic-pitch`; omitted values use
  `piano-onnx`.
- `GET /transcription/jobs/{id}` returns queued, running, succeeded, or failed
  status for a conversion job.
- `GET /transcription/jobs/{id}/midi` downloads the generated MIDI for a job in
  the succeeded state.

## Tech Stack

- Three.js
- MIDI.js
- CodeMirror 5
- Spring Boot
- Maven
- FFmpeg
- ONNX Runtime
- Basic Pitch sidecar service
- Strudel sketch sidecar service
- OpenAI-compatible AI sketch sidecar

## Attribution

Preset browser playback uses selected FluidR3 General MIDI soundfont assets from
[`gleitz/midi-js-soundfonts`](https://github.com/gleitz/midi-js-soundfonts).
See [`docs/ATTRIBUTIONS.md`](./docs/ATTRIBUTIONS.md).
