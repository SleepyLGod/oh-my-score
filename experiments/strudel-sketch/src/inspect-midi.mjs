import fs from "node:fs";

function readUint16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function readVarLength(bytes, offset, limit) {
  let value = 0;
  while (offset < limit) {
    const byte = bytes[offset];
    offset += 1;
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) return [value, offset];
  }
  throw new Error("Variable-length value extends past track end");
}

function midiEventDataLength(status) {
  const type = status & 0xf0;
  if (type === 0xc0 || type === 0xd0) return 1;
  if (type >= 0x80 && type <= 0xe0) return 2;
  throw new Error(`Unsupported MIDI status byte: 0x${status.toString(16)}`);
}

function inspectMidi(path) {
  const bytes = fs.readFileSync(path);
  if (bytes.subarray(0, 4).toString("ascii") !== "MThd") throw new Error("MIDI file does not start with MThd");
  const headerLength = readUint32(bytes, 4);
  const trackCount = readUint16(bytes, 10);
  const division = readUint16(bytes, 12);
  let offset = 8 + headerLength;
  let noteCount = 0;
  let minPitch = null;
  let maxPitch = null;
  const channels = new Set();

  for (let track = 0; track < trackCount; track += 1) {
    if (bytes.subarray(offset, offset + 4).toString("ascii") !== "MTrk") throw new Error(`Expected MTrk at ${offset}`);
    const trackLength = readUint32(bytes, offset + 4);
    let cursor = offset + 8;
    const end = cursor + trackLength;
    let runningStatus = null;

    while (cursor < end) {
      [, cursor] = readVarLength(bytes, cursor, end);
      let status = bytes[cursor];
      let dataOffset;
      if (status < 0x80) {
        if (runningStatus === null) throw new Error("Running status without prior status byte");
        status = runningStatus;
        dataOffset = cursor;
      } else {
        cursor += 1;
        dataOffset = cursor;
        if (status < 0xf0) runningStatus = status;
      }

      if (status === 0xff) {
        cursor += 1;
        const meta = readVarLength(bytes, cursor, end);
        cursor = meta[1] + meta[0];
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const sysex = readVarLength(bytes, cursor, end);
        cursor = sysex[1] + sysex[0];
        continue;
      }

      const length = midiEventDataLength(status);
      cursor = dataOffset + length;
      const eventType = status & 0xf0;
      const channel = status & 0x0f;
      channels.add(channel + 1);
      if (eventType === 0x90 && bytes[dataOffset + 1] > 0) {
        const pitch = bytes[dataOffset];
        noteCount += 1;
        minPitch = minPitch === null ? pitch : Math.min(minPitch, pitch);
        maxPitch = maxPitch === null ? pitch : Math.max(maxPitch, pitch);
      }
    }
    offset = end;
  }

  return { trackCount, division, channels: channels.size, noteCount, minPitch, maxPitch, bytes: bytes.length };
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node src/inspect-midi.mjs /path/to/file.mid");
  process.exit(1);
}

try {
  console.log(JSON.stringify(inspectMidi(inputPath), null, 2));
} catch (error) {
  console.error(`MIDI inspection failed: ${error.message}`);
  process.exit(1);
}
