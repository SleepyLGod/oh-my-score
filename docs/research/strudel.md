# Strudel Research Note

Checked on 2026-05-27.

Strudel is interesting for Oh-My-Score, but it belongs to a different product
lane than audio transcription. The official documentation describes Strudel as a
web-based live coding environment that implements the Tidal Cycles algorithmic
pattern language in JavaScript. Its MIDI documentation also describes Web MIDI
output for patterning software or hardware synthesizers.

## Product Fit

Potential fit:

- Code-to-music sketches inside the browser.
- Algorithmic MIDI patterns that can be sent to a DAW, synth, or future
  Oh-My-Score MIDI import path.
- A creative companion to Smart Score after the transcription engine is stable.

Non-fit for the current engine comparison:

- Strudel is not an MP3/WAV-to-MIDI transcription engine.
- It does not compare Basic Pitch with the current ONNX piano backend.
- It should not be mixed into the backend engine selector decision.

## Feasibility Spike

Status: V1 done under `experiments/strudel-sketch/`, then productized as a
Docker-isolated `strudel-sketch-service` and a separate frontend `Sketch` mode.

The first spike keeps Strudel outside the main app and tests the smallest useful
path:

```text
Strudel Pattern
        |
        v
fixed-length event query
        |
        v
Standard MIDI file
        |
        v
Oh-My-Score Open MIDI
```

The prototype uses real `@strudel/core` low-level pattern modules, queries
fixed-length note events, and writes Standard MIDI files under
`.isolation/strudel-sketch/output/`.

Smoke result: the default pattern exported a 2-track Standard MIDI file with
128 note-on events, PPQ 480 timing, and an F1-A4 pitch range. The generated file
is readable by the experiment inspector and can be opened through Oh-My-Score's
existing `Open MIDI` path.

Product V1 keeps the scope intentionally narrow: users can generate fixed 4/8
bar MIDI sketches, preview the result, load it as the current Smart Score source,
or download it. It is not a full Strudel live coding IDE, Web MIDI device output
surface, or audio transcription engine.

Runtime boundary: Sketch mode executes user-supplied Strudel JavaScript in the
Docker sidecar. The service restricts CORS to configured frontend origins,
rate-limits generation requests, rejects oversized pattern source, runs a syntax
check before export, and kills exports after 60 seconds. If the service is ever
exposed beyond localhost, the Compose deployment should also set explicit CPU
and memory limits.

The top-level `@strudel/core` and `@strudel/tonal` imports are not used in the
Node exporter because they currently pull in browser REPL code that fails in the
isolated Node runtime. That is useful evidence for productization: direct app
integration should be treated as a separate UI/license decision, not as a
backend-style engine dependency.

Future questions:

- Should the editor add examples, linting, or syntax highlighting without
  becoming a full live coding IDE?
- Should Sketch mode support drum/percussion mappings or stay pitch-only?
- Should advanced users be linked to the official Strudel REPL for live coding
  workflows instead of expanding Oh-My-Score into a full REPL?

License note: Strudel packages are AGPL-3.0-or-later. Direct app integration
needs a separate license decision before productization. A research container or
external link/iframe keeps this question isolated for now.

## Sources

- Strudel Getting Started: https://strudel.cc/learn/getting-started/
- Strudel MIDI, OSC and MQTT: https://strudel.patternclub.org/learn/input-output/
