# Transcription API

Spring Boot backend for converting piano audio into MIDI. It wraps the Java
transcription modules and exposes HTTP endpoints used by the static piano
player frontend.

## Run

Prefer the root Docker Compose workflow so Java, Maven, FFmpeg, model files, and
runtime output stay isolated from the host:

```bash
mkdir -p .isolation/models
curl -L -o .isolation/models/transcription.onnx \
  https://github.com/EveElseIf/pianotranscription_java/releases/download/blob/transcription.onnx
docker compose up --build
```

The API listens on:

```text
http://localhost:8084
```

## Endpoints

- `GET /transcription/health` returns a simple health check.
- `POST /transcription/audioToMidiWithFile` accepts `multipart/form-data` with
  an MP3 or WAV `file` field and returns a generated `.mid` file.
- `POST /transcription/mp3ToMidiWithFile` remains as a compatibility alias.
- `POST /transcription/jobs` accepts the same `multipart/form-data` fields plus
  an optional `engine` field. Supported engines are `piano-onnx` and
  `basic-pitch`; omitted values use `piano-onnx`.
- `GET /transcription/jobs/{id}` returns `queued`, `running`, `succeeded`, or
  `failed` status for an async conversion job.
- `GET /transcription/jobs/{id}/midi` downloads the generated MIDI once the job
  has succeeded.

## Configuration

The Docker setup passes these environment variables:

- `OMG_TRANSCRIPTION_MODEL_PATH` points to the ONNX model file.
- `OMG_TRANSCRIPTION_WORK_DIR` points to the runtime workspace for uploads,
  decoded audio, and generated MIDI files.
- `OMG_TRANSCRIPTION_BASIC_PITCH_URL` points to the Docker-internal Basic Pitch
  sidecar service for `basic-pitch` jobs.

When running outside Docker, FFmpeg must be installed and available on `PATH`,
the model path must point to a valid `transcription.onnx` file, and Basic Pitch
jobs require a reachable Basic Pitch sidecar service.
