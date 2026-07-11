# Local Ollama Pair Workflow

This workflow keeps Codex as the primary implementation agent and uses local Ollama models as a second reviewer for focused checks.

## Available local models

Current checked models:

- `lfm2.5:latest` - fast local reviewer for frequent small checks.
- `qwen3.5:9b` - balanced assistant for medium code, UI, and docs review.
- `north-mini-code-1.0:latest` - default code reviewer for implementation, refactor, and bug-risk checks.
- `gemma4:latest` - useful for UX wording, classroom instructions, and broader product critique.

If `ollama` is not in `PATH`, the helper still tries the default Windows install path:

```powershell
C:\Users\Damir\AppData\Local\Programs\Ollama\ollama.exe
```

## Commands

Optional environment:

```powershell
$env:OLLAMA_MODEL = "north-mini-code-1.0:latest"
$env:OLLAMA_PAIR_TIMEOUT_MS = "300000"
$env:OLLAMA_PAIR_STRIP_THINKING = "true"
```

Linux/macOS shell equivalent:

```bash
export OLLAMA_MODEL="north-mini-code-1.0:latest"
export OLLAMA_PAIR_TIMEOUT_MS="300000"
```

`OLLAMA_PAIR_TIMEOUT_MS` is the maximum wait time for a local model response in milliseconds. Large local code models can need several minutes on long file reviews.

List local models:

```powershell
npm run ai:local:models
```

Verify API and default model:

```powershell
npm run ai:local:verify
```

Ask a focused question:

```powershell
npm run ai:local:ask -- --model gemma4:latest --prompt "Review the teacher dashboard flow for classroom clarity."
```

Review the current UI files:

```powershell
npm run ai:local:review
```

Run preset reviewers:

```powershell
npm run ai:local:review:fast
npm run ai:local:review:balanced
npm run ai:local:review:code
npm run ai:local:review:ui
npm run ai:local:review:docs
```

Review specific files:

```powershell
npm run ai:local:review -- --files public/app.js,public/styles.css --model north-mini-code-1.0:latest
```

## How we use it

Ollama is a helper, not the source of truth.

Use it for:

- second-pass UI/code review;
- alternate wording for teacher/student instructions;
- finding obvious bugs after a scoped edit;
- comparing design choices against the reference screenshot.

Do not use it for:

- final correctness claims;
- replacing `npm run check`, `npm test`, smoke tests, or browser screenshots;
- large autonomous rewrites;
- decisions that need current external docs.

## Local AI Stack

Working stack for the current Biz Arena UI/admin pass:

- Codex - primary implementation, tests, screenshots, and final decisions.
- Ollama `lfm2.5:latest` - fast local reviewer for quick checks.
- Ollama `qwen3.5:9b` - balanced local reviewer for medium tasks.
- Ollama `north-mini-code-1.0:latest` - local code reviewer.
- Ollama `gemma4:latest` - local UX, docs, and teacher/student wording reviewer.
- Graphify - repository map after code edits.
- `ui-ux-pro-max` - design intelligence for dashboard and classroom UI direction.

This stack is intentionally small. Extra agent frameworks can help later, but they should not enter the runtime until the core classroom flow is stable.

## Perplexity List Filter

### Use Now

- Ollama - already active locally.
- AGENTS.md / WORKFLOW_STATE patterns - already partially covered by this repo's `AGENTS.md` and OMX setup.
- OpenCode-Multi-Agent-Setup style - useful as inspiration for planner/implementor/reviewer/tester roles.

### Inspect Later

- OpenCode - useful later as a separate terminal coding agent, not needed before current UI pass stabilizes.
- LangChain / LangGraph / AutoGen / CrewAI - useful later for experiments, but too heavy for the current product slice.

Simulation references to inspect after the UI pass:

- EconSim
- EconomicSimulation
- Market-simulator
- BusinessTycoon
- StockPulse
- EconIsle
- Potion-Shopkeeper
- Endciv-OpenSource

### Out Of Scope For This Slice

- vLLM, PEFT, Transformers fine-tuning - valuable later, but not needed to ship Biz Arena UI/admin flow.
- Diffusers, ComfyUI, OCR tools - unrelated to the current classroom simulator hardening.
- Full agent frameworks inside the app runtime - would add operational complexity without improving the playable classroom experience right now.
