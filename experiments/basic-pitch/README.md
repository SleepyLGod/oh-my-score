# Basic Pitch Prototype

This is a Docker-only research prototype for evaluating Basic Pitch as an
optional audio-to-MIDI transcription engine. It is not part of the current
Oh-My-Score product API and does not replace the existing Java ONNX piano
engine.

## Run

Put a short MP3 or WAV test file under the ignored isolation directory:

```bash
mkdir -p .isolation/basic-pitch/input .isolation/basic-pitch/output
```

Run the prototype worker:

```bash
docker compose --profile research run --rm basic-pitch \
  /workspace/input/sample.wav /workspace/output
```

Generated MIDI files are written to:

```text
.isolation/basic-pitch/output/
```

Repeated runs do not overwrite existing MIDI files. If the target name already
exists, the wrapper adds a timestamp suffix.

Open the generated `.mid` file with the existing Oh-My-Score `Open MIDI` control
to reuse Smart Score analysis, cleanup, presets, Bass + Melody, and timeline
playback.

## Evaluation Notes

V1 smoke result: a 1-second WAV generated a valid Standard MIDI file through the
Docker worker. The Python 3.11 install path pulls TensorFlow CPU dependencies, so
image size and cold start cost should be part of the next comparison.

Record these before deciding whether Basic Pitch should remain part of the
backend engine selector:

- Docker image size
- cold start time
- conversion time for the same short sample used by the current engine
- useful note quality in the browser and in an external MIDI editor
- whether the result is useful enough to keep in the user-choice engine selector

Keep MT3 and other multi-instrument models as research until they have a
reproducible Docker path and a clearer UI contract.
