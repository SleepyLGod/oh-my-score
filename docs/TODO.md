# Oh-My-Score TODO: Smart Score Roadmap

This document tracks the next product direction for Oh-My-Score: turning raw MIDI
or transcribed piano audio into cleaner, more useful score material. The first
phase should stay MIDI-first. Full arbitrary-song, multi-instrument audio
transcription is research scope, not a short-term product promise.

## PM View

### Product Goal

Make Oh-My-Score useful after the first MIDI is generated. The user should be able
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

Oh-My-Score currently supports MP3/WAV piano audio to MIDI through the backend,
local MIDI loading in the frontend, and 3D piano playback in the browser. The
MIDI parser already exposes useful musical events such as note events, tempo,
channels, and program changes, but the product does not yet surface these as a
score analysis or arrangement workflow.

### MIDI-First Direction

The next layer should operate on MIDI data, regardless of whether it came from a
user upload or from audio transcription. This keeps the first Smart Score
features deterministic, testable, and useful without introducing a new model.

MIDI-first flow:

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

Keep the current piano transcription engine as the default backend path. Basic
Pitch is now available as an explicit alternate engine through the async job API,
and compare mode lets users choose the output they prefer instead of replacing
the current path silently.

Engine boundaries:

- Piano ONNX: default local piano transcription engine.
- Basic Pitch: optional Docker-internal sidecar for experimental general
  audio-to-MIDI conversion.
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
- The cleaned MIDI can be loaded back into Oh-My-Score.
- Cleanup does not remove normal short musical notes unless the user enables a
  stricter option.

### P1: Simple Instrument Presets

Goal: provide lightweight MIDI arrangement variants.

Status: V1 done for Piano, Strings, Soft Synth, and Bass + Melody program
presets, including browser preview with bundled preset soundfonts and a
configurable Bass + Melody split point. More advanced splitting remains future
work because it needs deliberate channel and note event rewriting.

Implementation scope:

- Keep the current Piano, Strings, and Soft Synth presets as simple General MIDI
  program variants.
- Implement V1 presets with MIDI program changes only.
- Keep Bass + Melody V1 conservative: user-selected split point, bass on channel
  2, melody on channel 1, and no chord detection.
- Keep browser playback soundfont support limited to the bundled preset
  instruments.
- Keep richer melody extraction as later work.
- Label the feature as presets or arrangement sketches, not full orchestration.

Acceptance criteria:

- Presets export valid MIDI files.
- Presets can be previewed in the browser with bundled soundfonts.
- Bass + Melody exports a separate MIDI variant without changing the source.
- Bass + Melody can be regenerated with a user-selected split point.
- Presets are reversible by returning to the original MIDI.
- The UI makes clear that presets change playback/export mapping, not the source
  audio transcription model.

### P2: Timeline, Seek, And Review Controls

Goal: make score review efficient.

Status: V1 done for current time, duration, progress display, basic seek,
bar/beat display, timeline bar markers, and loop ranges.

Implementation scope:

- Add timeline progress, current time, duration, seek, bar/beat display, and
  simple timeline markers.
- Add loop start, loop end, and loop range clearing while preserving full-track
  loop behavior when no range is set.
- Preserve existing play/pause, restart, stop, loop, and reset view controls.
- Keep keyboard and mouse performance input independent from playback controls.

Acceptance criteria:

- Seeking during playback resumes from the selected position.
- Loop behavior remains predictable after seeking and when a loop range is set.
- Timeline updates do not cause layout shifts.

### P2: Async Conversion Jobs

Goal: support longer audio files without blocking the UI on one request.

Status: V1 done with in-memory backend jobs, single-worker conversion, frontend
status polling, and completed MIDI download back into the existing player flow.

Implementation scope:

- Keep job creation, status polling, and result download endpoints small and
  compatible with the current Docker-isolated runtime.
- Keep the current synchronous endpoint for compatibility.
- Store job artifacts under the existing isolated runtime directory.

Acceptance criteria:

- Long conversions show queued/running/succeeded/failed states.
- Completed jobs expose a MIDI download path.
- Failed jobs return actionable error messages for missing model, unsupported
  format, decode failure, and backend failure.

### P2: Conversion Performance Profiling

Goal: make backend conversion bottlenecks visible before changing the
transcription engine lifecycle.

Status: V1 done with backend timing logs for upload/store, ffmpeg preprocessing,
PCM read/normalization, ONNX session creation, transcription/MIDI generation,
and total conversion time.

Implementation scope:

- Keep profiling lightweight with stdout timing logs and async job messages.
- Use profiling data to validate that ONNX session reuse improved performance.
- Keep the current sync and async conversion API shape unchanged.

Acceptance criteria:

- Successful async jobs include elapsed conversion time in their status message.
- Backend logs show phase timing for each conversion.
- The next optimization decision is based on measured session creation and
  transcription time, not assumptions.

### P2: ONNX Session Reuse

Goal: remove repeated ONNX session creation from each conversion while keeping
conversion behavior and API shape unchanged.

Status: V1 done with a lazy shared `Transcriptor`, model-path replacement,
synchronized access for the reused session, and shutdown cleanup.

Implementation scope:

- Reuse one backend `Transcriptor` for the active model path.
- Keep conversion profiling active so reuse impact remains visible.
- Close ONNX session resources when the service shuts down or model path changes.

Acceptance criteria:

- Consecutive conversions succeed with the same backend process.
- The second conversion reports little or no `sessionCreateMs`.
- Inference and MIDI generation timings remain visible for future optimization.

### P2: Current Workflow Polish

Goal: make the completed Smart Score workflow clearer before adding larger
features.

Status: V1 done for clearer conversion elapsed-time status, source/cleaned/preset
variant wording, variant reload behavior, and README roadmap synchronization.

Implementation scope:

- Keep conversion, analysis, cleanup, preset, and playback APIs unchanged.
- Make UI status messages distinguish source MIDI, cleaned MIDI, and preset MIDI.
- Keep completed profiling and ONNX session reuse visible in public docs.

Acceptance criteria:

- Async conversion success keeps elapsed-time context in the loaded state.
- Restart and speed reload preserve existing cleaned and preset variant controls.
- Docs do not imply Bass + Melody Split or alternative transcription engines are
  already supported.

### P3: Alternative Transcription Engine Research

Goal: evaluate whether another model improves useful output.

Status: research V1 done in
[`docs/research/transcription-engines.md`](./research/transcription-engines.md).
Basic Pitch is now promoted from research prototype to a Docker-internal sidecar
engine. MT3 remains future research.

Basic Pitch prototype status: V1 done under `experiments/basic-pitch/`. It is a
Docker-only research worker, not a supported backend engine. A 1-second WAV
smoke test generated a valid Standard MIDI file.

Engine comparison status: V1 done under `experiments/engine-eval/`. It compares
the current ONNX backend and Basic Pitch prototype with isolated samples,
automatic MIDI metrics, and manual listening placeholders in a generated
Markdown report.

Engine selector status: V1 done. The async conversion API accepts `piano-onnx`
or `basic-pitch`, and the frontend can run either single-engine conversion or a
compare job that leaves the final choice to the user.

Compare audition status: V1 done. Compare cards show neutral engine status,
compact MIDI metrics, Preview/Load/Download actions, and keep the source audio
preview available as the A/B reference.

Compare lifecycle status: V1 done. Compare result URLs can be cleared without
replacing the formally loaded Smart Score source, stale compare results are
removed when the input or mode changes, and temporary browser object URLs are
released during cleanup.

Studio polish status: V1 done. The app keeps the same Transcribe and Sketch
workflows, but the interface is organized around clearer studio regions: Source
& Jobs, Stage, Score Inspector, and shared transport. Strudel service cleanup
remains a reliability task, not a new product capability.

Review tools status: V1 done. The shared transport now shows bar/beat context,
estimated total bars, timeline markers, and loop range controls.

Strudel ergonomics status: V1 done. Sketch mode includes Arpeggio, Bassline,
Chord sketch, and Minimal melody examples plus reset, tidy, and clear editor
actions. Examples replace the editor content only; MIDI generation remains an
explicit user action.

Strudel Workspace V2 status: V1 done for local draft controls and AI-assisted
MIDI-to-Strudel sketching. The workspace can summarize the current source MIDI
into a compact prompt for the AI sidecar, then replace the editor only after
validated Strudel source is returned. This is a simplified sketch workflow, not
exact MIDI reconstruction.

AI Sketch status: V1 done for optional model-first prompt-to-pattern support.
`deepseek-v4-pro` and `mimo-v2.5-pro` are routed through OpenAI-compatible Chat
Completions inside a Docker sidecar. AI output is treated as editable Strudel
source only; users still explicitly generate MIDI with the existing Sketch
workflow. MiMo uses a compact sketch-spec builder internally, then local code
compiles that spec into Strudel source for better reliability.

AI Explain/Edit status: V1 done. Sketch mode can explain the current Strudel
code or apply a user-requested edit through the same local AI sidecar. Edits
replace the editor content only after source validation; MIDI generation remains
an explicit user action.

Sketch Docked IDE status: V1 done. Sketch mode now uses a docked, resizable
right-side code-to-MIDI workspace with a compact toolbar, larger editor, AI and
draft tools, generated MIDI output, and a lightweight Note Activity view. This
does not change the Transcribe workflow and does not turn Sketch into a full
live Strudel REPL.

Cleanup controls status: V1 done. Smart Score cleanup now exposes short-note,
duplicate-overlap, and velocity normalization controls while preserving the
previous default behavior and keeping cleaned MIDI as a separate variant.

Implementation scope:

- Keep Piano ONNX as the default engine.
- Keep Basic Pitch available as an explicit, experimental engine.
- Document deployment size, runtime cost, output quality, and supported formats.
- Treat MT3-style multi-instrument transcription as a future research milestone.
- Treat Strudel as a future creative-coding MIDI sketch direction, not an audio
  transcription engine.

Acceptance criteria:

- No new engine is merged without a Docker-isolated runtime path.
- The UI never implies arbitrary-song multi-instrument transcription is supported
  until the backend and export path actually prove it.
- Research output documents integration risk before a new engine is implemented.

## Optional Backlog

The main V1 workflow is complete. Future work should be picked deliberately from
this backlog instead of being treated as the next required step:

1. Continue deeper Strudel editor polish only if code-to-MIDI sketching becomes
   a frequent workflow; keep it separate from transcription claims.
2. Keep MT3-style multi-instrument transcription as future research until there
   is a reproducible Docker prototype and a clear UI contract.
