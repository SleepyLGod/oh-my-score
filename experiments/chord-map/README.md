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
- a conservative `useful` / `noisy` / `blocked` harmony reliability assessment
- a `useCase` hint for lead-sheet review, harmonic review, or blocked inputs
- a separate lyrics/ASR status

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
.isolation/chord-map/output/raw-chords.json
.isolation/chord-map/output/report.md
```

Build a local review pack from generated outputs:

```bash
python3 experiments/chord-map/make-review-summary.py
```

The summary is written to:

```text
.isolation/chord-map/output/review-summary.md
```

Build a local quality pack when reference data is available:

```bash
python3 experiments/chord-map/make-quality-summary.py
```

The quality summary is written to:

```text
.isolation/chord-map/output/quality-summary.md
```

Prepare a local GuitarSet chord-reference pack after downloading the GuitarSet
annotation and mono mic audio archives:

```bash
mkdir -p .isolation/chord-map/guitarset
curl -L https://zenodo.org/api/records/3371780/files/annotation.zip/content \
  -o .isolation/chord-map/guitarset/annotation.zip
curl -L https://zenodo.org/api/records/3371780/files/audio_mono-mic.zip/content \
  -o .isolation/chord-map/guitarset/audio_mono-mic.zip
python3 experiments/chord-map/prepare-guitarset-reference-pack.py
```

The script writes selected audio files to `.isolation/chord-map/input/` and
matching chord references to `.isolation/chord-map/reference/`. These files are
local evaluation data and should stay out of git.

Python caches stay under:

```text
.isolation/chord-map/cache/
```

## Scope

Chord Map is not full multi-instrument transcription. It does not create MIDI
notes and does not produce a complete score. Treat the output as a research
artifact for rehearsal and arrangement context.

`song-map.json` contains the smoothed chord timeline intended for future UI
experiments. `raw-chords.json` is research-only diagnostic output for comparing
raw MIR frames against the readable timeline.

The `harmonyReliability` object in `song-map.json` is a guardrail, not an
accuracy score. It uses general signals such as chord confidence,
chord-change density, short-span leftovers, confident chord coverage, and
percussion-like inputs to decide whether the harmony timeline is reviewable,
noisy enough to treat with caution, or blocked because the chord labels are
likely meaningless. A `useful` status means reviewable, not accurate.

`useCase` separates review intent from reliability:

- `lead-sheet-friendly`: sparse enough for draft chord-chart review.
- `harmonic-review`: suitable for inspecting harmony, but not a simple chord
  chart.
- `percussive-blocked`: mostly percussive input where chord labels are
  misleading.
- `insufficient-harmony`: too little stable harmonic evidence.

`lyricsStatus` is separate from harmony reliability:

- `available`: a real whisper.cpp run produced line-level lyric timestamps.
- `mock`: the bundled mock helper produced deterministic smoke-test lyrics.
- `skipped`: ASR was not attempted because the binary or model was unavailable.
- `failed`: ASR was attempted but did not produce a valid JSON artifact.
- `empty`: ASR ran but found no lyric segments.

V1 uses Essentia for MIR analysis. The lean Docker image keeps FFmpeg and
`whisper.cpp` optional so it can run in constrained local Docker environments:

- when FFmpeg is present, the runner normalizes audio before analysis;
- when FFmpeg is absent, Essentia reads the source audio directly and records a
  warning;
- when a `whisper-cli` binary and model are mounted through `WHISPER_CPP_BIN`
  and `WHISPER_CPP_MODEL`, the runner adds line-level lyric timestamps;
- otherwise it writes empty lyrics with an explicit warning.

For a real ASR smoke, mount or cache a real `whisper-cli` binary and model, then
run:

```bash
docker compose --profile research run --rm chord-map-whisper-setup
```

The `chord-map` worker runs inside a Linux Docker container, so the cached
`whisper-cli` must also be a Linux binary. Do not use a `whisper-cli` built on
the macOS host for Docker ASR; run the setup service above so the binary is
built in the same container platform. The setup script writes
`whisper-cli.platform` and rebuilds the binary when the cached executable does
not match the current setup runtime.

If setup succeeds, it writes:

```text
.isolation/chord-map/cache/whisper/whisper-cli
.isolation/chord-map/cache/whisper/whisper-cli.platform
.isolation/chord-map/cache/whisper/ggml-base.bin
```

If setup fails because network, package, clone, build, or model download is
unavailable, it writes:

```text
.isolation/chord-map/cache/whisper/SETUP-BLOCKER.md
```

Then run:

```bash
docker compose --profile research run --rm \
  -e WHISPER_CPP_BIN=/workspace/cache/whisper/whisper-cli \
  -e WHISPER_CPP_MODEL=/workspace/cache/whisper/ggml-base.bin \
  chord-map /workspace/input/vocal-sample.ogg /workspace/output/vocal-sample-asr
```

For local research, keep the binary and model under the ignored cache path:

```text
.isolation/chord-map/cache/whisper/whisper-cli
.isolation/chord-map/cache/whisper/ggml-base.bin
```

The image also includes `/usr/local/bin/mock-whisper-cli` for deterministic
integration smoke only. It proves that `lyrics[]` can be written into
`song-map.json`; it does not measure transcription quality and is marked as
`lyricsStatus.status = "mock"`.

## Quality Evaluation

ASR and chord accuracy require reference data. Without reference lyrics or
reference chord spans, the evaluator reports `not-evaluated` rather than
claiming a good or bad result.

Reference files are local-only and should stay under:

```text
.isolation/chord-map/reference/
```

Supported reference shapes:

```json
{
  "lyrics": [
    { "startSec": 1.0, "endSec": 4.0, "text": "reference lyric line" }
  ],
  "chords": [
    { "startSec": 0.0, "endSec": 4.0, "chord": "C" }
  ]
}
```

Run individual evaluators:

```bash
python3 experiments/chord-map/evaluate-asr.py \
  .isolation/chord-map/output/a-chantar-vocal-real-asr/song-map.json

python3 experiments/chord-map/evaluate-chords.py \
  .isolation/chord-map/output/el-noi-guitar-smoothed/song-map.json
```

Prepare a small public-domain singing ASR reference pack:

```bash
python3 experiments/chord-map/prepare-public-song-asr-reference-pack.py
```

The script writes audio inputs, lyric references, and a manifest under
`.isolation/chord-map/`. It currently prepares:

- `la-marseillaise-commons`: public-domain Wikimedia Commons audio with French
  TimedText SRT, so WER/CER and line timing can be evaluated when ASR produces
  non-marker lyric lines.
- `star-spangled-solo`: public-domain U.S. Navy Band solo vocal performance with
  a public-domain first-stanza text reference, so WER/CER can be evaluated.
- `star-spangled-choral`: public-domain U.S. Army Field Band choral performance
  with the same text-only reference, included to check choral ASR difficulty.

For ASR quality smoke, the local review pack can use the small JFK speech sample
from whisper.cpp with a matching local reference transcript. This validates real
`whisper.cpp` execution plus WER/CER reporting; it is a speech fixture, not a
song or chord-map quality sample. Vocal song samples that only produce marker
captions such as `[MUSIC]` or `(singing in foreign language)` are reported as
`lyricsStatus.status = "empty"` after marker filtering.

Current base-model singing ASR results show why this must stay research-only:
the Star-Spangled solo sample reports WER/CER, the choral sample is evaluated
but much noisier, and the La Marseillaise timed-reference sample can still be
`empty` when whisper.cpp produces no lyric lines after marker filtering.

For GuitarSet samples, the reference pack uses the manually verified JAMS chord
annotation when present and simplifies labels into the comparison vocabulary
used by the V1 evaluator. Metrics are still research signals; they are not a
product accuracy guarantee.

Essentia is AGPL-3.0-only, so this prototype must stay research-only until
licensing and deployment boundaries are reviewed.

## Public Sample Candidates

These are local evaluation inputs. Keep downloaded audio under
`.isolation/chord-map/input/`, not in git:

- `El Noi de la Mare (guitar)`: public domain guitar folk song from Wikimedia
  Commons, https://commons.wikimedia.org/wiki/File:El_Noi_de_la_Mare_(guitar).ogg
- `A Chantar2`: public domain vocal medieval song from Wikimedia Commons.
  https://commons.wikimedia.org/wiki/File:A_Chantar2.ogg
- `Drum beat`: CC BY-SA 3.0 drum recording by Mattgirling on Wikimedia Commons.
  https://commons.wikimedia.org/wiki/File:Drum_beat.ogg
- `JFK speech sample`: clear speech fixture from whisper.cpp for ASR WER/CER
  smoke only. It is not a song/chord-map sample.
  https://github.com/ggml-org/whisper.cpp/blob/master/samples/jfk.wav
- `La Marseillaise`: public-domain Wikimedia Commons audio with French TimedText
  reference. https://commons.wikimedia.org/wiki/File:La_Marseillaise.ogg
- `The Star-Spangled Banner` solo and choral performances: public-domain
  Wikimedia Commons audio with public-domain first-stanza text references from
  Wikisource.
