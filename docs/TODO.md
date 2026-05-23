# OMG Score TODO: Smart Score Roadmap

This document tracks the next product direction for OMG Score: turning raw MIDI
or transcribed piano audio into cleaner, more useful score material. The first
phase should stay MIDI-first. Full arbitrary-song, multi-instrument audio
transcription is research scope, not a short-term product promise.

## PM View

### Product Goal

Make OMG Score useful after the first MIDI is generated. The user should be able
to inspect, clean, replay, and export a more usable version of the score without
leaving the browser.

### Target Users

- Piano learners who want to turn a recording into a playable MIDI sketch.
- Musicians who want a quick MIDI cleanup before importing into MuseScore, a DAW,
  or another editor.
- Developers and hobbyists who want a transparent local transcription workflow.

### Product Priorities

- P0: Make MIDI results explainable. Show what the file contains before changing
  it.
- P1: Make MIDI results cleaner. Remove obvious transcription noise and export
  cleaned variants.
- P1: Add simple arrangement presets. Keep these as MIDI program/channel changes,
  not as professional orchestration claims.
- P2: Improve playback control for score review. Timeline and seek matter more
  than more visual effects.
- P3: Research alternative transcription engines only after the MIDI workflow is
  stable.

### Explicit Non-Goals For V1

- Do not promise full MP3-to-multi-instrument sheet music for arbitrary songs.
- Do not add a large ML model service before the current backend workflow has
  long-running job handling and profiling.
- Do not label simple MIDI program changes as professional arrangement.

## Architecture View

### Current Boundary

OMG Score currently supports MP3/WAV piano audio to MIDI through the backend,
local MIDI loading in the frontend, and 3D piano playback in the browser. The
MIDI parser already exposes useful musical events such as note events, tempo,
channels, and program changes, but the product does not yet surface these as a
score analysis or arrangement workflow.

### MIDI-First Direction

The next layer should operate on MIDI data, regardless of whether it came from a
user upload or from audio transcription. This keeps the first Smart Score
features deterministic, testable, and useful without introducing a new model.

Recommended flow:

```text
Audio upload or local MIDI
        |
        v
Raw MIDI
        |
        v
Smart MIDI Analysis
        |
        v
Cleanup / Presets / Export variants
        |
        v
Playback and external editor import
```

### Backend Extension Path

Keep the current piano transcription engine as the default backend path. If a
second engine is added later, introduce an explicit engine selector instead of
replacing the current path silently.

Possible future engines:

- Basic Pitch: useful as an optional experiment for general audio-to-MIDI,
  especially single-instrument or simpler audio.
- MT3-style models: research only. Multi-instrument transcription requires a
  larger model service, longer processing, and a clearer UI contract.

### Data Model Direction

Smart Score features need an internal normalized note model before they need a
new visual design:

- notes: pitch, start tick, end tick, velocity, channel, track
- meta: tempo, time signature, key signature when available
- instruments: program changes by channel and track
- stats: duration, note count, polyphony, pitch range, track count

This model can be built from the existing MIDI parser first, then used by both
analysis UI and cleanup/export logic.

## Engineering View

### P0: Smart MIDI Analysis

Goal: show users what the loaded MIDI contains.

Status: done for the first read-only version.

Implementation scope:

- Parse loaded MIDI into a normalized analysis summary.
- Display duration, tempo, track count, channel count, instrument programs, note
  count, pitch range, and rough polyphony.
- Support both local MIDI files and newly converted MIDI blobs.

Acceptance criteria:

- Loading a MIDI file updates the analysis panel without changing playback.
- Converted MIDI and local MIDI follow the same analysis path.
- Invalid or unsupported MIDI files show a clear error instead of breaking the
  player UI.

### P1: Smart MIDI Cleanup

Goal: export a cleaner MIDI variant while preserving the original.

Status: V1 done for conservative duplicate-overlap removal, very short note
filtering, velocity normalization, source export, cleaned export, and cleaned
reload. Quantization and stricter user-configurable cleanup remain future work.

Implementation scope:

- Keep the current V1 cleanup defaults conservative.
- Add future user-facing options for stricter short-note filtering and duplicate
  note merging only after the exported MIDI path is stable.
- Treat quantization as a separate future feature because it needs careful
  tempo, division, and grid handling.

Acceptance criteria:

- The original MIDI remains downloadable and replayable.
- The cleaned MIDI can be loaded back into OMG Score.
- Cleanup does not remove normal short musical notes unless the user enables a
  stricter option.

### P1: Simple Instrument Presets

Goal: provide lightweight MIDI arrangement variants.

Implementation scope:

- Add presets such as Piano, Strings, Bass + Melody Split, and Soft Synth.
- Implement presets with MIDI channel/program changes and simple pitch-range or
  melody/bass splitting.
- Label the feature as presets or arrangement sketches, not full orchestration.

Acceptance criteria:

- Presets export valid MIDI files.
- Presets are reversible by returning to the original MIDI.
- The UI makes clear that presets change playback/export mapping, not the source
  audio transcription model.

### P2: Timeline, Seek, And Review Controls

Goal: make score review efficient.

Status: V1 done for current time, duration, progress display, and basic seek.
Future polish can add loop ranges or bar/beat grid after the player state is
more structured.

Implementation scope:

- Add timeline progress, current time, duration, and seek.
- Preserve existing play/pause, restart, stop, loop, and reset view controls.
- Keep keyboard and mouse performance input independent from playback controls.

Acceptance criteria:

- Seeking during playback resumes from the selected position.
- Loop behavior remains predictable after seeking.
- Timeline updates do not cause layout shifts.

### P2: Async Conversion Jobs

Goal: support longer audio files without blocking the UI on one request.

Implementation scope:

- Add job creation, status polling, and result download endpoints.
- Keep the current synchronous endpoint for compatibility.
- Store job artifacts under the existing isolated runtime directory.

Acceptance criteria:

- Long conversions show pending/running/succeeded/failed states.
- Completed jobs expose a MIDI download path.
- Failed jobs return actionable error messages for missing model, unsupported
  format, decode failure, and backend failure.

### P3: Alternative Transcription Engine Research

Goal: evaluate whether another model improves useful output.

Implementation scope:

- Research Basic Pitch as an optional engine.
- Document deployment size, runtime cost, output quality, and supported formats.
- Treat MT3-style multi-instrument transcription as a future research milestone.

Acceptance criteria:

- No new engine is merged without a Docker-isolated runtime path.
- The UI never implies arbitrary-song multi-instrument transcription is supported
  until the backend and export path actually prove it.
- Research output includes a go/no-go recommendation before implementation.

## Near-Term Recommended Order

1. Add simple instrument presets.
2. Add async conversion jobs.
3. Profile conversion time and evaluate ONNX session reuse.
4. Revisit alternative transcription engines.
