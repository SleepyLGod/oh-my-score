import { n, note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "strudel-sketch-default",
  title: "Strudel Sketch Default",
  description: "A small melody, bass, and chord sketch for Oh-My-Score MIDI export."
};

const melody = note(seq("C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"));

const bass = note(seq("C2", "G1", "A1", "F1"))
  .slow(2);

const chords = note(seq(["C3", "E3", "G3"], ["G2", "B2", "D3"], ["A2", "C3", "E3"], ["F2", "A2", "C3"]))
  .slow(2);

export const pattern = stack(chords, bass, melody);

export default pattern;
