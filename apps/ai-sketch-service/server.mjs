import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const PORT = 8092;
const RUNTIME_ROOT = path.resolve("/workspace/ai-sketch/.runtime");
const MAX_BODY_BYTES = 64 * 1024;
const MAX_PROMPT_CHARS = 1600;
const MAX_SOURCE_CHARS = 8000;
const REQUEST_TIMEOUT_MS = 45 * 1000;
const SYNTAX_CHECK_TIMEOUT_MS = 5 * 1000;
const FRONTEND_ORIGINS = (process.env.AI_SKETCH_FRONTEND_ORIGINS || "http://localhost:8080,http://127.0.0.1:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const models = {
  "deepseek-v4-pro": {
    label: "deepseek-v4-pro",
    transport: "openai-compatible",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    tokenField: "max_tokens",
    maxTokens: 1400,
    timeoutMs: REQUEST_TIMEOUT_MS,
    jsonMode: true,
    extraBody: { thinking: { type: "disabled" } }
  },
  "mimo-v2.5-pro": {
    label: "mimo-v2.5-pro",
    transport: "openai-compatible",
    apiKey: process.env.XIAOMI_API_KEY || process.env.MIMO_API_KEY || "",
    baseUrl: process.env.MIMO_BASE_URL || "https://token-plan-cn.xiaomimimo.com/v1",
    model: process.env.MIMO_MODEL || "mimo-v2.5-pro",
    tokenField: "max_tokens",
    maxTokens: 4096,
    timeoutMs: 180 * 1000,
    jsonMode: false,
    requiresFinalContent: true,
    outputMode: "sketch-spec"
  }
};

const styles = {
  ambient: "spacious, gentle, slow-moving, consonant",
  classical: "balanced classical sketch with clear melody and bass motion",
  jazz: "light jazz color with stepwise melody and extended but playable harmony",
  chiptune: "bright game-like arpeggios and simple bass movement",
  minimal: "minimal repeating cells with subtle variation",
  cinematic: "wide, dramatic, soundtrack-like piano sketch"
};

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

function modelStatus() {
  return Object.fromEntries(Object.entries(models).map(([id, modelConfig]) => [
    id,
    {
      label: modelConfig.label,
      configured: Boolean(modelConfig.apiKey),
      transport: modelConfig.transport,
      model: modelConfig.model
    }
  ]));
}

function normalizeSuggestPayload(payload) {
  const modelId = typeof payload.model === "string" ? payload.model : "deepseek-v4-pro";
  const modelConfig = models[modelId];
  if (!modelConfig) {
    const error = new Error("Unknown AI model.");
    error.statusCode = 400;
    throw error;
  }
  if (!modelConfig.apiKey) {
    const error = new Error(`${modelConfig.label} API key is not configured.`);
    error.statusCode = 503;
    throw error;
  }

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    throw new Error("Describe the sketch you want to generate.");
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    throw new Error("Prompt is too long.");
  }

  const style = styles[payload.style] ? payload.style : "ambient";
  const requestedBars = Number(payload.bars);
  const bars = requestedBars === 4 || requestedBars === 8 ? requestedBars : 8;
  const bpmNumber = Number(payload.bpm);
  const bpm = Number.isFinite(bpmNumber) ? Math.max(40, Math.min(240, bpmNumber)) : 120;
  return { modelId, modelConfig, prompt, style, bars, bpm };
}

function systemPrompt(options) {
  if (options.modelConfig.outputMode === "sketch-spec") {
    return `You create compact musical sketch plans for Oh-My-Score.
Return one valid JSON object only, with keys: title, melodyNotes, bassNotes, explanation, warnings.
melodyNotes and bassNotes must be arrays of pitch strings only, such as "D4", "F4", "A4".
Use only note names A-G with optional # and octave 0-8. Do not use spaces, chords, rests, drums, samples, code, markdown, or prose outside JSON.
Keep melodyNotes between 4 and 16 items. Keep bassNotes between 2 and 8 items.`;
  }
  return `You generate short Strudel code sketches for Oh-My-Score.
Return one valid JSON object only, with keys: title, source, explanation, warnings.
The source must be JavaScript for offline MIDI export in Node.
Allowed imports only:
import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";
The source must include export const metadata, export const pattern, and export default pattern.
Use only note(...), seq(...), stack(...), .slow(number), and simple const declarations.
Every pitch sequence must be wrapped as note(seq("C4", "E4", ...)); stack only note(...) pattern variables.
Each seq(...) item must be a single pitch string, for example seq("D4", "F4", "A4"), not seq("D4 F4").
Do not use chord angle brackets, square-bracket mini-notation, samples, drums, or raw seq(...) as a pattern.
Generate pitch-only MIDI material. Do not use drums, samples, Web MIDI, browser APIs, network APIs, eval, require, dynamic import, or filesystem/process APIs.
Keep the pattern readable and editable.`;
}

function userPrompt(options) {
  if (options.modelConfig.outputMode === "sketch-spec") {
    return `Create a compact ${options.bars}-bar MIDI sketch plan at ${options.bpm} BPM.
Style: ${options.style} (${styles[options.style]}).
User request: ${options.prompt}
${options.retryInstruction || ""}
Return JSON only. Example shape:
{"title":"Short title","melodyNotes":["D4","F4","A4","C5"],"bassNotes":["D2","A1","F2","G2"],"explanation":"One sentence.","warnings":["Any limitation, or empty array."]}`;
  }
  return `Create a ${options.bars}-bar Strudel MIDI sketch at ${options.bpm} BPM.
Style: ${options.style} (${styles[options.style]}).
User request: ${options.prompt}
${options.retryInstruction || ""}
Return JSON only. Example shape:
{"title":"Short title","source":"import ...","explanation":"One sentence.","warnings":["Any limitation, or empty array."]}`;
}

function chatCompletionsUrl(modelConfig) {
  return `${modelConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;
}

async function callModel(options) {
  const modelConfig = options.modelConfig;

  async function requestCompletion(useJsonMode) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), modelConfig.timeoutMs || REQUEST_TIMEOUT_MS);
    const body = {
      model: modelConfig.model,
      messages: [
        { role: "system", content: systemPrompt(options) },
        { role: "user", content: userPrompt(options) }
      ],
      temperature: 0.7,
      stream: false
    };
    body[modelConfig.tokenField] = modelConfig.maxTokens || 1400;
    if (useJsonMode) {
      body.response_format = { type: "json_object" };
    }
    if (modelConfig.extraBody) {
      Object.assign(body, modelConfig.extraBody);
    }

    let response;
    try {
      response = await fetch(chatCompletionsUrl(modelConfig), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${modelConfig.apiKey}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.error && payload.error.message ? payload.error.message : response.statusText;
        throw new Error(`${modelConfig.label} request failed: ${message}`);
      }
      const message = payload.choices && payload.choices[0] ? payload.choices[0].message : null;
      const content = message && typeof message.content === "string" ? message.content : "";
      if (content.trim()) return content;
      if (modelConfig.requiresFinalContent && message && typeof message.reasoning_content === "string" && message.reasoning_content.trim()) {
        const finalContentError = new Error(`${modelConfig.label} is still thinking. Try a shorter prompt or retry.`);
        finalContentError.statusCode = 504;
        throw finalContentError;
      }
      return "";
    } catch (error) {
      if (error && error.name === "AbortError") {
        const timeoutError = new Error(modelConfig.label === "mimo-v2.5-pro"
          ? `${modelConfig.label} is still thinking. Try a shorter prompt or retry.`
          : `${modelConfig.label} request timed out.`);
        timeoutError.statusCode = 504;
        throw timeoutError;
      }
      if (error && error.message === "fetch failed") {
        const networkError = new Error(`${modelConfig.label} network request failed.`);
        networkError.statusCode = 502;
        throw networkError;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  const content = await requestCompletion(modelConfig.jsonMode);
  if (content && content.trim()) return content;
  if (modelConfig.jsonMode) {
    const fallbackContent = await requestCompletion(false);
    if (fallbackContent && fallbackContent.trim()) return fallbackContent;
  }
  throw new Error(`${modelConfig.label} returned an empty response.`);
}

function parseModelJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI response was not valid JSON.");
  }
}

function validateSuggestionShape(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("AI response JSON must be an object.");
  }
  const title = String(payload.title || "AI Strudel Sketch").trim().slice(0, 80) || "AI Strudel Sketch";
  const source = String(payload.source || "").trim();
  const explanation = String(payload.explanation || "").trim().slice(0, 500);
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
    : [];
  if (!source) {
    throw new Error("AI response did not include Strudel source.");
  }
  if (source.length > MAX_SOURCE_CHARS) {
    throw new Error("AI-generated source is too long.");
  }
  return { title, source: `${source}\n`, explanation, warnings };
}

function validPitchToken(value) {
  return /^[A-G](?:#)?[0-8]$/.test(value);
}

function normalizeNoteList(value, fallback, maxItems) {
  if (!Array.isArray(value)) return fallback;
  const notes = value
    .map((item) => String(item || "").trim())
    .filter(validPitchToken)
    .slice(0, maxItems);
  return notes.length ? notes : fallback;
}

function validateSketchSpecShape(payload, options) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("AI sketch spec JSON must be an object.");
  }
  const title = String(payload.title || "MiMo Sketch").trim().slice(0, 80) || "MiMo Sketch";
  const melodyNotes = normalizeNoteList(payload.melodyNotes, ["D4", "F4", "A4", "C5", "A4", "F4", "E4", "D4"], 16);
  const bassNotes = normalizeNoteList(payload.bassNotes, ["D2", "A1", "F2", "G2"], 8);
  const explanation = String(payload.explanation || "Pattern generated from a compact MiMo sketch spec.").trim().slice(0, 500);
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
    : [];
  return {
    title,
    melodyNotes,
    bassNotes,
    explanation,
    warnings,
    bars: options.bars,
    bpm: options.bpm
  };
}

function buildStrudelSourceFromSketchSpec(spec) {
  const melodyItems = spec.melodyNotes.map((note) => JSON.stringify(note)).join(", ");
  const bassItems = spec.bassNotes.map((note) => JSON.stringify(note)).join(", ");
  return `import { note } from "@strudel/core/controls.mjs";
import { seq, stack } from "@strudel/core/pattern.mjs";

export const metadata = {
  name: "ai-sketch",
  title: ${JSON.stringify(spec.title)},
  bars: ${spec.bars},
  bpm: ${spec.bpm}
};

const melody = note(seq(${melodyItems}));
const bass = note(seq(${bassItems})).slow(2);

export const pattern = stack(bass, melody);
export default pattern;
`;
}

function validateSourceGuardrails(source) {
  const importMatches = source.match(/^\s*import\s+[^;]+;/gm) || [];
  const allowedImports = new Set([
    'import { note } from "@strudel/core/controls.mjs";',
    'import { seq, stack } from "@strudel/core/pattern.mjs";',
    'import { stack, seq } from "@strudel/core/pattern.mjs";'
  ]);
  for (const importLine of importMatches) {
    if (!allowedImports.has(importLine.trim())) {
      throw new Error("AI-generated source uses unsupported imports.");
    }
  }
  const banned = /\b(require|fetch|eval|Function|process|globalThis|window|document|XMLHttpRequest)\b|import\s*\(|from\s+["']node:|from\s+["']fs|from\s+["']http|from\s+["']https|from\s+["']child_process/;
  if (banned.test(source)) {
    throw new Error("AI-generated source uses unsupported runtime APIs.");
  }
  if (!source.includes("export const metadata")) {
    throw new Error("AI-generated source is missing metadata export.");
  }
  if (!source.includes("export const pattern")) {
    throw new Error("AI-generated source is missing pattern export.");
  }
  if (!source.includes("export default pattern")) {
    throw new Error("AI-generated source is missing default export.");
  }
  if (!/\bnote\s*\(\s*seq\s*\(/.test(source)) {
    throw new Error("AI-generated source must use note(seq(...)) pitch patterns.");
  }
  if (/["'][^"']*[<>\[\]][^"']*["']/.test(source)) {
    throw new Error("AI-generated source uses unsupported Strudel mini-notation.");
  }
  const seqCalls = source.match(/\bseq\s*\(([^)]*)\)/gs) || [];
  for (const call of seqCalls) {
    const noteTokens = Array.from(call.matchAll(/["']([^"']+)["']/g)).map((match) => match[1]);
    if (noteTokens.some((token) => /\s/.test(token.trim()))) {
      throw new Error("AI-generated source uses multi-note seq tokens.");
    }
  }
}

function runSyntaxCheck(source) {
  return new Promise(async (resolve, reject) => {
    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const jobDir = path.join(RUNTIME_ROOT, jobId);
    const sourcePath = path.join(jobDir, "suggestion.mjs");
    let settled = false;

    function finish(error) {
      if (settled) return;
      settled = true;
      fs.rm(jobDir, { recursive: true, force: true }).finally(() => {
        if (error) reject(error);
        else resolve();
      });
    }

    try {
      await fs.mkdir(jobDir, { recursive: true });
      await fs.writeFile(sourcePath, source, "utf8");
    } catch (error) {
      finish(error);
      return;
    }

    const child = spawn("node", ["--check", sourcePath], {
      cwd: "/workspace/ai-sketch",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const chunks = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(new Error("AI-generated source syntax check timed out."));
    }, SYNTAX_CHECK_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (code === 0) {
        finish();
        return;
      }
      const output = Buffer.concat(chunks).toString("utf8").trim();
      finish(new Error(output || "AI-generated source has invalid JavaScript syntax."));
    });
  });
}

async function suggestSketch(payload) {
  const options = normalizeSuggestPayload(payload);
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const modelText = await callModel(options);
      const parsedPayload = parseModelJson(modelText);
      const suggestion = options.modelConfig.outputMode === "sketch-spec"
        ? (() => {
            const spec = validateSketchSpecShape(parsedPayload, options);
            return { ...spec, source: buildStrudelSourceFromSketchSpec(spec) };
          })()
        : validateSuggestionShape(parsedPayload);
      validateSourceGuardrails(suggestion.source);
      await runSyntaxCheck(suggestion.source);
      return {
        ...suggestion,
        model: options.modelConfig.model,
        transport: options.modelConfig.transport
      };
    } catch (error) {
      lastError = error;
      const retryable = /AI-generated|valid JSON|did not include Strudel source|sketch spec/.test(error.message || "");
      if (!retryable || attempt > 0) break;
      options.retryInstruction = options.modelConfig.outputMode === "sketch-spec"
        ? `Previous attempt was rejected: ${error.message}. Regenerate valid JSON with melodyNotes and bassNotes arrays of single pitch strings like "C4".`
        : `Previous attempt was rejected: ${error.message}. Regenerate with only simple note(seq("C4", "D4")) pitch patterns and valid JSON.`;
    }
  }
  throw lastError;
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    response.writeHead(requestOrigin(request) ? 204 : 403, corsHeaders(request));
    response.end();
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(request, response, 200, { status: "ok", models: modelStatus() });
    return;
  }

  if (request.method === "POST" && request.url === "/suggest") {
    try {
      requireAllowedOrigin(request);
      const payload = await readJsonBody(request);
      sendJson(request, response, 200, await suggestSketch(payload));
    } catch (error) {
      sendJson(request, response, error.statusCode || 400, { error: error.message || "AI sketch generation failed." });
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
  console.log(`AI sketch service listening on ${PORT}`);
});

function shutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
