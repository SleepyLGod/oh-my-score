import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_PATTERN = "patterns/default.mjs";
const DEFAULT_OUTPUT_DIR = "/workspace/output";
const PPQ = 480;
const BEATS_PER_CYCLE = 4;
const DEFAULT_BARS = 8;
const DEFAULT_BPM = 120;
const NOTE_NAMES = new Map([
  ["C", 0],
  ["C#", 1],
  ["DB", 1],
  ["D", 2],
  ["D#", 3],
  ["EB", 3],
  ["E", 4],
  ["F", 5],
  ["F#", 6],
  ["GB", 6],
  ["G", 7],
  ["G#", 8],
  ["AB", 8],
  ["A", 9],
  ["A#", 10],
  ["BB", 10],
  ["B", 11]
]);

function parseArgs(argv) {
  const args = {
    pattern: DEFAULT_PATTERN,
    output: DEFAULT_OUTPUT_DIR,
    bars: DEFAULT_BARS,
    bpm: DEFAULT_BPM
  };

  const readValue = (index, flag) => {
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return value;
  };

  const readNumber = (index, flag) => {
    const value = Number(readValue(index, flag));
    if (!Number.isFinite(value)) {
      throw new Error(`Missing or invalid value for ${flag}`);
    }
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pattern") args.pattern = readValue(index++, arg);
    else if (arg === "--output") args.output = readValue(index++, arg);
    else if (arg === "--bars") args.bars = readNumber(index++, arg);
    else if (arg === "--bpm") args.bpm = readNumber(index++, arg);
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.bars) || args.bars <= 0) throw new Error("--bars must be a positive number");
  if (!Number.isFinite(args.bpm) || args.bpm <= 0) throw new Error("--bpm must be a positive number");
  return args;
}

function printHelp() {
  console.log(`Usage:
  node src/export-strudel-midi.mjs --pattern patterns/default.mjs --output /workspace/output --bars 8 --bpm 120

The pattern module must export a Strudel Pattern as default or as named export "pattern".
Generated MIDI is written to the output directory and can be opened with Oh-My-Score.`);
}

async function loadPattern(patternPath) {
  const resolvedPath = path.resolve(process.cwd(), patternPath);
  const module = await import(pathToFileURL(resolvedPath).href);
  const pattern = module.pattern || module.default;
  if (!pattern || typeof pattern.queryArc !== "function") {
    throw new Error(`Pattern module ${patternPath} must export a Strudel Pattern with queryArc()`);
  }
  return {
    pattern,
    metadata: module.metadata || {},
    sourcePath: resolvedPath
  };
}

function fractionToNumber(value) {
  if (typeof value === "number") return value;
  if (value && typeof value.valueOf === "function") {
    const numericValue = Number(value.valueOf());
    if (Number.isFinite(numericValue)) return numericValue;
  }
  if (value && typeof value.toFraction === "function") {
    const text = value.toFraction();
    const [numerator, denominator] = text.split("/").map(Number);
    return denominator ? numerator / denominator : numerator;
  }
  const fallback = Number(value);
  if (Number.isFinite(fallback)) return fallback;
  throw new Error(`Unable to convert Strudel time value to number: ${value}`);
}

function midiFromNoteName(noteName) {
  const match = String(noteName).trim().match(/^([A-Ga-g])([#b]?)(-?\d+)?$/);
  if (!match) return null;
  const pitchClass = `${match[1].toUpperCase()}${match[2] || ""}`.toUpperCase();
  const semitone = NOTE_NAMES.get(pitchClass);
  if (semitone === undefined) return null;
  const octave = match[3] === undefined ? 4 : Number(match[3]);
  const midi = semitone + (octave + 1) * 12;
  return midi >= 0 && midi <= 127 ? midi : null;
}

function midiFromValue(value) {
  if (typeof value === "number" && value >= 0 && value <= 127) return Math.round(value);
  if (typeof value === "string") {
    const parsed = midiFromNoteName(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function extractNoteValues(value) {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(extractNoteValues);
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "note")) return extractNoteValues(value.note);
    if (Object.prototype.hasOwnProperty.call(value, "midinote")) return extractNoteValues(value.midinote);
    if (Object.prototype.hasOwnProperty.call(value, "midi")) return extractNoteValues(value.midi);
    if (Object.prototype.hasOwnProperty.call(value, "n")) return extractNoteValues(value.n);
    if (Object.prototype.hasOwnProperty.call(value, "value")) return extractNoteValues(value.value);
    return [];
  }
  const midi = midiFromValue(value);
  return midi === null ? [] : [midi];
}

function extractVelocity(value) {
  if (!value || typeof value !== "object") return 88;
  const raw = value.velocity ?? value.vel ?? value.gain;
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 88;
  if (raw <= 1) return Math.max(1, Math.min(127, Math.round(raw * 127)));
  return Math.max(1, Math.min(127, Math.round(raw)));
}

function eventToMidiNotes(event) {
  if (typeof event.hasOnset === "function" && !event.hasOnset()) return [];
  const begin = fractionToNumber(event.whole.begin);
  const end = fractionToNumber(event.whole.end);
  const startTick = Math.max(0, Math.round(begin * BEATS_PER_CYCLE * PPQ));
  const endTick = Math.max(startTick + 1, Math.round(end * BEATS_PER_CYCLE * PPQ));
  const velocity = extractVelocity(event.value);
  return extractNoteValues(event.value).map((pitch) => ({
    pitch,
    velocity,
    startTick,
    endTick
  }));
}

function collectMidiNotes(pattern, bars) {
  const events = pattern.queryArc(0, bars);
  const notes = events.flatMap(eventToMidiNotes);
  notes.sort((left, right) => left.startTick - right.startTick || left.pitch - right.pitch || left.endTick - right.endTick);
  return notes;
}

function textBytes(text) {
  return Array.from(Buffer.from(text, "ascii"));
}

function uint16(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function uint32(value) {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function varLength(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function metaText(type, text) {
  const bytes = textBytes(text);
  return [0x00, 0xff, type, ...varLength(bytes.length), ...bytes];
}

function trackChunk(trackBytes) {
  return [...textBytes("MTrk"), ...uint32(trackBytes.length), ...trackBytes];
}

function buildTempoTrack(bpm, title) {
  const microsPerQuarter = Math.round(60000000 / bpm);
  return trackChunk([
    ...metaText(0x03, title.slice(0, 64)),
    0x00,
    0xff,
    0x51,
    0x03,
    (microsPerQuarter >> 16) & 0xff,
    (microsPerQuarter >> 8) & 0xff,
    microsPerQuarter & 0xff,
    0x00,
    0xff,
    0x2f,
    0x00
  ]);
}

function buildNoteTrack(notes) {
  const events = [
    { tick: 0, order: 0, data: [0xc0, 0x00] }
  ];
  notes.forEach((note) => {
    events.push({ tick: note.startTick, order: 1, data: [0x90, note.pitch, note.velocity] });
    events.push({ tick: note.endTick, order: 0, data: [0x80, note.pitch, 0x40] });
  });
  events.sort((left, right) => left.tick - right.tick || left.order - right.order || left.data[1] - right.data[1]);

  let lastTick = 0;
  const bytes = [0x00, 0xff, 0x03, 0x0c, ...textBytes("Strudel MIDI")];
  events.forEach((event) => {
    bytes.push(...varLength(event.tick - lastTick), ...event.data);
    lastTick = event.tick;
  });
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return trackChunk(bytes);
}

function buildMidiFile(notes, options) {
  const title = options.title || "Strudel Sketch";
  const header = [
    ...textBytes("MThd"),
    ...uint32(6),
    ...uint16(1),
    ...uint16(2),
    ...uint16(PPQ)
  ];
  return Buffer.from([
    ...header,
    ...buildTempoTrack(options.bpm, title),
    ...buildNoteTrack(notes)
  ]);
}

function outputName(metadata, sourcePath) {
  const baseName = metadata.name || path.basename(sourcePath, path.extname(sourcePath));
  return `${baseName.replace(/[^a-zA-Z0-9_-]+/g, "-")}.mid`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = await loadPattern(args.pattern);
  const notes = collectMidiNotes(loaded.pattern, args.bars);
  if (!notes.length) {
    throw new Error("No MIDI note events could be extracted from the Strudel pattern");
  }

  fs.mkdirSync(args.output, { recursive: true });
  const midi = buildMidiFile(notes, {
    bpm: args.bpm,
    title: loaded.metadata.title || "Strudel Sketch"
  });
  const outputPath = path.join(args.output, outputName(loaded.metadata, loaded.sourcePath));
  fs.writeFileSync(outputPath, midi);

  const pitches = notes.map((note) => note.pitch);
  console.log(`Pattern: ${loaded.sourcePath}`);
  console.log(`MIDI: ${outputPath}`);
  console.log(`Notes: ${notes.length}`);
  console.log(`Pitch range: ${Math.min(...pitches)}-${Math.max(...pitches)}`);
  console.log(`Bars: ${args.bars}`);
  console.log(`BPM: ${args.bpm}`);
}

main().catch((error) => {
  console.error(`Strudel sketch export failed: ${error.message}`);
  process.exit(1);
});
