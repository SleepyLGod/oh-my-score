# Chord Map V1 Design

Checked on 2026-06-10.

## Summary

Chord Map is a new research direction for Oh-My-Score. The existing product
already converts MP3/WAV audio into MIDI notes through Piano ONNX and Basic
Pitch. Chord Map should not duplicate that path. It should produce a
musician-readable song map: tempo, key, section boundaries, chord spans, and
line-level lyric timestamps.

This direction is inspired by the song-map and chord-sheet workflow shown in the
reference screenshots, but the screenshots are treated as product inspiration,
not as a factual source about any specific tool.

## Product Intent

Chord Map helps musicians rehearse, discuss, and rearrange a song without first
needing a perfect multi-track MIDI transcription.

V1 should answer practical questions:

- Where are the intro, verse, chorus, bridge, interlude, and ending candidates?
- What chord is active at a given time?
- Which lyric line belongs to the current musical segment?
- Can a selected segment later become context for AI arrangement chat?

It is a lead-sheet style analysis layer. It is not full score layout, exact
MIDI reconstruction, or arbitrary-song multi-instrument transcription.

## Capability Boundaries

Oh-My-Score should keep three audio analysis concepts separate:

| Capability | Input | Output | Product meaning |
| --- | --- | --- | --- |
| MP3/WAV to MIDI | Audio | MIDI notes | Play, inspect, clean, arrange, and export note events. |
| Chord Map | Audio | JSON song map | Review harmony, sections, lyrics, and rehearsal context. |
| MT3-style transcription | Audio | Multi-instrument note events or MIDI | Future research for fuller note-level transcription. |

The first Chord Map prototype should not add a new product claim. It should only
prove whether the song-map artifact is useful enough to bring into the UI.

## V1 Output Contract

The prototype should write a JSON artifact with this shape:

```json
{
  "durationSec": 215.4,
  "bpm": 76,
  "key": "Bb",
  "mode": "major",
  "sections": [
    { "id": "section-1", "label": "Verse 1", "startSec": 13.0, "endSec": 35.0 }
  ],
  "chords": [
    { "startSec": 13.0, "endSec": 16.0, "chord": "Eb", "confidence": 0.62 }
  ],
  "lyrics": [
    { "startSec": 14.2, "endSec": 18.6, "text": "..." }
  ],
  "warnings": []
}
```

Rules:

- `sections` are candidates. V1 can use generic labels such as `Intro`,
  `Section A`, or `Section B` when confidence is low.
- `chords` are time spans, not score measures. V1 should merge short flickers
  when they are likely analysis noise.
- `lyrics` are line-level timestamps. V1 does not promise accurate word-level
  alignment.
- `warnings` should explain missing vocals, low chord confidence, unsupported
  formats, or analysis failures.

## Implementation Direction

Start with a Docker-only research prototype:

```bash
mkdir -p .isolation/chord-map/input .isolation/chord-map/output .isolation/chord-map/cache
docker compose --profile research run --rm chord-map \
  /workspace/input/sample.wav /workspace/output
```

The prototype should write:

- `song-map.json`
- `report.md`
- optional intermediate logs under the isolated output directory

Candidate technical path:

- Use FFmpeg to normalize MP3/WAV into a consistent mono analysis WAV.
- Use an MIR library such as Essentia or an Omnizart-style pipeline for BPM,
  beat grid, key, and chord candidates.
- Use whisper.cpp or WhisperX-style ASR for line-level lyric timestamps.
- Generate section candidates from chord changes, beat grid, energy/silence,
  lyric boundaries, and repeated harmonic patterns.
- Keep all model files, caches, and generated outputs under `.isolation/`.

Do not connect the prototype to the current Java backend, engine selector, or
frontend until it can generate useful artifacts on short real samples.

## Future UI Shape

If the prototype is useful, the product UI should be a Song Map panel in
Transcribe mode:

- a top summary for key, mode, BPM, duration, and warning status;
- a horizontal section timeline with clickable ranges;
- chord tiles aligned to time spans;
- lyric lines aligned under the current section;
- actions for play segment, loop segment, and later add segment to AI context.

The first UI should stay read-only. Manual chord correction, editable section
names, and segment-level AI arrangement chat should come after the data contract
is stable.

## Acceptance Criteria

- A short MP3/WAV produces a valid `song-map.json` or a clear blocker report.
- The artifact includes duration, BPM/key/mode, section candidates, chord spans,
  lyric lines, and warnings.
- The generated Markdown report states that Chord Map is a lead-sheet style
  analysis, not complete multi-instrument sheet music.
- Existing MP3-to-MIDI, Compare, Smart Score, cleanup, preset, timeline, and
  Sketch workflows remain unchanged.

## Research Notes

- Essentia provides tonal and rhythm algorithms, including chord, key, and beat
  related analysis APIs. Its ChordsDetection docs explicitly describe major/minor
  triad estimation from harmonic pitch class profiles and mark the algorithm as
  experimental, so confidence and warnings are required.
- Omnizart documents chord recognition and beat/downbeat tracking as MIR tasks
  related to AMT, which makes it relevant for research even if it is not chosen
  as the V1 runtime.
- whisper.cpp is attractive for local Docker experiments because it provides an
  offline ASR runtime and CLI path. WhisperX is relevant when word-level or
  tighter timestamp alignment becomes important, but V1 should only require
  line-level lyrics.

## Sources

- Essentia ChordsDetection: https://essentia.upf.edu/reference/std_ChordsDetection.html
- Essentia algorithms reference: https://essentia.upf.edu/algorithms_reference.html
- Omnizart paper: https://arxiv.org/abs/2106.00497
- whisper.cpp: https://github.com/ggml-org/whisper.cpp
- WhisperX: https://github.com/m-bain/whisperX
