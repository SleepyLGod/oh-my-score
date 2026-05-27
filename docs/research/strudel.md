# Strudel Research Note

Checked on 2026-05-27.

Strudel is interesting for OMG Score, but it belongs to a different product
lane than audio transcription. The official documentation describes Strudel as a
web-based live coding environment that implements the Tidal Cycles algorithmic
pattern language in JavaScript. Its MIDI documentation also describes Web MIDI
output for patterning software or hardware synthesizers.

## Product Fit

Potential fit:

- Code-to-music sketches inside the browser.
- Algorithmic MIDI patterns that can be sent to a DAW, synth, or future OMG
  Score MIDI import path.
- A creative companion to Smart Score after the transcription engine is stable.

Non-fit for the current engine comparison:

- Strudel is not an MP3/WAV-to-MIDI transcription engine.
- It does not answer whether Basic Pitch is better than the current ONNX piano
  backend.
- It should not be mixed into the backend engine selector decision.

## Recommended Next Step

Do not add Strudel to the app yet. First finish automated ONNX vs Basic Pitch
comparison. Then run a separate embedding feasibility spike:

- Can a Strudel editor be embedded without turning OMG Score into a full live
  coding IDE?
- Can Strudel output be exported or captured as MIDI in a way that the existing
  Smart Score pipeline can open?
- Does this improve the product for score creation, or is linking to the
  official Strudel REPL enough for V1?

## Sources

- Strudel Getting Started: https://strudel.cc/learn/getting-started/
- Strudel MIDI, OSC and MQTT: https://strudel.patternclub.org/learn/input-output/
