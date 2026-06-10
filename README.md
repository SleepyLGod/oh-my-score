<p align="center">
  <img src="./docs/assets/header.png" alt="Oh-My-Score studio header">
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com/?font=Roboto+Mono&size=25&width=300&color=46BEA3&duration=1600&lines=Oh-My-Score" height="80" alt="Oh-My-Score"/>
  <br>
  <strong>Audio-to-MIDI transcription, browser playback, and Smart Score tools in one local-first studio.</strong>
</p>

<p align="center">
  English | <a href="./README.zh-CN.md">简体中文</a>
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
      <sub>Transcribe audio or MIDI, compare engines, inspect Smart Score results.</sub>
    </td>
    <td width="50%" align="center">
      <img src="./docs/assets/demo2.png" alt="Oh-My-Score Sketch workspace" width="100%">
      <br>
      <sub>Sketch Strudel code, use AI edits, preview MIDI, and review note activity.</sub>
    </td>
  </tr>
</table>

## Overview

Oh-My-Score turns piano recordings and MIDI files into a playable, inspectable
browser workflow. It combines local audio-to-MIDI transcription, a 3D piano
player, MIDI analysis, cleanup/export tools, and simple arrangement sketches.

The project is built for local-first experimentation: the full stack runs
through Docker, while the static frontend can also be published as a GitHub
Pages demo for MIDI playback and UI exploration.

## Who It Is For

Oh-My-Score is intended for people who want a local, inspectable MIDI workflow,
including:

- Piano learners who want to turn practice recordings into playable MIDI for review.
- MIDI hobbyists who like inspecting, cleaning, remixing, and exporting MIDI files.
- DAW and MuseScore users who want downloadable MIDI they can continue editing in
  their existing tools.
- Local AI and music tooling experimenters who want Docker-isolated transcription,
  sketching, and optional AI-assisted pattern drafts.
- Developers evaluating transcription engines and comparing their outputs by
  listening, loading, and inspecting generated MIDI.

## Current Limitations

- Audio-to-MIDI transcription quality depends on recording quality, polyphonic
  complexity, background noise, instrument clarity, and the capabilities of the
  selected model or engine.
- Compare mode helps you listen to and inspect multiple engine outputs side by
  side; it does not automatically judge which engine is better or choose a
  winner for you.
- Smart Score cleanup and presets are conservative MIDI utilities for analysis,
  cleanup, and quick General MIDI variants; they are not a complete score layout
  system or professional orchestration tool.

## What You Can Do

- Convert MP3/WAV audio into standard MIDI files.
- Choose Piano ONNX, Basic Pitch, or Compare mode for conversion.
- Preview, load, and download generated MIDI results.
- Inspect MIDI duration, tempo, tracks, channels, programs, notes, pitch range,
  and rough polyphony.
- Export source MIDI, conservatively cleaned MIDI, and General MIDI preset
  variants.
- Create lightweight Piano, Strings, Soft Synth, and Bass + Melody arrangement
  sketches.
- Generate fixed-length code-to-MIDI sketches from Strudel-style pattern code,
  or optionally ask a configured AI model for an editable pattern draft.
- Play MIDI in a 3D piano studio with animated keys, timeline seek, loop, speed
  control, mouse/touch input, and keyboard performance.

## Why Oh-My-Score

- Local-first: audio conversion runs on your machine instead of a hosted service.
- Docker-isolated: no host Node, Java, Maven, or FFmpeg install is required.
- Transparent: converted MIDI stays downloadable and reusable in MuseScore, DAWs,
  and other MIDI editors.
- User-choice workflow: Compare mode is for listening and inspection; Oh-My-Score
  does not rank engines or select a result automatically.

## GitHub Pages Demo

```text
https://sleepylgod.github.io/oh-my-score/
```

The Pages workflow publishes [`apps/piano-player`](./apps/piano-player/).
Static hosting supports MIDI playback and the 3D piano UI. Audio-to-MIDI
conversion requires the local Docker backend.

## Static Demo vs Local Studio

GitHub Pages and Vercel run Oh-My-Score as a static frontend preview. Hosted
static pages support demo MIDI playback, local MIDI opening, Smart Score
analysis, timeline review, cleanup, and preset exports for loaded MIDI.

Audio transcription, Basic Pitch, Compare mode, Strudel MIDI generation, and AI
Sketch require the local Docker services. Run the local studio with
`docker compose up --build` when you need the complete workflow.

## Isolated Local Run

Runtime caches, the ONNX model, and generated files stay under `.isolation/`.

```bash
mkdir -p .isolation/models
curl -L -o .isolation/models/transcription.onnx \
  https://github.com/EveElseIf/pianotranscription_java/releases/download/blob/transcription.onnx
docker compose up --build
```

Open the frontend:

```text
http://localhost:8080
```

The backend API listens on:

```text
http://localhost:8084
```

The Strudel sketch service listens on:

```text
http://localhost:8091
```

The optional AI sketch service listens on:

```text
http://localhost:8092
```

To enable AI-generated Strudel drafts, copy [`.env.example`](./.env.example) to
`.env` and set at least one model key. Use `DEEPSEEK_API_KEY` for
`deepseek-v4-pro`; use `XIAOMI_API_KEY` for `mimo-v2.5-pro`
(`MIMO_API_KEY` is also accepted as a compatibility alias). The frontend never
receives these keys; the Docker sidecar routes the selected model through
OpenAI-compatible Chat Completions locally.

If the page is running but AI Sketch reports that the service is unavailable,
start the sidecar with `docker compose up -d ai-sketch-service` and retry.

MiMo Token Plan keys start with `tp-` and should use
`MIMO_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1`. Pay-as-you-go keys
start with `sk-` and should use the pay-as-you-go base URL from the Xiaomi
console.

Sketch mode executes user-supplied Strudel JavaScript inside the Docker
sidecar, not in the main frontend bundle. The service accepts only configured
frontend origins, rate-limits generation requests, syntax-checks patterns before
export, and kills exports after 60 seconds. For shared deployments, add Docker
CPU and memory limits before exposing the service beyond localhost.

Stop the services:

```bash
docker compose down
```

If conversion fails with a missing model error, confirm that
`.isolation/models/transcription.onnx` exists before starting Compose.

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
  and generated note activity are implemented through a Docker-isolated sidecar.
- Optional AI Sketch: `deepseek-v4-pro` and `mimo-v2.5-pro` can generate
  editable Strudel pattern drafts when the matching local API key is configured.
  The same local sidecar can explain, edit, or summarize the current MIDI into
  Strudel code without automatically generating MIDI. MiMo uses a compact
  sketch-spec builder internally for reliability.
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
