# Chord Map Prototype

This is a Docker-only research prototype for validating a Song Map / Chord Map
workflow. It is not part of the current Oh-My-Score product API and does not
replace MP3/WAV-to-MIDI conversion.

The prototype turns a short MP3/WAV into a lead-sheet style analysis artifact:

- BPM, key, and mode
- chord time spans
- conservative section candidates
- line-level lyric timestamps when vocals are detected
- warnings and confidence notes

## Run

Put a short MP3 or WAV test file under the ignored isolation directory:

```bash
mkdir -p .isolation/chord-map/input .isolation/chord-map/output .isolation/chord-map/cache
```

Run the prototype worker:

```bash
docker compose --profile research run --rm chord-map \
  /workspace/input/sample.wav /workspace/output
```

The worker writes:

```text
.isolation/chord-map/output/song-map.json
.isolation/chord-map/output/report.md
```

Python caches stay under:

```text
.isolation/chord-map/cache/
```

## Scope

Chord Map is not full multi-instrument transcription. It does not create MIDI
notes and does not produce a complete score. Treat the output as a research
artifact for rehearsal and arrangement context.

V1 uses Essentia for MIR analysis. The lean Docker image keeps FFmpeg and
`whisper.cpp` optional so it can run in constrained local Docker environments:

- when FFmpeg is present, the runner normalizes audio before analysis;
- when FFmpeg is absent, Essentia reads the source audio directly and records a
  warning;
- when a `whisper-cli` binary and model are mounted through `WHISPER_CPP_BIN`
  and `WHISPER_CPP_MODEL`, the runner adds line-level lyric timestamps;
- otherwise it writes empty lyrics with an explicit warning.

Essentia is AGPL-3.0-only, so this prototype must stay research-only until
licensing and deployment boundaries are reviewed.
