# Strudel Sketch Experiment

This is a feasibility spike for turning a Strudel pattern into a Standard MIDI
file that Oh-My-Score can open. It is not part of the production frontend or
backend.

## Run

```bash
mkdir -p .isolation/strudel-sketch/output
docker compose --profile research run --rm strudel-sketch
```

The generated MIDI is written to:

```text
.isolation/strudel-sketch/output/
```

Open the `.mid` file with the Oh-My-Score `Open MIDI` control to reuse Smart Score
analysis, timeline playback, cleanup, and preset export.

## Custom Pattern

Mount or place a pattern module under `.isolation/strudel-sketch/input/` and run:

```bash
docker compose --profile research run --rm strudel-sketch \
  --pattern /workspace/input/my-pattern.mjs \
  --output /workspace/output \
  --bars 8
```

The pattern module must export a Strudel Pattern as `default` or as a named
`pattern` export. For Node-based offline export, import low-level modules such
as `@strudel/core/pattern.mjs` and `@strudel/core/controls.mjs`; the top-level
`@strudel/core` entry also pulls in browser REPL code and is not used by this
spike.

## V1 Limits

- Only fixed-length offline export is tested.
- Only note-like pitch events are converted.
- Tonal helpers are not used in V1 because `@strudel/tonal` imports the
  top-level `@strudel/core` browser entry in Node and currently triggers a REPL
  dependency mismatch.
- Sample playback, drums, Web MIDI devices, and live coding UI are out of scope.
- Strudel packages are AGPL-3.0-or-later. Direct app integration needs a
  separate license decision before productization.
