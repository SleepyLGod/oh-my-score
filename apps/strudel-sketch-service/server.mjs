import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const PORT = 8091;
const RUNTIME_ROOT = path.resolve("/workspace/experiment/.runtime");
const MAX_BODY_BYTES = 128 * 1024;
const MAX_PATTERN_BYTES = 64 * 1024;
const CONVERSION_TIMEOUT_MS = 60 * 1000;
const SYNTAX_CHECK_TIMEOUT_MS = 5 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const RATE_LIMIT_BUCKET_TTL_MS = 30 * 60 * 1000;
const FRONTEND_ORIGINS = (process.env.STRUDEL_FRONTEND_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateLimitBuckets = new Map();
const DEFAULT_PATTERN_SOURCE = `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "strudel-sketch",
  title: "Strudel Sketch"
};

const melody = note(seq("C4", "D4", "E4", "G4", "A4", "G4", "E4", "D4"));
const bass = note(seq("C2", "G1", "A1", "F1")).slow(2);

export const pattern = stack(bass, melody);
export default pattern;
`;

function requestOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return FRONTEND_ORIGINS[0] || "";
  return FRONTEND_ORIGINS.includes(origin) ? origin : "";
}

function corsHeaders(request) {
  const origin = requestOrigin(request);
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function sendJson(request, response, statusCode, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  response.writeHead(statusCode, {
    ...corsHeaders(request),
    "Content-Type": "application/json",
    "Content-Length": body.length
  });
  response.end(body);
}

function requireAllowedOrigin(request) {
  if (request.headers.origin && !requestOrigin(request)) {
    const error = new Error("Origin is not allowed.");
    error.statusCode = 403;
    throw error;
  }
}

function enforceRateLimit(request) {
  const client = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const bucket = rateLimitBuckets.get(client) || { startedAt: now, count: 0, lastSeen: now };
  if (now - bucket.startedAt > RATE_LIMIT_WINDOW_MS) {
    bucket.startedAt = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  bucket.lastSeen = now;
  rateLimitBuckets.set(client, bucket);
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    const error = new Error("Too many sketch generation requests. Wait a minute and retry.");
    error.statusCode = 429;
    throw error;
  }
}

function cleanupRateLimitBuckets(now = Date.now()) {
  for (const [client, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.lastSeen > RATE_LIMIT_BUCKET_TTL_MS) {
      rateLimitBuckets.delete(client);
    }
  }
}

const rateLimitCleanupInterval = setInterval(cleanupRateLimitBuckets, RATE_LIMIT_BUCKET_TTL_MS);
rateLimitCleanupInterval.unref?.();

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let totalBytes = 0;
    const chunks = [];
    let finished = false;

    function fail(error) {
      if (finished) return;
      finished = true;
      reject(error);
    }

    request.on("data", (chunk) => {
      if (finished) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        finished = true;
        request.destroy();
        reject(new Error("Request body is too large."));
        return;
      }
      chunks.push(chunk);
    });

    request.on("end", () => {
      if (finished) return;
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const payload = rawBody ? JSON.parse(rawBody) : {};
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
          throw new Error("JSON body must be an object.");
        }
        finished = true;
        resolve(payload);
      } catch (error) {
        fail(new Error(`Invalid JSON body: ${error.message}`));
      }
    });

    request.on("error", fail);
  });
}

function safeNumber(value, fallback, min, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.min(max, numericValue));
}

function sketchOptions(payload) {
  const source = typeof payload.source === "string" && payload.source.trim()
    ? payload.source
    : DEFAULT_PATTERN_SOURCE;
  if (Buffer.byteLength(source, "utf8") > MAX_PATTERN_BYTES) {
    throw new Error("Pattern source is too large.");
  }
  const requestedBars = Number(payload.bars);
  const bars = requestedBars === 4 || requestedBars === 8 ? requestedBars : 8;
  const bpm = safeNumber(payload.bpm, 120, 40, 240);
  return { source, bars, bpm };
}

function runSyntaxCheck(patternPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("node", ["--check", patternPath], {
      cwd: "/workspace/experiment",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Strudel sketch syntax check timed out."));
    }, SYNTAX_CHECK_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      const output = Buffer.concat(chunks).toString("utf8").trim();
      reject(new Error(output || "Strudel sketch has invalid JavaScript syntax."));
    });
  });
}

function runExporter(patternPath, outputDir, bars, bpm) {
  return new Promise((resolve, reject) => {
    const command = [
      "src/export-strudel-midi.mjs",
      "--pattern",
      patternPath,
      "--output",
      outputDir,
      "--bars",
      String(bars),
      "--bpm",
      String(bpm)
    ];
    const child = spawn("node", command, {
      cwd: "/workspace/experiment",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Strudel sketch export timed out."));
    }, CONVERSION_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const output = Buffer.concat(chunks).toString("utf8").trim();
      if (code !== 0) {
        reject(new Error(output || `Exporter exited with code ${code}`));
        return;
      }
      resolve(output);
    });
  });
}

async function newestMidiFile(outputDir) {
  const entries = await fs.readdir(outputDir, { withFileTypes: true });
  const midiFiles = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".mid")) continue;
    const filePath = path.join(outputDir, entry.name);
    const stat = await fs.stat(filePath);
    midiFiles.push({ filePath, mtimeMs: stat.mtimeMs });
  }
  midiFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!midiFiles.length) {
    throw new Error("Strudel exporter finished without creating a MIDI file.");
  }
  return midiFiles[0].filePath;
}

async function generateSketch(payload) {
  const options = sketchOptions(payload);
  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const jobDir = path.join(RUNTIME_ROOT, jobId);
  const patternPath = path.join(jobDir, "pattern.mjs");
  const outputDir = path.join(jobDir, "output");
  const startedAt = Date.now();

  try {
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(patternPath, options.source, "utf8");
    await runSyntaxCheck(patternPath);
    const log = await runExporter(patternPath, outputDir, options.bars, options.bpm);
    const midiPath = await newestMidiFile(outputDir);
    const midiBytes = await fs.readFile(midiPath);
    return {
      status: "ok",
      message: `Strudel sketch generated in ${((Date.now() - startedAt) / 1000).toFixed(2)}s.`,
      fileName: path.basename(midiPath),
      bars: options.bars,
      bpm: options.bpm,
      midiBase64: midiBytes.toString("base64"),
      log
    };
  } finally {
    await fs.rm(jobDir, { recursive: true, force: true });
  }
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(requestOrigin(request) ? 204 : 403, corsHeaders(request));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(request, response, 200, { status: "ok" });
    return;
  }

  if (request.method === "POST" && request.url === "/generate") {
    try {
      requireAllowedOrigin(request);
      enforceRateLimit(request);
      const payload = await readJsonBody(request);
      sendJson(request, response, 200, await generateSketch(payload));
    } catch (error) {
      sendJson(request, response, error.statusCode || 400, { error: error.message || "Strudel sketch generation failed." });
    }
    return;
  }

  sendJson(request, response, 404, { error: "Not found" });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    sendJson(request, response, 500, { error: error.message || "Internal server error." });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Strudel sketch service listening on ${PORT}`);
});

function shutdown() {
  clearInterval(rateLimitCleanupInterval);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
