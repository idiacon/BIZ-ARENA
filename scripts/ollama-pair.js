const { spawnSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");

const DEFAULT_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "north-mini-code-1.0:latest";
const MAX_FILE_CHARS = Number(process.env.OLLAMA_PAIR_MAX_FILE_CHARS || 18000);
const REQUEST_TIMEOUT_MS = Number(process.env.OLLAMA_PAIR_TIMEOUT_MS || 300000);
const STRIP_THINKING = process.env.OLLAMA_PAIR_STRIP_THINKING !== "false";

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(value);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Biz Arena Ollama pair helper

Usage:
  node scripts/ollama-pair.js models
  node scripts/ollama-pair.js verify [--model gemma4:latest]
  node scripts/ollama-pair.js ask --prompt "Question" [--model gemma4:latest] [--files public/app.js,public/styles.css]
  node scripts/ollama-pair.js review [--preset code|ui|docs] [--files public/app.js,public/styles.css] [--model north-mini-code-1.0:latest]

Environment:
  OLLAMA_HOST=http://127.0.0.1:11434
  OLLAMA_MODEL=north-mini-code-1.0:latest
  OLLAMA_PAIR_TIMEOUT_MS=300000
  OLLAMA_BIN=C:\\Users\\Damir\\AppData\\Local\\Programs\\Ollama\\ollama.exe`);
}

function requestJson(method, pathname, body) {
  const url = new URL(pathname, DEFAULT_HOST);
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method,
        headers: payload
          ? {
              "content-type": "application/json",
              "content-length": Buffer.byteLength(payload),
            }
          : {},
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          text += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Ollama HTTP ${res.statusCode}: ${text.slice(0, 500)}`));
            return;
          }
          try {
            resolve(JSON.parse(text || "{}"));
          } catch (error) {
            reject(new Error(`Cannot parse Ollama response: ${error.message}`));
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("Ollama request timed out"));
    });
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function candidateBins() {
  const localAppData = process.env.LOCALAPPDATA || "";
  return [
    process.env.OLLAMA_BIN,
    "ollama",
    localAppData && path.join(localAppData, "Programs", "Ollama", "ollama.exe"),
    localAppData && path.join(localAppData, "Ollama", "ollama.exe"),
    "C:\\Program Files\\Ollama\\ollama.exe",
    "C:\\Program Files (x86)\\Ollama\\ollama.exe",
  ].filter(Boolean);
}

function runOllamaListFallback() {
  for (const bin of candidateBins()) {
    const result = spawnSync(bin, ["list"], { encoding: "utf8" });
    if (!result.error && result.status === 0) {
      return result.stdout.trim();
    }
  }
  throw new Error("Ollama is not available through API and ollama.exe was not found.");
}

function splitFiles(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((file) => file.trim())
    .filter(Boolean);
}

function readFiles(files) {
  return files.map((file) => {
    const absolutePath = path.resolve(process.cwd(), file);
    const text = fs.readFileSync(absolutePath, "utf8");
    const clipped = text.length > MAX_FILE_CHARS ? text.slice(0, MAX_FILE_CHARS) : text;
    const clippedNote = text.length > MAX_FILE_CHARS ? `\n\n[trimmed after ${MAX_FILE_CHARS} characters]` : "";
    return `### ${file}\n\`\`\`\n${clipped}${clippedNote}\n\`\`\``;
  });
}

function reviewPreset(preset) {
  const presets = {
    code: {
      title: "code reviewer",
      focus:
        "broken behavior, security boundaries, maintainability, performance, server/client contract regressions, and missing tests",
    },
    ui: {
      title: "UI/UX reviewer",
      focus:
        "classroom usability, visual hierarchy, responsive layout, accessibility, overloaded screens, unclear next actions, and reference-dashboard mismatch",
    },
    docs: {
      title: "documentation reviewer",
      focus:
        "unclear setup steps, stale assumptions, missing verification commands, portability gaps, and teacher/admin handoff clarity",
    },
  };
  return presets[preset] || presets.code;
}

function buildReviewPrompt(files, presetName) {
  const fileBlocks = readFiles(files);
  const preset = reviewPreset(presetName || "code");
  return [
    `You are a local second ${preset.title} for Biz Arena, an educational multiplayer business simulator.`,
    `Review only the supplied files. Focus on concrete issues: ${preset.focus}.`,
    "Do not invent missing context. Return concise findings with file names and practical fixes. If there are no high-signal findings, say so.",
    "",
    fileBlocks.join("\n\n"),
  ].join("\n");
}

function cleanResponse(text) {
  if (!STRIP_THINKING) {
    return text.trim();
  }
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

async function printModels() {
  try {
    const tags = await requestJson("GET", "/api/tags");
    const models = Array.isArray(tags.models) ? tags.models : [];
    if (models.length === 0) {
      console.log("Ollama API is running, but no models were returned.");
      return;
    }
    for (const model of models) {
      const sizeGb = model.size ? `${(model.size / 1024 / 1024 / 1024).toFixed(1)} GB` : "unknown size";
      console.log(`${model.name} (${sizeGb})`);
    }
  } catch (error) {
    console.log(runOllamaListFallback());
  }
}

async function generate(model, prompt) {
  const response = await requestJson("POST", "/api/generate", {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.2,
      num_ctx: 8192,
    },
  });
  console.log(cleanResponse(response.response || ""));
}

async function verify(model) {
  const tags = await requestJson("GET", "/api/tags");
  const models = Array.isArray(tags.models) ? tags.models.map((item) => item.name) : [];
  if (!models.includes(model)) {
    throw new Error(`Model ${model} is not installed. Available: ${models.join(", ") || "none"}`);
  }
  const response = await requestJson("POST", "/api/generate", {
    model,
    prompt: "Reply with exactly: OK Biz Arena local AI ready",
    stream: false,
    options: {
      temperature: 0,
      num_ctx: 512,
    },
  });
  const text = cleanResponse(response.response || "");
  console.log(`Ollama API: ok`);
  console.log(`Model: ${model}`);
  console.log(`Response: ${text}`);
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (command === "help" || args.help) {
    printHelp();
    return;
  }

  if (command === "models") {
    await printModels();
    return;
  }

  if (command === "verify") {
    await verify(args.model || DEFAULT_MODEL);
    return;
  }

  if (command === "ask") {
    const promptParts = [];
    if (args.prompt) {
      promptParts.push(args.prompt);
    }
    const files = splitFiles(args.files);
    if (files.length > 0) {
      promptParts.push(readFiles(files).join("\n\n"));
    }
    const prompt = promptParts.join("\n\n").trim();
    if (!prompt) {
      throw new Error("ask requires --prompt and/or --files");
    }
    await generate(args.model || DEFAULT_MODEL, prompt);
    return;
  }

  if (command === "review") {
    const files = splitFiles(args.files || "public/app.js,public/styles.css");
    await generate(args.model || DEFAULT_MODEL, buildReviewPrompt(files, args.preset));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`[ollama-pair] ${error.message}`);
  process.exitCode = 1;
});
