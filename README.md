<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com/?font=Roboto+Mono&size=25&width=240&color=46BEA3duration=1600&lines=🎵Oh-My-Score🎶" height="80"/>
  </br>
  <strong>✨ Convert piano audio to MIDI, then play it back in an interactive browser piano studio.</strong>
</p>

<p align="center">
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/blank.yml/badge.svg" alt="Node.js CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/backend.yml/badge.svg" alt="Backend CI"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml"><img src="https://github.com/SleepyLGod/oh-my-score/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://github.com/SleepyLGod/oh-my-score/commits/main"><img src="https://img.shields.io/github/last-commit/SleepyLGod/oh-my-score" alt="Last commit"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MPL--2.0-blue" alt="License: MPL 2.0"></a>
</p>

<p align="center">
  <img src="./docs/assets/demo.png" alt="OMG Score piano player demo">
</p>

## Overview

OMG Score is a browser-based piano workflow:

- Upload MP3/WAV piano audio and convert it to a standard MIDI file.
- Play MIDI files in a 3D piano scene with animated keys.
- Perform notes directly with mouse, touch, or keyboard input.
- Download converted MIDI files from the browser after conversion.
- Run the full stack locally through Docker without installing Node, Java,
  Maven, or FFmpeg on the host.

The static frontend can also be deployed to GitHub Pages. Static hosting supports
MIDI playback and the 3D piano UI; audio-to-MIDI conversion still requires the
backend API.

## Repository Layout

```text
apps/
  piano-player/       Static 3D piano frontend
  transcription-api/  Spring Boot audio-to-MIDI backend
packages/
  midi-player/        JavaScript MIDI parser/player package
docs/
  assets/             README and documentation images
```

## GitHub Pages Demo

```text
https://sleepylgod.github.io/oh-my-score/
```

The Pages workflow publishes [`apps/piano-player`](./apps/piano-player/).

## Isolated Local Run

This is the recommended development path. Runtime caches, the ONNX model, and
generated files stay under `.isolation/`.

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

Stop the services:

```bash
docker compose down
```

If conversion fails with a missing model error, confirm that
`.isolation/models/transcription.onnx` exists before starting Compose.

## API

- `GET /transcription/health` returns backend health.
- `POST /transcription/audioToMidiWithFile` accepts `multipart/form-data` with
  an MP3 or WAV `file` field and returns a generated `.mid` file.
- `POST /transcription/mp3ToMidiWithFile` is kept as a compatibility alias.

## Roadmap

- [x] Convert MP3 files to standard MIDI files.
- [x] Convert WAV files to standard MIDI files.
- [x] Upload local audio files freely.
- [x] Download converted MIDI files from the piano player.
- [x] Open local MIDI files directly in the browser.
- [x] Play standard MIDI files in the browser.
- [x] Change playback tempo in the MIDI player.
- [x] Control playback with play/pause, restart, stop, loop, and reset view.
- [x] Animate piano keys during MIDI playback.
- [x] Support interactive mouse, touch, and keyboard performance input.
- [x] Show keyboard mapping with note labels for the selected octave.
- [x] Show Smart Score MIDI analysis for loaded and converted MIDI.
- [x] Export source and conservatively cleaned MIDI variants.
- [x] Export simple instrument preset MIDI variants.
- [x] Add playback timeline and seek controls.
- [x] Run frontend and backend CI on GitHub Actions.
- [ ] Add progress tracking for long-running conversion jobs.
- [ ] Profile conversion time and evaluate ONNX session reuse.
- [ ] Research multi-instrument MIDI playback and visualization.

See [`docs/TODO.md`](./docs/TODO.md) for the detailed Smart Score roadmap.
See [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) for the local verification
and pre-commit review checklist.

## Tech Stack

- Three.js
- MIDI.js
- Spring Boot
- Maven
- FFmpeg
- Piano transcription ONNX model
